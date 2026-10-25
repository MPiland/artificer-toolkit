import { z, lazySchema } from '../zod.js'

import { AUTHORED_LIMITS, authoredIdentifierSchema } from '../shared/authoredLimits.js'
import { chargeUseDtoSchema } from '../shared/charge.js'
import { chargeResetKindSchema, damageDefenseBypassCodeSchema } from '../shared/enums.js'
import { postgresUuidSchema as serverUuidIdentityDtoSchema } from '../shared/postgresUuid.js'
import { characterGrantFoldModifierSchema } from './characterGrantFoldRules.js'
import { systemCoreCodeSchema } from '../shared/systemCoreCode.js'

const encounterActorResourceReconciliationPolicySchema = lazySchema(() =>
  z.enum(['CLAMP_USED_TO_MAXIMUM'])
)

const encounterActorTargetDefenseSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum(['RESISTANCE', 'IMMUNITY', 'VULNERABILITY']),
    damageTypeId: serverUuidIdentityDtoSchema
  })
)

/** A defense against attacks without any of `bypassedBy` ("from nonmagical attacks"). */
export const encounterActorQualifiedDefenseSchema = lazySchema(() =>
  z.strictObject({
    kind: z.enum(['RESISTANCE', 'IMMUNITY']),
    damageTypeId: serverUuidIdentityDtoSchema,
    bypassedBy: z.array(damageDefenseBypassCodeSchema).check(z.minLength(1)).check(z.maxLength(3))
  })
)

const normalizedEncounterActorTargetProtectionSchema = lazySchema(() =>
  z
    .strictObject({
      status: z.literal('NORMALIZED'),
      defenses: z.array(encounterActorTargetDefenseSchema).check(z.maxLength(100)),
      qualifiedDefenses: z.array(encounterActorQualifiedDefenseSchema).check(z.maxLength(100)),
      conditionImmunityIds: z.array(serverUuidIdentityDtoSchema).check(z.maxLength(100)),
      spellSchoolImmunityIds: z.array(serverUuidIdentityDtoSchema).check(z.maxLength(100))
    })
    .check(
      z.superRefine((protection, ctx) => {
        const defenseKeys = new Set<string>()
        protection.defenses.forEach((defense, index) => {
          const key = `${defense.kind}:${defense.damageTypeId}`
          if (defenseKeys.has(key)) {
            ctx.addIssue({
              code: 'custom',
              message: 'Encounter target defenses must be unique.',
              path: ['defenses', index]
            })
          }
          defenseKeys.add(key)
        })
        const conditionIds = new Set<string>()
        protection.conditionImmunityIds.forEach((conditionId, index) => {
          if (conditionIds.has(conditionId)) {
            ctx.addIssue({
              code: 'custom',
              message: 'Encounter condition immunity identities must be unique.',
              path: ['conditionImmunityIds', index]
            })
          }
          conditionIds.add(conditionId)
        })
        const schoolIds = new Set<string>()
        protection.spellSchoolImmunityIds.forEach((schoolId, index) => {
          if (schoolIds.has(schoolId)) {
            ctx.addIssue({
              code: 'custom',
              message: 'Encounter spell school immunity identities must be unique.',
              path: ['spellSchoolImmunityIds', index]
            })
          }
          schoolIds.add(schoolId)
        })
      })
    )
)

const encounterActorTargetProtectionSchema = lazySchema(() =>
  z.discriminatedUnion('status', [
    normalizedEncounterActorTargetProtectionSchema,
    z.strictObject({ status: z.literal('NOT_NORMALIZED') })
  ])
)

const encounterActorFeatureResourceFactSchema = lazySchema(() =>
  z.strictObject({
    featureId: authoredIdentifierSchema,
    charge: z.nullable(chargeUseDtoSchema),
    used: z.number().check(z.int()).check(z.gte(0)).check(z.lte(Number.MAX_SAFE_INTEGER))
  })
)

