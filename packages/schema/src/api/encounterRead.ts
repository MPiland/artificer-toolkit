import { z, lazySchema } from '../zod.js'
import {
  encounterActionChoicesResponseDtoSchema,
  encounterActionItemChoicesDtoSchema,
  encounterHeldRelationshipDtoSchema,
  encounterOptionalActionChoicesDtoSchema,
  getEncounterActionChoicesInputDtoSchema,
  getEncounterActionItemChoicesInputDtoSchema,
  getEncounterOptionalActionChoicesInputDtoSchema
} from './encounterActionChoices.js'
import {
  encounterActionTargetModifiersDtoSchema,
  getEncounterActionTargetModifiersInputDtoSchema
} from './encounterActionTargetModifiers.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { encounterEvidenceRollDtoSchema, getEncounterInputDtoSchema } from './encounterData.js'
import { sceneEncounterBindingInputSchema, sceneEncounterBindingSchema } from './sceneRecipient.js'
import { encounterSceneActorTokenBindingDtoSchema } from './vttScenes.js'

/**
 * A version-keyed read the live room answers from its own Encounter state instead of Convex, at
 * the room's current version: the same inputs as the Convex query, less `expectedVersion`.
 */
export const encounterReadDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ACTION_CHOICES'),
      input: z.omit(getEncounterActionChoicesInputDtoSchema, { expectedVersion: true })
    }),
    z.strictObject({
      kind: z.literal('OPTIONAL_ACTION_CHOICES'),
      input: z.omit(getEncounterOptionalActionChoicesInputDtoSchema, { expectedVersion: true })
    }),
    z.strictObject({
      kind: z.literal('ACTION_ITEM_CHOICES'),
      input: z.omit(getEncounterActionItemChoicesInputDtoSchema, { expectedVersion: true })
    }),
    z.strictObject({
      kind: z.literal('ACTION_TARGET_MODIFIERS'),
      input: z.omit(getEncounterActionTargetModifiersInputDtoSchema, { expectedVersion: true })
    }),
    z.strictObject({ kind: z.literal('LATEST_EVIDENCE_ROLLS'), input: getEncounterInputDtoSchema }),
    z.strictObject({ kind: z.literal('HELD_RELATIONSHIPS'), input: getEncounterInputDtoSchema }),
    z.strictObject({ kind: z.literal('SCENE_BINDING'), input: sceneEncounterBindingInputSchema }),
    z.strictObject({
      kind: z.literal('ACTOR_TOKEN_BINDINGS'),
      input: sceneEncounterBindingInputSchema
    })
  ])
)

/** The answer to an `EncounterReadDto`, tagged with the read it answers. */
export const encounterReadResultDtoSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('ACTION_CHOICES'),
      result: encounterActionChoicesResponseDtoSchema
    }),
    z.strictObject({
      kind: z.literal('OPTIONAL_ACTION_CHOICES'),
      result: encounterOptionalActionChoicesDtoSchema
    }),
    z.strictObject({
      kind: z.literal('ACTION_ITEM_CHOICES'),
      result: encounterActionItemChoicesDtoSchema
    }),
    z.strictObject({
      kind: z.literal('ACTION_TARGET_MODIFIERS'),
      result: encounterActionTargetModifiersDtoSchema
    }),
    z.strictObject({
      kind: z.literal('LATEST_EVIDENCE_ROLLS'),
      result: z.array(encounterEvidenceRollDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('HELD_RELATIONSHIPS'),
      /** The holds the requester's creatures source; every hold for the GM. */
      result: z.array(encounterHeldRelationshipDtoSchema).check(z.maxLength(MAX_ENCOUNTER_ACTORS))
    }),
    z.strictObject({
      kind: z.literal('SCENE_BINDING'),
      result: z.nullable(sceneEncounterBindingSchema)
    }),
    z.strictObject({
      kind: z.literal('ACTOR_TOKEN_BINDINGS'),
      /** The actor behind each Scene token the reader can see, and no other. */
      result: z.array(encounterSceneActorTokenBindingDtoSchema)
    })
  ])
)

export type EncounterReadDto = z.infer<typeof encounterReadDtoSchema>
export type EncounterReadResultDto = z.infer<typeof encounterReadResultDtoSchema>
