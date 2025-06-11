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

const scalarDefaultMap = {
  String: '""',
  Int: '0',
  Float: '0',
  Boolean: 'false',
  ID: '""',
  DateTime: 'new Date().toISOString()',
  Date: 'new Date().toISOString()',
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

  // Check if the root type is NonNull
  if (isNonNullType(type)) {
    isNonNull = true
    type = type.ofType
  }

  // Count nested lists depth and track nullability
  while (isListType(type)) {
    listDepth++
    type = type.ofType
    // Check if list items are NonNull
    if (isNonNullType(type)) {
      isListItemNonNull = true
      type = type.ofType
    }
  }

  return { type, isNonNull, listDepth, isListItemNonNull }
}

const getDefaultValueForType = (
  unwrappedType: GraphQLInputType | GraphQLOutputType,
  defaultValue?: unknown
): string => {
  if (defaultValue !== undefined) {
    if (typeof defaultValue === 'string') {
      return `"${defaultValue}"`
    }
    return JSON.stringify(defaultValue)
  }

  if (isScalarType(unwrappedType)) {
    return scalarDefaultMap[unwrappedType.name as keyof typeof scalarDefaultMap] ?? 'null'
  }

  if (isEnumType(unwrappedType)) {
    const firstValue = unwrappedType.getValues()[0]
    return firstValue ? `${unwrappedType.name}.${firstValue.value}` : 'null'
  }

  return 'null'
}

const createArrayDefault = (unwrappedType: GraphQLInputType | GraphQLOutputType, listDepth: number): string | null => {
  if (listDepth === 0) return null
  // For arrays, create appropriate defaults
  if (isScalarType(unwrappedType)) {
    if (unwrappedType.name === 'String') {
      let def: string = '[""]'
      for (let i = 1; i < listDepth; i++) {
        def = `[${def}]`
      }
      return def
    }
    let def = `[${scalarDefaultMap[unwrappedType.name as keyof typeof scalarDefaultMap]}]`
    for (let i = 1; i < listDepth; i++) {
      def = `[${def}]`
    }
    return def
  }

  if (isEnumType(unwrappedType)) {
    // Empty array for enums by default
    let def = '[]'
    for (let i = 1; i < listDepth; i++) {
      def = `[${def}]`
    }
    return def
  }

  if (isInputObjectType(unwrappedType) || isObjectType(unwrappedType)) {
    // For complex types, use array with parsed empty object
    let def = `[${unwrappedType.name}Schema.parse({})]`
    for (let i = 1; i < listDepth; i++) {
      def = `[${def}]`
    }
    return `() => ${def}`
  }

  // Fallback to empty array
  let def: unknown[] = []
  for (let i = 1; i < listDepth; i++) {
    def = [def]
  }
  return JSON.stringify(def)
}

const createZodType = ({
  type,
  defaultValue,
}: {
  type: GraphQLInputType | GraphQLOutputType
  defaultValue?: unknown
}): string => {
  const { type: unwrappedType, isNonNull, listDepth, isListItemNonNull } = unwrapType(type)
  let zodType: string

  // Base type mapping
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

  // Wrap in arrays
  for (let i = 0; i < listDepth; i++) {
    if (isListItemNonNull) {
      zodType = `z.array(${zodType})`
    } else {
      zodType = `z.array(${zodType}.optional())`
    }
  }

  // Handle nullability and defaults
  if (listDepth > 0) {
    // Array field
    let arrayDefault: string | null
    if (
      isInputObjectType(unwrappedType) ||
      isObjectType(unwrappedType) ||
      isScalarType(unwrappedType) ||
      isEnumType(unwrappedType)
    ) {
      arrayDefault = createArrayDefault(unwrappedType, listDepth)
    } else {
      arrayDefault = '[]'
    }

    // Required array → optional with default
    if (isNonNull) {
      zodType += `.default(${arrayDefault})`
    } else {
      zodType += `.optional()`
    }
  } else {
    // Non-array field
    if (isInputObjectType(unwrappedType) || isObjectType(unwrappedType)) {
      // Required object → optional with parsed default
      if (isNonNull) {
        zodType += `.default(${unwrappedType.name}Schema.parse({}))`
      } else {
        // Optional object → nullish with null default
        zodType += `.optional()`
      }
    } else {
      // Scalar and enum types
      const def = getDefaultValueForType(unwrappedType, defaultValue)

      if (isNonNull) {
        // Required field → optional with default
        zodType += `.default(${def})`
      } else {
        // Optional field → nullish with null default
        zodType += `.optional()`
      }
    }
  }

  return zodType
}