export const encounterCreatureRuleFactsSnapshotSchema = lazySchema(() =>
  z
    .strictObject({
      gameSystemId: serverUuidIdentityDtoSchema,
      vocabularySnapshotId: serverUuidIdentityDtoSchema,
      vocabularySnapshotVersion: z.number().check(z.int()).check(z.positive()),
      vocabularySnapshotChecksum: z.string().check(z.regex(/^[a-f0-9]{64}$/)),
      abilityScores: z.record(serverUuidIdentityDtoSchema, z.number()),
      /** UUID-backed check totals pinned with the Creature Blueprint snapshot. */
      checkTotals: z.optional(z.record(serverUuidIdentityDtoSchema, z.number().check(z.int()))),
      /** Proficiency bonus added to a saving throw, keyed by ability definition; absent when not proficient. */
      saveProficiencyBonuses: z.record(serverUuidIdentityDtoSchema, z.number().check(z.int())),
      resourceAbilityScores: z.partialRecord(systemCoreCodeSchema, z.number()),
      initiativeAbilityDefinitionId: serverUuidIdentityDtoSchema,
      /**
       * The Creature's feature modifier grants as the grant fold Characters use accepted them, with the
       * Creature as holder: one shape for every consumer of a holder's modifiers.
       */
      modifiers: z.array(characterGrantFoldModifierSchema).check(z.maxLength(500))
    })
    .check(
      z.superRefine((facts, ctx) => {
        if (Object.keys(facts.abilityScores).length === 0) {
          ctx.addIssue({
            code: 'custom',
            message: 'Creature rule facts require at least one normalized ability score.',
            path: ['abilityScores']
          })
        }
        if (!(facts.initiativeAbilityDefinitionId in facts.abilityScores)) {
          ctx.addIssue({
            code: 'custom',
            message: 'Creature initiative ability must reference a normalized ability score.',
            path: ['initiativeAbilityDefinitionId']
          })
        }
      })
    )
)

const encounterActorRuleFactSchema = lazySchema(() =>
  z
    .strictObject({
      actorId: z.string().check(z.uuid()),
      /** Immutable Blueprint-compiled UUID facts; legacy ability-code payloads never reach rules. */
      abilityScores: z.record(serverUuidIdentityDtoSchema, z.number()),
      /** Immutable Blueprint-compiled UUID check totals; codes and labels are never evaluated. */
      checkTotals: z._default(z.record(serverUuidIdentityDtoSchema, z.number().check(z.int())), {}),
      /** Immutable proficiency bonus per proficient save, keyed by ability definition. */
      saveProficiencyBonuses: z.record(serverUuidIdentityDtoSchema, z.number().check(z.int())),
      resourceAbilityScores: z.optional(z.partialRecord(systemCoreCodeSchema, z.number())),
      initiativeAbilityDefinitionId: z.optional(z.nullable(serverUuidIdentityDtoSchema)),
      vocabularySnapshot: z.optional(
        z.nullable(
          z.strictObject({
            id: serverUuidIdentityDtoSchema,
            version: z.number().check(z.int()).check(z.positive()),
            checksum: z.string().check(z.regex(/^[a-f0-9]{64}$/))
          })
        )
      ),
      targetProtection: encounterActorTargetProtectionSchema,
      featureResources: z
        .array(encounterActorFeatureResourceFactSchema)
        .check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems))
    })
    .check(
      z.superRefine((actor, ctx) => {
        const featureIds = new Set<string>()
        actor.featureResources.forEach((feature, index) => {
          if (featureIds.has(feature.featureId)) {
            ctx.addIssue({
              code: 'custom',
              message: `Feature resource ID "${feature.featureId}" is duplicated.`,
              path: ['featureResources', index, 'featureId']
            })
          }
          featureIds.add(feature.featureId)
        })
      })
    )
)

export const encounterActorRuleInputSchema = lazySchema(() =>
  z
    .strictObject({
      contractVersion: z.literal(1),
      actors: z
        .array(encounterActorRuleFactSchema)
        .check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems))
    })
    .check(
      z.superRefine((input, ctx) => {
        const actorIds = new Set<string>()
        input.actors.forEach((actor, index) => {
          if (actorIds.has(actor.actorId)) {
            ctx.addIssue({
              code: 'custom',
              message: `Encounter actor ID "${actor.actorId}" is duplicated.`,
              path: ['actors', index, 'actorId']
            })
          }
          actorIds.add(actor.actorId)
        })
      })
    )
)

