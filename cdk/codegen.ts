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
    '../zod/schemas.ts': {
      plugins: ['typescript-validation-schema'],
      config: {
        importFrom: '../gql/types.ts',
        schema: 'zod',
        strictScalars: true,
        scalars: {
          ID: 'string',
        },
        defaultScalarSchema: 'z.unknown()'
      },
    },
  },
  hooks: {
    afterAllFileWrite: ['ts-node generateOperations.ts'],
  },
}

export default config
