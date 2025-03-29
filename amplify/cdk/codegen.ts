import { type CodegenConfig } from '@graphql-codegen/cli'

const config: CodegenConfig = {
  schema: './lib/schema.graphql',
  generates: {
    '../gql/types.ts': {
      plugins: ['typescript', 'typescript-operations'],
      config: {
        namingConvention: {
          enumValues: 'change-case-all#camelCase',
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
