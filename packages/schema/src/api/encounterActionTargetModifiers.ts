import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { resolveEncounterActionInputDtoSchema } from './encounterRuleCommands.js'
import { rollModeKeepSchema, systemVocabularyCodeSchema } from '../shared/systemVocabularyCode.js'

const versionSchema = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))

/**
 * Asks what each creature the viewer can see would add to the acting creature's attack with one
 * action, while the viewer picks a target on the map or in the list.
 */
export const getEncounterActionTargetModifiersInputDtoSchema = lazySchema(() =>
  z.extend(
    z.pick(resolveEncounterActionInputDtoSchema, {
      encounterId: true,
      expectedVersion: true,
      actorId: true,
      actionId: true
    }),
    {
      /** The presented Scene the Encounter is bound to; null when there is none to measure on. */
      scene: z.nullable(
        z.strictObject({ sceneId: postgresUuidSchema, expectedSceneVersion: versionSchema })
      )
    }
  )
)
export type GetEncounterActionTargetModifiersInputDto = z.infer<
  typeof getEncounterActionTargetModifiersInputDtoSchema
>

/**
 * What the acting Character believes about attacking one creature (ATTACK-10.1, D100): the d20
 * mode their own facts imply and the player-safe reasons, never the true mode before the roll.
 */
export const encounterActionTargetModifiersDtoSchema = lazySchema(() =>
  z.strictObject({
    encounterId: postgresUuidSchema,
    encounterVersion: versionSchema,
    actorId: postgresUuidSchema,
    actionId: resolveEncounterActionInputDtoSchema.shape.actionId,
    targets: z.array(
      z.strictObject({
        actorId: postgresUuidSchema,
        /** Null when the action makes no attack roll against this creature. */
        attack: z.nullable(
          z.strictObject({
            rollMode: systemVocabularyCodeSchema,
            /** The System's display label for `rollMode`, so no client keeps a mode table. */
            rollModeLabel: z.string().check(z.minLength(1)).check(z.maxLength(80)),
            keep: rollModeKeepSchema,
            reasons: z
              .array(z.string().check(z.minLength(1)).check(z.maxLength(160)))
              .check(z.maxLength(32))
          })
        )
      })
    )
  })
)
export type EncounterActionTargetModifiersDto = z.infer<
  typeof encounterActionTargetModifiersDtoSchema
>
