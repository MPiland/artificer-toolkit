import { type CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './lib/schema.graphql',
  generates: {
    '../gql/types.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        namingConvention: {
          enumValues: 'keep',
        },
        nonOptionalTypename: true,
      },
    },
  },
  hooks: {
    afterAllFileWrite: ['ts-node generateOperations.ts'],
  },
}

export default config
