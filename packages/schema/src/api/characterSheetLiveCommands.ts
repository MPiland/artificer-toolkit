import { z, lazySchema } from '../zod.js'
import {
  characterSheetCommandInputDtoSchema,
  type CharacterSheetCommandInputDto
} from './characterSheetCommandInputs.js'
import { characterSheetReadInputSchema } from './characterSheetData.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'

export const characterSheetLiveAuthorityReadInputSchema = lazySchema(() =>
  z.extend(characterSheetReadInputSchema, { campaignId: z.optional(postgresUuidSchema) })
)

/** Focused routing/checkpoint metadata; live play versions come from the room. */
export const characterSheetLiveAuthorityDtoSchema = lazySchema(() =>
  z.strictObject({
    characterId: postgresUuidSchema,
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema,
    phase: z.enum(['ACTIVATING', 'DO_ACTIVE', 'DRAINING']),
    encounterIds: z.array(postgresUuidSchema).check(z.minLength(1)),
    checkpointSequence: z.number().check(z.int()).check(z.nonnegative()),
    checkpointedAt: z.nullable(z.iso.datetime({ offset: true })),
    checkpointStreamVersion: z.number().check(z.int()).check(z.nonnegative())
  })
)

export type CharacterSheetLiveAuthorityDto = z.infer<typeof characterSheetLiveAuthorityDtoSchema>

/** The live Encounter whose room ends a caster's Concentration that Characters it holds still carry. */
export const characterConcentrationRoomRouteDtoSchema = lazySchema(() =>
  z.strictObject({ campaignId: postgresUuidSchema, encounterId: postgresUuidSchema })
)

export type CharacterConcentrationRoomRouteDto = z.infer<
  typeof characterConcentrationRoomRouteDtoSchema
>

/** Exactly the typed CharacterPlayState commands held by a live Run (ADR 0035). */
export const ROOM_CHARACTER_PLAY_COMMAND_TYPES = [
  'SET_INSPIRATION',
  'SET_PARTY_VISIBILITY',
  'SET_HIT_POINTS',
  'ADJUST_HIT_POINTS',
  'USE_HIT_DIE',
  'SET_DEATH_SAVES',
  'ROLL_DEATH_SAVE',
  'SET_EXHAUSTION',
  'ADD_CONDITION',
  'REMOVE_CONDITION',
  'REMOVE_CONSEQUENCE',
  'USE_RESOURCE',
  'RESTORE_RESOURCE',
  'USE_SHEET_RESOURCE',
  'RECOVER_SHEET_RESOURCE',
  'END_ACTIVE_EFFECT',
  'END_CONCENTRATION',
  'USE_SPELL_SLOT',
  'RESTORE_SPELL_SLOT',
  'EXCHANGE_SPELL_SLOTS',
  'CAST_SPELL',
  'EQUIP_ITEM',
  'UNEQUIP_ITEM',
  'SWAP_HELD_ITEMS',
  'ATTUNE_ITEM',
  'UNATTUNE_ITEM'
] as const satisfies readonly CharacterSheetCommandInputDto['type'][]

export type CharacterSheetLivePlayCommand = Extract<
  CharacterSheetCommandInputDto,
  { type: (typeof ROOM_CHARACTER_PLAY_COMMAND_TYPES)[number] }
>

export function isCharacterSheetLivePlayCommand(
  command: CharacterSheetCommandInputDto
): command is CharacterSheetLivePlayCommand {
  return (
    ROOM_CHARACTER_PLAY_COMMAND_TYPES.some((type) => type === command.type) &&
    // Maximum overrides are Sheet adjustments, outside the room-owned play record.
    (command.type !== 'SET_HIT_POINTS' || command.maxOverride === undefined)
  )
}

export const characterSheetLivePlayCommandSchema = lazySchema(() =>
  z.pipe(
    characterSheetCommandInputDtoSchema,
    z.transform((command, context) => {
      if (!isCharacterSheetLivePlayCommand(command)) {
        context.issues.push({
          code: 'custom',
          input: command,
          message: 'This command is not a live play-state command.'
        })
        return z.NEVER
      }
      return command
    })
  )
)
