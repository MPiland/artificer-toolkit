import { z, lazySchema } from '../zod.js'

import { postgresUuidSchema as serverUuidIdentityDtoSchema } from './postgresUuid.js'

export const ruleMaintenanceEmptyDependentPolicyDtoSchema = lazySchema(() =>
  z.enum(['TERMINATE_WHEN_EMPTY', 'RETAIN_UNTIL_TERMINAL'])
)

export const ruleMaintenanceReusableDefinitionDocumentDtoSchema = lazySchema(() =>
  z.strictObject({
    schemaVersion: z.literal(1),
    kind: z.literal('RULE_MAINTENANCE'),
    id: serverUuidIdentityDtoSchema,
    gameSystemId: serverUuidIdentityDtoSchema,
    replacementPolicy: z.literal('REPLACE_SAME_DEFINITION'),
    emptyDependentPolicy: ruleMaintenanceEmptyDependentPolicyDtoSchema,
    damageCheckDefinitionId: z.nullable(serverUuidIdentityDtoSchema)
  })
)

export type RuleMaintenanceReusableDefinitionDocumentDto = z.infer<
  typeof ruleMaintenanceReusableDefinitionDocumentDtoSchema
>
