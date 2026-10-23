import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { projectionChecksumSchema } from './identity.js'
import { receiptLedgerPointerSchema } from './receiptLedgerPersistence.js'

const encounterRunCommandHeaderBaseSchema = lazySchema(() =>
  z.extend(receiptLedgerPointerSchema, {
    campaignId: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    commandFingerprint: projectionChecksumSchema,
    actorUserId: postgresUuidSchema,
    createdAt: z.iso.datetime(),
    visibility: z.optional(z.enum(['PRIVATE', 'TABLE']))
  })
)

export const encounterRunCommandHeaderSchema = lazySchema(() =>
  z.discriminatedUnion('commandType', [
    z.extend(encounterRunCommandHeaderBaseSchema, {
      commandType: z.literal('CREATE'),
      id: z.optional(postgresUuidSchema),
      version: z.optional(z.literal(0))
    }),
    z.extend(encounterRunCommandHeaderBaseSchema, {
      id: postgresUuidSchema,
      version: z.number().check(z.int()).check(z.positive()),
      commandType: z.enum([
        'UPSERT_REMINDER',
        'REMOVE_REMINDER',
        'SET_INITIATIVE',
        'ROLL_ACTOR_INITIATIVE',
        'ROLL_ENEMY_ACTION',
        'ADJUST_FEATURE_RESOURCE',
        'CREATURE_REST',
        'REPLACE_OPTIONAL_COMBAT_RULES',
        'SET_HEALTH_DISPLAY_DEFAULT',
        'COMPLETE',
        'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
        'START',
        'ADVANCE_TURN',
        'MOVE_SCENE_TOKEN',
        'RESOLVE_RULE_OCCURRENCE',
        'RESOLVE_ACTION',
        'ESCAPE',
        'SET_CONCEALMENT_OBSERVERS',
        'END_HELD_GRANT',
        'MOVE_HELD_EFFECT',
        'RELEASE_RELATIONSHIP',
        'RELATIONSHIPS_ENDED',
        'CONCENTRATION_DROPPED_OUTSIDE',
        'RETURNED_TO_PLAY',
        'VOID_RULE_OCCURRENCE',
        'REVERT_LAST_ACTION',
        'UPDATE_ACTOR',
        'REMOVE_ACTOR',
        'REORDER',
        'REINFORCE',
        'REPLACE_CREATURE_EQUIPMENT',
        'PREVIOUS_TURN',
        'SET_CURRENT_ACTOR',
        'SET_ROUND'
      ])
    })
  ])
)

export const encounterRuleReceiptHeaderSchema = lazySchema(() =>
  z.extend(receiptLedgerPointerSchema, {
    id: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    encounterId: postgresUuidSchema,
    occurrenceId: postgresUuidSchema,
    commandId: postgresUuidSchema,
    commandType: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(80)),
    commandFingerprint: projectionChecksumSchema,
    encounterVersion: z.number().check(z.int()).check(z.nonnegative()),
    actorUserId: postgresUuidSchema,
    createdAt: z.iso.datetime()
  })
)

const characterUuidSchema = lazySchema(() =>
  z.pipe(
    z.uuid(),
    z.transform((value) => value.toLowerCase())
  )
)

export const characterCommandReceiptHeaderSchema = lazySchema(() =>
  z.extend(receiptLedgerPointerSchema, {
    id: characterUuidSchema,
    characterId: characterUuidSchema,
    commandId: characterUuidSchema,
    actorId: characterUuidSchema,
    commandFingerprint: projectionChecksumSchema,
    occurredAt: z.iso.datetime()
  })
)

export const receiptHeaderSchemas = {
  encounterRunCommands: encounterRunCommandHeaderSchema,
  encounterRuleReceipts: encounterRuleReceiptHeaderSchema,
  characterCommandReceipts: characterCommandReceiptHeaderSchema
}
export type ReceiptHeaderTable = keyof typeof receiptHeaderSchemas
export type ReceiptHeaderDocuments = {
  [Table in ReceiptHeaderTable]: z.infer<(typeof receiptHeaderSchemas)[Table]>
}
