import { type CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './lib/schema.graphql',
  generates: {
    '../gql/types.ts': {
      config: {
        namingConvention: {
          enumValues: 'keep',
        },
        nonOptionalTypename: true,
        inputMaybeValue: 'T | null | undefined',
        useMembers: true,
      },
      plugins: ['typescript', 'typescript-enum-array'],
    },
    '../src/Zod/schemas.ts': {
      config: {
        schema: 'zod/v4',
        importFrom: '@/types',
        inputDiscriminator: '__kind',
        validationSchemaExportType: 'const',
        lazyStrategy: 'circular',
        separateSchemaObject: true,
      },
      plugins: ['typescript-validation-schema'],
    },
  },
  hooks: {
    afterAllFileWrite: [
      'npx ts-node codegenScripts/genInputDisc.ts && npx ts-node codegenScripts/genOps.ts && npx ts-node codegenScripts/genSchemaMapping.ts',
    ],
  },
}

export default config

/// && npx ts-node codegenScripts/genZod.ts
