import { describe, expect, it } from 'vitest'
import { encounterCommandInputDtoSchema } from '../api/encounters.js'
import { characterSheetCommandInputDtoSchema } from '../api/characterSheetCommandInputs.js'
import {
  ROOM_CHARACTER_PLAY_COMMAND_TYPES,
  isCharacterSheetLivePlayCommand
} from '../api/characterSheetLiveCommands.js'
import { concentrationListingDtoSchema } from '../shared/activeGrantListing.js'
import { concentrationEndDtoSchema } from '../shared/ruleExecutionEncounterApplications.js'

/** SPELLS-5.11: the contracts a chosen Concentration end crosses. */

const id = (suffix: number) => `00000000-0000-4000-8000-${String(suffix).padStart(12, '0')}`

describe('Concentration end receipts', () => {
  const end = {
    ownerActorId: id(1),
    maintainedStateId: id(2),
    cleanup: {
      maintainedStateId: id(2),
      removedDependentEffectIds: [],
      characterOwnerTransitions: []
    }
  }

  it('records a chosen end alongside the involuntary ones', () => {
    for (const reason of ['INCAPACITATED', 'DEFEATED', 'CHOSEN'])
      expect(concentrationEndDtoSchema.safeParse({ ...end, reason }).success).toBe(true)
    expect(concentrationEndDtoSchema.safeParse({ ...end, reason: 'DROPPED' }).success).toBe(false)
  })
})

describe('END_CONCENTRATION Sheet command', () => {
  const command = { type: 'END_CONCENTRATION', commandId: id(3), expectedVersion: 4 }

  it('takes a command id and the expected stream version, and nothing else', () => {
    expect(characterSheetCommandInputDtoSchema.safeParse(command).success).toBe(true)
    expect(
      characterSheetCommandInputDtoSchema.safeParse({ ...command, commandId: 'x' }).success
    ).toBe(false)
    expect(
      characterSheetCommandInputDtoSchema.safeParse({ ...command, expectedVersion: undefined })
        .success
    ).toBe(false)
  })

  it('is a live play command, so a held Character ends it through the room', () => {
    expect(ROOM_CHARACTER_PLAY_COMMAND_TYPES).toContain('END_CONCENTRATION')
    const parsed = characterSheetCommandInputDtoSchema.parse(command)
    expect(isCharacterSheetLivePlayCommand(parsed)).toBe(true)
  })
})

describe('UPDATE_ACTOR endConcentration', () => {
  const update = {
    type: 'UPDATE_ACTOR',
    encounterId: id(5),
    commandId: id(6),
    expectedVersion: 1,
    actorId: id(7)
  }

  it('accepts only the literal true', () => {
    expect(
      encounterCommandInputDtoSchema.safeParse({ ...update, endConcentration: true }).success
    ).toBe(true)
    expect(
      encounterCommandInputDtoSchema.safeParse({ ...update, endConcentration: false }).success
    ).toBe(false)
  })
})

describe('Concentration listing', () => {
  it('names the Concentration, or only that a hidden source maintains it', () => {
    expect(concentrationListingDtoSchema.parse({ label: ' Bless ', sourceHidden: false })).toEqual({
      label: 'Bless',
      sourceHidden: false
    })
    expect(
      concentrationListingDtoSchema.safeParse({ label: null, sourceHidden: true }).success
    ).toBe(true)
  })

  it('refuses an empty label and unknown fields', () => {
    expect(
      concentrationListingDtoSchema.safeParse({ label: '  ', sourceHidden: false }).success
    ).toBe(false)
    expect(
      concentrationListingDtoSchema.safeParse({ label: null, sourceHidden: true, spellId: id(8) })
        .success
    ).toBe(false)
  })
})
