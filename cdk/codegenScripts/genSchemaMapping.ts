import * as fs from 'fs'
import * as path from 'path'
import { loadSchema } from '@graphql-tools/load'
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import type { GraphQLArgument, GraphQLObjectType } from 'graphql'

// Unwrap nested GraphQL types (e.g. NonNull, List)
const unwrapTypeName = (type: GraphQLArgument['type']): string => {
  let t = type
  while (t && 'ofType' in t) {
    t = t.ofType
  }
  return t.name
}

// Extract all `export function XSchema()` names
const extractSchemaFunctions = (filePath: string): string[] => {
  const content = fs.readFileSync(filePath, 'utf8')
  const regex = /export (?:function|const) (\w+Schema)/g
  const matches = [...content.matchAll(regex)]
  return matches.map((match) => match[1])
}

// Extract mutation input type names from GraphQL schema
const extractMutations = async (schemaPath: string): Promise<Set<string>> => {
  const mutationInputs = new Set<string>()
  const schema = await loadSchema(schemaPath, {
    loaders: [new GraphQLFileLoader()],
  })
  const mutationType = schema.getType('Mutation') as GraphQLObjectType
  if (mutationType) {
    const mutationFields = mutationType.getFields()
    Object.values(mutationFields).forEach((field) => {
      field.args.forEach((arg) => {
        if (arg.name === 'input') {
          const typeName = unwrapTypeName(arg.type)
          mutationInputs.add(typeName)
        }
      })
    })
  }
  return mutationInputs
}

// Generate and write the mapping file
const generateMappingFile = async (schemasFilePath: string, outputPath: string, schemaPath: string) => {
  const schemaFunctions = extractSchemaFunctions(schemasFilePath)
  console.log({ schemaFunctions })
  const mutations = await extractMutations(schemaPath)
  console.log({ mutations })

  const typeToSchemaMapEntries = schemaFunctions
    .filter((fnName) => fnName.endsWith('InputSchema'))
    .filter((fnName) => !fnName.startsWith('Batch'))
    .filter((fnName) => {
      const typeName = fnName.replace(/Schema$/, '')
      return mutations.has(typeName)
    })
    .map((fnName) => {
      const typeName = fnName.replace(/Schema$/, '')
      return `  "${typeName}": "${fnName}"`
    })

  const discriminatedDomainSchemaLines = typeToSchemaMapEntries
    .map((entry) => {
      const match = entry.match(/"(\w+)": "(\w+)"/)
      if (!match || entry.includes('Feature') || entry.includes('Option') || entry.includes('System')) return null
      const [, schemaFnName] = match
      return `  schemas.${schemaFnName}Schema`
    })
    .filter(Boolean)

  const discriminatedFeatureSchemaLines = typeToSchemaMapEntries
    .map((entry) => {
      const match = entry.match(/"(\w+)": "(\w+)"/)
      if (!match || (!entry.includes('Feature') && !entry.includes('Option'))) return null
      const [, schemaFnName] = match
      return `  schemas.${schemaFnName}Schema`
    })
    .filter(Boolean)

  const fileContent = `// This file is auto-generated. Do not edit manually.
import { z } from 'zod/v4'
import * as schemas from './schemas'

/**
 * Mapping of GraphQL input type names to their corresponding Zod schema function names.
 */
export const inputTypeToSchemaMap = {
${typeToSchemaMapEntries.join(',\n')}
} as const

/**
 * Union type of all GraphQL input type names.
 */
export type InputTypeName = keyof typeof inputTypeToSchemaMap

/**
 * Get a Zod schema for a given GraphQL input type name.
 */
export function getInputSchema<T extends InputTypeName>(
  typeName: T
): z.ZodTypeAny {
  const schemaName = inputTypeToSchemaMap[typeName]
  return schemas[schemaName]
}

/**
 * Mapped type of inferred TypeScript types from each Zod schema.
 */
export type DomainInputTypeToInferredType = {
  [K in InputTypeName]: z.infer<typeof schemas[typeof inputTypeToSchemaMap[K]]>
}

export const DomainInputTypeToInferredType = {
  ${typeToSchemaMapEntries
    .map((entry) => {
      const match = entry.match(/"(\w+)": "(\w+)"/)
      if (!match || entry.includes('Feature') || entry.includes('System')) return null
      const [, typeName, schemaFn] = match
      return `  "${typeName}": schemas.${schemaFn}`
    })
    .filter(Boolean)
    .join(',\n')}
} as const

export type FeatureInputTypeToInferredType = {
  [K in InputTypeName]: z.infer<typeof schemas[typeof inputTypeToSchemaMap[K]]>
}

export const FeatureInputTypeToInferredType = {
  ${typeToSchemaMapEntries
    .map((entry) => {
      const match = entry.match(/"(\w+)": "(\w+)"/)
      if (!match || !entry.includes('Feature')) return null
      const [, typeName, schemaFn] = match
      return `  "${typeName}": schemas.${schemaFn}`
    })
    .filter(Boolean)
    .join(',\n')}
} as const

/**
 * Discriminated union Zod schema for GraphQL input objects.
 */
export const discriminatedDomainInputSchema = z.discriminatedUnion('__kind', [
${discriminatedDomainSchemaLines.join(',\n')}
])

export const discriminatedFeatureInputSchema = z.discriminatedUnion('__kind', [
${discriminatedFeatureSchemaLines.join(',\n')}
])
`

  // export type DomainDiscriminatedFormInput =
  // ${typeToSchemaMapEntries
  //   .map((entry) => {
  //     const match = entry.match(/"\w+": "(\w+)"/)
  //     if (!match || entry.includes('Feature')) return null
  //     const schemaName = match[1]
  //     const typeName = schemaName.replace(/InputSchema$/, 'Input')
  //     return `  | (DomainInputTypeToInferredType["${typeName}"])`
  //   })
  //   .filter(Boolean)
  //   .join('\n')};

  // export type FeatureDiscriminatedFormInput =
  //   ${typeToSchemaMapEntries
  //   .map((entry) => {
  //     const match = entry.match(/"\w+": "(\w+)"/)
  //     if (!match || !entry.includes('Feature')) return null
  //     const schemaName = match[1]
  //     const typeName = schemaName.replace(/InputSchema$/, 'Input')
  //     return `  | (FeatureInputTypeToInferredType["${typeName}"])`
  //   })
  //   .filter(Boolean)
  //   .join('\n')};

  fs.writeFileSync(outputPath, fileContent)
}

// Entry point
const schemasFilePath = path.resolve(__dirname, '../../src/zod/schemas.ts')
const outputPath = path.resolve(__dirname, '../../src/zod/schemaMapping.ts')
const schemaPath = path.resolve(__dirname, '../lib/schema.graphql')

generateMappingFile(schemasFilePath, outputPath, schemaPath)
