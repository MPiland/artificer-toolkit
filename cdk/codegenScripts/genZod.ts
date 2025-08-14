import * as fs from 'fs'
import * as path from 'path'
import { loadSchema } from '@graphql-tools/load'
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import {
  type GraphQLSchema,
  type GraphQLInputObjectType,
  type GraphQLInputType,
  type GraphQLEnumType,
  isScalarType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isEnumType,
  isObjectType,
  type GraphQLOutputType,
} from 'graphql'

const scalarMap = {
  String: 'z.string()',
  Int: 'z.number().int()',
  Float: 'z.number()',
  Boolean: 'z.boolean()',
  ID: 'z.string()',
  DateTime: 'z.string().datetime()',
  Date: 'z.string().datetime().transform((val) => new Date(val))',
} as const

const toConstEnumArrayName = (enumName: string): string => {
  return enumName
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2') // camelCase → snake_case
    .toUpperCase() // → SCREAMING_SNAKE_CASE
}

const unwrapType = (
  type: GraphQLInputType | GraphQLOutputType
): {
  type: GraphQLInputType | GraphQLOutputType
  isNonNull: boolean
  listDepth: number
  isListItemNonNull: boolean
} => {
  let isNonNull = false
  let listDepth = 0
  let isListItemNonNull = false

  if (isNonNullType(type)) {
    isNonNull = true
    type = type.ofType
  }

  while (isListType(type)) {
    listDepth++
    type = type.ofType
    if (isNonNullType(type)) {
      isListItemNonNull = true
      type = type.ofType
    }
  }

  return { type, isNonNull, listDepth, isListItemNonNull }
}

const createZodType = ({ type }: { type: GraphQLInputType | GraphQLOutputType }): string => {
  const { type: unwrappedType, isNonNull, listDepth, isListItemNonNull } = unwrapType(type)
  let zodType: string

  if (isScalarType(unwrappedType)) {
    zodType = scalarMap[unwrappedType.name as keyof typeof scalarMap] || 'z.unknown()'
  } else if (isEnumType(unwrappedType)) {
    const constEnumName = toConstEnumArrayName(unwrappedType.name)
    zodType = `z.enum(${constEnumName})`
  } else if (isInputObjectType(unwrappedType) || isObjectType(unwrappedType)) {
    zodType = `${unwrappedType.name}Schema`
  } else {
    zodType = 'z.unknown()'
  }

  for (let i = 0; i < listDepth; i++) {
    if (isListItemNonNull) {
      zodType = `z.array(${zodType})`
    } else {
      zodType = `z.array(${zodType}.nullish())`
    }
  }

  if (!isNonNull) {
    zodType = `${zodType}.nullish()`
  }

  return zodType
}

const getInputTypeDependencies = (type: GraphQLInputObjectType): string[] => {
  const deps: string[] = []
  for (const field of Object.values(type.getFields())) {
    let t = field.type
    while (isNonNullType(t) || isListType(t)) {
      t = t.ofType
    }
    if (isInputObjectType(t)) {
      deps.push(t.name)
    }
  }
  return deps
}

const findLazyTypes = (types: GraphQLInputObjectType[]): Set<string> => {
  const refCount: Record<string, Set<string>> = {}
  const lazySet = new Set<string>()

  // Helper recursive visitor to detect recursion
  const visit = (parent: string, current: GraphQLInputObjectType, seen: Set<string>) => {
    if (seen.has(current.name)) {
      lazySet.add(current.name) // recursive type detected
      return
    }
    seen.add(current.name)
    for (const depName of getInputTypeDependencies(current)) {
      if (!refCount[depName]) {
        refCount[depName] = new Set()
      }
      refCount[depName].add(parent)
    }
  }

  for (const parent of types) {
    visit(parent.name, parent, new Set())
  }

  // Mark multi-referenced types as lazy as well
  for (const [typeName, parents] of Object.entries(refCount)) {
    if (parents.size > 1) {
      lazySet.add(typeName)
    }
  }

  return lazySet
}

const topologicalSortTypes = (types: GraphQLInputObjectType[]): GraphQLInputObjectType[] => {
  const typeMap = Object.fromEntries(types.map((t) => [t.name, t]))
  const visited = new Set<string>()
  const sorted: GraphQLInputObjectType[] = []

  function visit(type: GraphQLInputObjectType) {
    if (visited.has(type.name)) return
    visited.add(type.name)
    for (const depName of getInputTypeDependencies(type)) {
      if (typeMap[depName]) {
        visit(typeMap[depName])
      }
    }
    sorted.push(type)
  }

  for (const type of types) {
    visit(type)
  }
  return sorted
}

const createZodInputSchema = (type: GraphQLInputObjectType, lazyTypes: Set<string>): string => {
  const fields = type.getFields()
  const isLazy = lazyTypes.has(type.name)

  let schemaBody = `{\n`
  schemaBody += `  __kind: z.literal('${type.name}'),\n`
  for (const [name, field] of Object.entries(fields)) {
    const zodType = createZodType({ type: field.type })
    schemaBody += `  ${name}: ${zodType},\n`
  }
  schemaBody += `}`

  const schemaCode = isLazy ? `z.lazy(() => z.object(${schemaBody}))` : `z.object(${schemaBody})`

  return (
    `export const ${type.name}Schema = ${schemaCode}\n\n` +
    `export type ${type.name} = z.infer<typeof ${type.name}Schema>\n\n`
  )
}

const generateZodSchemas = async (schemaPath: string) => {
  const schema: GraphQLSchema = await loadSchema(schemaPath, {
    loaders: [new GraphQLFileLoader()],
  })

  // Get input object types (filter out introspection and batch types)
  const inputTypes = Object.values(schema.getTypeMap()).filter(
    (type): type is GraphQLInputObjectType =>
      isInputObjectType(type) && !type.name.startsWith('__') && !type.name.startsWith('Batch')
  )

  // Compute which types need lazy due to recursion or multiple references
  const lazyTypes = findLazyTypes(inputTypes)

  // Sort input types topologically
  const sortedInputTypes = topologicalSortTypes(inputTypes)

  // Find enums ending with 'Input' for import
  const enumTypes = Object.values(schema.getTypeMap()).filter(
    (type): type is GraphQLEnumType => isEnumType(type) && !type.name.startsWith('__') && type.name.endsWith('Input')
  )

  let output = `import { z } from 'zod/v4'\n`
  if (enumTypes.length) {
    const enumNames = enumTypes.map((e) => toConstEnumArrayName(e.name))
    output += `import { ${enumNames.join(', ')} } from '@/types'\n\n`
  }

  for (const inputType of sortedInputTypes) {
    output += createZodInputSchema(inputType, lazyTypes)
  }

  return output
}

// --- Entrypoint ---

const schemaPath = path.resolve(__dirname, '../lib/schema.graphql')

generateZodSchemas(schemaPath).then((code) => {
  const outputPath = path.resolve(__dirname, '../../src/zod/schemas.ts')

  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, code)
  console.log('✅ Zod schemas generated successfully!')
  console.log(`📁 Output written to: ${outputPath}`)
})