const encounterActorFeatureResourceResultSchema = lazySchema(() =>
  z
    .strictObject({
      featureId: authoredIdentifierSchema,
      maximum: z.nullable(
        z.number().check(z.int()).check(z.gte(0)).check(z.lte(Number.MAX_SAFE_INTEGER))
      ),
      reconciliationPolicy: z.nullable(encounterActorResourceReconciliationPolicySchema),
      rawUsed: z.number().check(z.int()).check(z.gte(0)).check(z.lte(Number.MAX_SAFE_INTEGER)),
      used: z.number().check(z.int()).check(z.gte(0)).check(z.lte(Number.MAX_SAFE_INTEGER)),
      remaining: z.nullable(
        z.number().check(z.int()).check(z.gte(0)).check(z.lte(Number.MAX_SAFE_INTEGER))
      ),
      resetKind: z.nullable(chargeResetKindSchema)
    })
    .check(
      z.superRefine((resource, ctx) => {
        const finite = resource.maximum !== null
        const complete =
          resource.reconciliationPolicy !== null &&
          resource.remaining !== null &&
          resource.resetKind !== null
        const absent =
          resource.reconciliationPolicy === null &&
          resource.remaining === null &&
          resource.resetKind === null
        if (finite ? !complete : !absent) {
          ctx.addIssue({
            code: 'custom',
            message: 'Encounter feature resource finite state is incomplete.'
          })
        }
      })
    )
)

const encounterActorRuleResultSchema = lazySchema(() =>
  z
    .strictObject({
      actorId: z.string().check(z.uuid()),
      initiativeModifier: z.number().check(z.int()),
      savingThrowDefinitions: z.optional(
        z
          .array(
            z.strictObject({
              abilityDefinitionId: serverUuidIdentityDtoSchema,
              modifier: z.number().check(z.int()),
              rollMode: z.literal('NORMAL'),
              contributors: z.array(z.never()).check(z.maxLength(0))
            })
          )
          .check(z.maxLength(16))
      ),
      targetProtection: encounterActorTargetProtectionSchema,
      featureResources: z
        .array(encounterActorFeatureResourceResultSchema)
        .check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems))
    })
    .check(
      z.superRefine((actor, ctx) => {
        const savingThrowIds = new Set<string>()
        let priorSavingThrowId = ''
        actor.savingThrowDefinitions?.forEach((savingThrow, index) => {
          if (
            savingThrowIds.has(savingThrow.abilityDefinitionId) ||
            savingThrow.abilityDefinitionId <= priorSavingThrowId
          ) {
            ctx.addIssue({
              code: 'custom',
              message: 'Encounter saving-throw definitions must be unique and canonically ordered.',
              path: ['savingThrowDefinitions', index, 'abilityDefinitionId']
            })
          }
          savingThrowIds.add(savingThrow.abilityDefinitionId)
          priorSavingThrowId = savingThrow.abilityDefinitionId
        })
        const resourceIds = new Set<string>()
        actor.featureResources.forEach((resource, index) => {
          if (resourceIds.has(resource.featureId)) {
            ctx.addIssue({
              code: 'custom',
              message: `Encounter feature resource ID "${resource.featureId}" is duplicated.`,
              path: ['featureResources', index, 'featureId']
            })
          }
          resourceIds.add(resource.featureId)
        })
      })
    )
)

export const encounterActorRuleOutputSchema = lazySchema(() =>
  z
    .strictObject({
      actors: z
        .array(encounterActorRuleResultSchema)
        .check(z.maxLength(AUTHORED_LIMITS.nestedCollectionItems))
    })
    .check(
      z.superRefine((output, ctx) => {
        const actorIds = new Set<string>()
        output.actors.forEach((actor, index) => {
          if (actorIds.has(actor.actorId)) {
            ctx.addIssue({
              code: 'custom',
              message: `Encounter actor ID "${actor.actorId}" is duplicated.`,
              path: ['actors', index, 'actorId']
            })
          }
          actorIds.add(actor.actorId)
        })
      })
    )
)

export type EncounterActorRuleInput = z.infer<typeof encounterActorRuleInputSchema>
export type EncounterActorRuleOutput = z.infer<typeof encounterActorRuleOutputSchema>
export type EncounterCreatureRuleFactsSnapshot = z.infer<
  typeof encounterCreatureRuleFactsSnapshotSchema
>
export type EncounterActorRuleResult = z.infer<typeof encounterActorRuleResultSchema>
export type EncounterActorFeatureResourceResult = z.infer<
  typeof encounterActorFeatureResourceResultSchema
>