const createZodInputObject = (type: GraphQLInputObjectType): string => {
  const fields = type.getFields()
  const objectName = type.name.charAt(0).toLowerCase() + type.name.slice(1)
  let content = `export const ${objectName}Object = {\n`

  // Add __kind discriminator for input types
  content += `    __kind: z.literal('${type.name}'),\n`

  for (const [name, field] of Object.entries(fields)) {
    const zodType = createZodType({
      type: field.type,
      defaultValue: field.defaultValue,
    })
    content += `    ${name}: ${zodType},\n`
  }

  content += `} satisfies Properties<${type.name}>\n\n`

  const schema = `export const ${type.name}Schema = z.object(${objectName}Object)\n\n`

  content += schema

  const schemaType = `export type ${type.name}Infer = z.infer<typeof ${type.name}Schema>\n\n`

  content += schemaType
  return content
}

// --- Dependency Graph and Topological Sort ---

const getInputTypeDependencies = (type: GraphQLInputObjectType): string[] => {
  const deps: string[] = []
  for (const field of Object.values(type.getFields())) {
    let t = field.type
    // Unwrap NonNull and List
    while (isNonNullType(t) || isListType(t)) {
      t = t.ofType
    }
    if (isInputObjectType(t)) {
      deps.push(t.name)
    }
  }
  return deps
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

// --- Main Generation Function ---

const generateZodSchemas = async (schemaPath: string) => {
  const schema: GraphQLSchema = await loadSchema(schemaPath, {
    loaders: [new GraphQLFileLoader()],
  })

  const typeNames: string[] = []
  let inputObjects = ''

  // Find input object types (exclude Batch types as in original)
  const inputTypes = Object.values(schema.getTypeMap()).filter(
    (type): type is GraphQLInputObjectType =>
      isInputObjectType(type) && !type.name.startsWith('__') && !type.name.startsWith('Batch')
  )

  // Topologically sort input types so dependencies come first
  const sortedInputTypes = topologicalSortTypes(inputTypes)

  // Find enum types
  const enumTypes = Object.values(schema.getTypeMap()).filter(
    (type): type is GraphQLEnumType => isEnumType(type) && !type.name.startsWith('__') && type.name.endsWith('Input')
  )

  // Generate input object schemas in sorted order
  for (const inputType of sortedInputTypes) {
    typeNames.push(inputType.name)
    inputObjects += createZodInputObject(inputType)
  }

  // Combine imports - import both types and enums
  const allTypes = [...typeNames, ...enumTypes.map((e) => toConstEnumArrayName(e.name))].join(', ')
  let output = `import { z } from 'zod/v4'\n`

  if (allTypes) {
    output += `import { ${allTypes} } from '@/types'\n\n`
  }

  output += `type Properties<T> = Required<{\n`
  output += `  [K in keyof T]: z.ZodType<T[K]>\n`
  output += `}>\n\n`

  if (inputObjects) {
    output += inputObjects
  }

  return output
}

// --- Script Entrypoint ---

const schemaPath = path.resolve(__dirname, '../lib/schema.graphql')

generateZodSchemas(schemaPath).then((code) => {
  const outputPath = path.resolve(__dirname, '../../src/zod/schemas.ts')

  // Ensure directory exists
  const outputDir = path.dirname(outputPath)
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  fs.writeFileSync(outputPath, code)
  console.log('✅ Zod schemas generated successfully!')
  console.log(`📁 Output written to: ${outputPath}`)
})
