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
  },
  hooks: {
    afterAllFileWrite: [
      'npx ts-node codegenScripts/genInputDisc.ts && npx ts-node codegenScripts/genOps.ts && npx ts-node codegenScripts/genZod.ts && npx ts-node codegenScripts/genSchemaMapping.ts',
    ],
  },
}

export default config

/// && npx ts-node codegenScripts/genZod.ts
