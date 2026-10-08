import { z, lazySchema } from '../zod.js'
import { characterStateDtoSchema } from '../subjects/characterState.js'
import { characterSheetStateSchema } from './characterSheetState.js'

/**
 * The Character fields that change during play, split from the Builder-owned structure so a play
 * write touches one small record (ADR 0035 Amendment 12). Exactly these fields are what the room
 * holds and checkpoints for a Character:
 * - hit points (current, temporary, hit dice), inspiration, class and other resources, spell slots,
 *   conditions and exhaustion, from `state`;
 * - the equipped and attuned item ids (item-use state), from `state.equipment`;
 * - resource usage and party visibility, from the Sheet state.
 * Everything else stays in the Character document and Sheet state.
 */
export const characterPlayStateSchema = lazySchema(() => {
  const { hitpoints, inspiration, resources, spellSlots, conditions, exhaustion, equipment } =
    characterStateDtoSchema.shape
  const { resourceUsage, partyVisibility } = characterSheetStateSchema.shape
  return z.strictObject({
    hitpoints,
    inspiration,
    resources,
    spellSlots,
    conditions,
    exhaustion,
    equipped: equipment.shape.equipped,
    attuned: equipment.shape.attuned,
    resourceUsage,
    partyVisibility
  })
})

/** The Character `state` without its play fields. */
export const characterStructureStateSchema = lazySchema(() =>
  z.extend(
    z.omit(characterStateDtoSchema, {
      hitpoints: true,
      inspiration: true,
      resources: true,
      spellSlots: true,
      conditions: true,
      exhaustion: true,
      equipment: true
    }),
    {
      equipment: z.omit(characterStateDtoSchema.shape.equipment, { equipped: true, attuned: true })
    }
  )
)

/** The Sheet state without its play fields. */
export const characterSheetStructureSchema = lazySchema(() =>
  z.omit(characterSheetStateSchema, { resourceUsage: true, partyVisibility: true })
)

export type CharacterPlayState = z.infer<typeof characterPlayStateSchema>
type CharacterStructureState = z.infer<typeof characterStructureStateSchema>
export type CharacterSheetStructure = z.infer<typeof characterSheetStructureSchema>
type CharacterState = z.infer<typeof characterStateDtoSchema>
type CharacterSheetState = z.infer<typeof characterSheetStateSchema>

/** The play-bearing state of one Character, as the Sheet and the rules read it. */
export interface CharacterPersistedState {
  state: CharacterState
  sheetState: CharacterSheetState
}

/** The same state divided into its Builder-owned structure and its play record. */
interface CharacterSplitState {
  structure: { state: CharacterStructureState; sheetState: CharacterSheetStructure }
  play: CharacterPlayState
}

/** The play fields that live in the Character `state`. */
type CharacterStatePlay = Omit<CharacterPlayState, 'resourceUsage' | 'partyVisibility'>
/** The play fields that live in the Sheet state. */
type CharacterSheetStatePlay = Pick<CharacterPlayState, 'resourceUsage' | 'partyVisibility'>

/** Divides a Character `state` into its structure and the play fields it carries. Pure. */
export function splitCharacterStatePlay(state: CharacterState): {
  structure: CharacterStructureState
  play: CharacterStatePlay
} {
  const {
    hitpoints,
    inspiration,
    resources,
    spellSlots,
    conditions,
    exhaustion,
    equipment,
    ...structure
  } = state
  const { equipped, attuned, ...structureEquipment } = equipment
  return {
    structure: { ...structure, equipment: structureEquipment },
    // Absent optional fields stay absent: canonical JSON has no `undefined`.
    play: {
      hitpoints,
      ...(inspiration === undefined ? {} : { inspiration }),
      ...(resources === undefined ? {} : { resources }),
      ...(spellSlots === undefined ? {} : { spellSlots }),
      ...(conditions === undefined ? {} : { conditions }),
      ...(exhaustion === undefined ? {} : { exhaustion }),
      equipped,
      attuned
    }
  }
}

/** The inverse of `splitCharacterStatePlay`: the Character `state` from its structure and play. */
export function mergeCharacterStatePlay(
  structure: CharacterStructureState,
  play: CharacterStatePlay
): CharacterState {
  const {
    hitpoints,
    inspiration,
    resources,
    spellSlots,
    conditions,
    exhaustion,
    equipped,
    attuned
  } = play
  // Named, not spread: a caller may hold the whole play record, whose Sheet fields are not state.
  return {
    ...structure,
    hitpoints,
    ...(inspiration === undefined ? {} : { inspiration }),
    ...(resources === undefined ? {} : { resources }),
    ...(spellSlots === undefined ? {} : { spellSlots }),
    ...(conditions === undefined ? {} : { conditions }),
    ...(exhaustion === undefined ? {} : { exhaustion }),
    equipment: { ...structure.equipment, equipped, attuned }
  }
}

/** Divides a Sheet state into its structure and its play fields. Pure. */
function splitCharacterSheetStatePlay(sheetState: CharacterSheetState): {
  structure: CharacterSheetStructure
  play: CharacterSheetStatePlay
} {
  const { resourceUsage, partyVisibility, ...structure } = sheetState
  return { structure, play: { resourceUsage, partyVisibility } }
}

/** The inverse of `splitCharacterSheetStatePlay`: the Sheet state from its structure and play. */
export function mergeCharacterSheetStatePlay(
  structure: CharacterSheetStructure,
  play: CharacterSheetStatePlay
): CharacterSheetState {
  return { ...structure, resourceUsage: play.resourceUsage, partyVisibility: play.partyVisibility }
}

/** Divides a Character's state and Sheet state into structure and play. Pure. */
export function splitCharacterPlayState({
  state,
  sheetState
}: CharacterPersistedState): CharacterSplitState {
  const statePart = splitCharacterStatePlay(state)
  const sheetPart = splitCharacterSheetStatePlay(sheetState)
  return {
    structure: { state: statePart.structure, sheetState: sheetPart.structure },
    play: { ...statePart.play, ...sheetPart.play }
  }
}
