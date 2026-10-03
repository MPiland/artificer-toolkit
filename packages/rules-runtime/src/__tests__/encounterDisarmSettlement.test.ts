import { describe, expect, it } from 'vitest'
import type { ServerOptionalCombatContestPendingApplicationContextDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import { baseEquipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { createEmptyCharacterAuthored } from '@artificer-toolkit/shared/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { club } from '@artificer-toolkit/source-data/srd/equipment/club.js'
import { dagger } from '@artificer-toolkit/source-data/srd/equipment/dagger.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { SRD_SYSTEM_ID } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { readEncounterActorOptionalContestContext } from '../encounterActorOptionalContestContext.js'
import {
  disarmApplicationOutputs,
  disarmSourceWins,
  planEncounterDisarmSuccess
} from '../encounterDisarmPreparation.js'
import { prepareDnd5eOptionalCombatContestPendingContext } from '../systems/dnd5e/optionalCombatContestPendingContext.js'
import { characterActor, creatureActor, creatureRuleFacts } from '../testing/dnd5eSrdEncounter.js'

const SOURCE_ACTOR_ID = '00000000-0000-4000-8000-00000000d101'
const TARGET_ACTOR_ID = '00000000-0000-4000-8000-00000000d102'
const TARGET_CHARACTER_ID = '00000000-0000-4000-8000-00000000d103'
const HELD_ENTRY_ID = '00000000-0000-4000-8000-00000000d104'
const CARRIED_ENTRY_ID = '00000000-0000-4000-8000-00000000d105'
const DEFENDER_CHECK_ID = '00000000-0000-4000-8000-00000000d106'
const SOURCE_VERSION_ID = '00000000-0000-4000-8000-00000000d107'
const OCCURRENCE_ID = '00000000-0000-4000-8000-00000000d108'
const HELD_ITEM_INSTANCE_ID = '00000000-0000-4000-8000-00000000d109'
const SHIELD_ITEM_INSTANCE_ID = '00000000-0000-4000-8000-00000000d10a'
const CHARACTER_STREAM_VERSION = 7

type Contest = ServerOptionalCombatContestPendingApplicationContextDto

const heldWeapon = baseEquipmentAuthoredDtoSchema.parse(dagger)
const carriedWeapon = baseEquipmentAuthoredDtoSchema.parse(club)

function equipmentSource(loadoutEntryId: string, payload: typeof heldWeapon) {
  return {
    loadoutEntryId,
    equipmentId: payload.id,
    sourceRevision: 1,
    sourceVersionId: SOURCE_VERSION_ID,
    sourceChecksum: checksumRuleDocument(payload),
    payload
  }
}

/** A Medium SRD Creature holding a dagger and carrying a club, as its Blueprint snapshot pins them. */
function creatureTarget(heldState: 'HELD' | 'CARRIED' = 'HELD') {
  return creatureActor({
    id: TARGET_ACTOR_ID,
    snapshot: {
      payload: {
        size: 'MEDIUM',
        equipmentLoadout: [
          {
            id: HELD_ENTRY_ID,
            equipmentId: heldWeapon.id,
            quantity: 1,
            useState: heldState,
            attuned: false,
            actionFeatureIds: []
          },
          {
            id: CARRIED_ENTRY_ID,
            equipmentId: carriedWeapon.id,
            quantity: 1,
            useState: 'CARRIED',
            attuned: false,
            actionFeatureIds: []
          }
        ]
      },
      ruleFacts: {
        ...creatureRuleFacts({
          STRENGTH: 11,
          DEXTERITY: 12,
          CONSTITUTION: 12,
          INTELLIGENCE: 10,
          WISDOM: 10,
          CHARISMA: 10
        }),
        checkTotals: { [DEFENDER_CHECK_ID]: 1 }
      },
      equipmentSources: [
        equipmentSource(HELD_ENTRY_ID, heldWeapon),
        equipmentSource(CARRIED_ENTRY_ID, carriedWeapon)
      ]
    }
  })
}

function targetCharacter(equipped: string[] = [HELD_ITEM_INSTANCE_ID, SHIELD_ITEM_INSTANCE_ID]) {
  const empty = createEmptyCharacterAuthored({
    id: TARGET_CHARACTER_ID,
    systemId: SRD_SYSTEM_ID,
    userId: '00000000-0000-4000-8000-00000000d10b'
  })
  return {
    id: TARGET_CHARACTER_ID,
    streamVersion: CHARACTER_STREAM_VERSION,
    document: {
      ...empty,
      state: {
        ...empty.state,
        equipment: {
          inventory: [
            { id: HELD_ITEM_INSTANCE_ID, equipmentId: heldWeapon.id, quantity: 1 },
            { id: SHIELD_ITEM_INSTANCE_ID, equipmentId: carriedWeapon.id, quantity: 1 }
          ],
          equipped,
          attuned: []
        }
      }
    }
  }
}

/** A sealed Disarm contest; the target arm and held-item pin come from the defender's facts. */
function disarmContest(input: {
  heldItemId: string
  heldItemStateChecksum: string
  target: Contest['target']
}): Contest {
  const contributors: Contest['initiator']['contributors'] = []
  return prepareDnd5eOptionalCombatContestPendingContext({
    actionKind: 'DISARM',
    actionId: 'disarm',
    sourceActorId: SOURCE_ACTOR_ID,
    targetActorId: TARGET_ACTOR_ID,
    initiatorControllerCharacterId: null,
    sceneContext: null,
    positionalDependencyChecksum: null,
    optionalCombat: {
      snapshotChecksum: '1'.repeat(64),
      definitionId: '00000000-0000-4000-8000-00000000d10c',
      definitionVersion: 1,
      definitionChecksum: '2'.repeat(64),
      moduleKey: 'd20.action.disarm',
      moduleContractVersion: 1
    },
    contestGraph: {
      definitionId: '00000000-0000-4000-8000-00000000d10d',
      checksum: '3'.repeat(64),
      identityChecksum: '4'.repeat(64)
    },
    optionId: '5'.repeat(64),
    selectionContractChecksum: '6'.repeat(64),
    resolvedSelectionChecksum: '7'.repeat(64),
    source: {
      kind: 'OPTIONAL_COMBAT_DEFINITION',
      definitionId: '00000000-0000-4000-8000-00000000d10c',
      definitionVersion: 1,
      definitionChecksum: '2'.repeat(64),
      moduleKey: 'd20.action.disarm',
      moduleContractVersion: 1
    },
    target: input.target,
    initiator: {
      actorId: SOURCE_ACTOR_ID,
      requestNodeId: 'initiator_d20',
      rollMode: 'NORMAL',
      contributors,
      contributorChecksum: checksumRuleDocument(contributors),
      modifier: 4
    },
    defender: {
      actorId: TARGET_ACTOR_ID,
      requestNodeId: 'target_d20',
      rollMode: 'NORMAL',
      contributors,
      contributorChecksum: checksumRuleDocument(contributors),
      modifier: 1,
      checkDefinitionId: DEFENDER_CHECK_ID
    },
    rollEvidence: { initiator: null, defender: null },
    selection: {
      kind: 'DISARM',
      heldItemId: input.heldItemId,
      defenderCheckDefinitionId: DEFENDER_CHECK_ID,
      heldItemStateChecksum: input.heldItemStateChecksum
    },
    actionEconomy: null
  })
}

function creatureContest() {
  const context = readEncounterActorOptionalContestContext({
    actor: creatureTarget(),
    loadoutEntryId: HELD_ENTRY_ID
  })
  if (!context) throw new Error('The fixture Creature must hold its dagger.')
  return disarmContest({
    heldItemId: HELD_ENTRY_ID,
    heldItemStateChecksum: context.stateChecksum,
    target: { kind: 'ENCOUNTER_ACTOR', currentnessChecksum: context.stateChecksum }
  })
}

function characterContest(overrides: { streamVersion?: number; stateChecksum?: string } = {}) {
  const character = targetCharacter()
  return disarmContest({
    heldItemId: HELD_ITEM_INSTANCE_ID,
    // A Character's settlement fences the equipped set through `target.stateChecksum` instead.
    heldItemStateChecksum: 'd'.repeat(64),
    target: {
      kind: 'CHARACTER',
      characterId: TARGET_CHARACTER_ID,
      streamVersion: overrides.streamVersion ?? CHARACTER_STREAM_VERSION,
      projectionChecksum: '8'.repeat(64),
      mechanicalContextChecksum: '9'.repeat(64),
      stateChecksum:
        overrides.stateChecksum ??
        checksumRuleDocument({
          itemId: HELD_ITEM_INSTANCE_ID,
          streamVersion: CHARACTER_STREAM_VERSION,
          equipped: character.document.state.equipment.equipped
        })
    }
  })
}

/** One NORMAL-mode contest d20 as a completed execution or stored receipt records it. */
function contestRoll(actorId: string, requestNodeId: string, face: number, modifier: number) {
  return {
    actorId,
    requestNodeId,
    rollMode: 'NORMAL' as const,
    rawFaces: [face],
    selectedNatural: face,
    contributors: [],
    contributorChecksum: checksumRuleDocument([]),
    modifier,
    total: face + modifier
  }
}

function rolls(initiatorFace: number, defenderFace: number) {
  return {
    initiator: contestRoll(SOURCE_ACTOR_ID, 'initiator_d20', initiatorFace, 4),
    defender: contestRoll(TARGET_ACTOR_ID, 'target_d20', defenderFace, 1)
  }
}

const actionEconomy = {
  definitionId: SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  definitionVersion: 3,
  definitionChecksum: 'c'.repeat(64),
  maximum: 1,
  beforeUsed: 0,
  afterUsed: 1
}

describe('Disarm contest winner', () => {
  // SRD 5.1 Contests: a tie leaves the situation as it was, so the defender keeps the item.
  it.each([
    { initiator: 16, defender: 15, wins: true },
    { initiator: 15, defender: 15, wins: false },
    { initiator: 14, defender: 15, wins: false }
  ])(
    'initiator $initiator vs defender $defender: source wins is $wins',
    ({ initiator, defender, wins }) => {
      expect(
        disarmSourceWins({ initiator: { total: initiator }, defender: { total: defender } })
      ).toBe(wins)
    }
  )

  it('compares totals, not natural faces', () => {
    // Natural 10 + 4 = 14 beats natural 12 + 1 = 13.
    expect(disarmSourceWins(rolls(10, 12))).toBe(true)
    // Natural 9 + 4 = 13 ties natural 12 + 1 = 13.
    expect(disarmSourceWins(rolls(9, 12))).toBe(false)
  })
})

describe('Disarm settlement plan', () => {
  it('moves a Creature held item to carried in its Run loadout, leaving every other entry', () => {
    const target = creatureTarget()
    const contest = creatureContest()
    const before = readEncounterActorOptionalContestContext({
      actor: target,
      loadoutEntryId: HELD_ENTRY_ID
    })
    if (!before) throw new Error('The fixture Creature must hold its dagger.')
    const planned = planEncounterDisarmSuccess({ target, contest, character: null })
    const expectedLoadout = [
      {
        id: HELD_ENTRY_ID,
        equipmentId: heldWeapon.id,
        quantity: 1,
        useState: 'CARRIED',
        attuned: false,
        actionFeatureIds: []
      },
      {
        id: CARRIED_ENTRY_ID,
        equipmentId: carriedWeapon.id,
        quantity: 1,
        useState: 'CARRIED',
        attuned: false,
        actionFeatureIds: []
      }
    ]
    if (
      typeof target.snapshot !== 'object' ||
      target.snapshot === null ||
      Array.isArray(target.snapshot)
    )
      throw new Error('The fixture Creature snapshot must be an object.')
    expect(planned).toEqual({
      kind: 'CREATURE',
      actor: {
        ...target,
        snapshot: { ...target.snapshot, equipmentLoadoutOverride: expectedLoadout }
      },
      stateTransition: {
        kind: 'ENCOUNTER_ACTOR_ITEM_USE_STATE',
        actorId: TARGET_ACTOR_ID,
        loadoutEntryId: HELD_ENTRY_ID,
        equipmentId: heldWeapon.id,
        fromState: 'HELD',
        toState: 'CARRIED',
        beforeStateChecksum: before.stateChecksum,
        afterStateChecksum: checksumRuleDocument({
          actorId: TARGET_ACTOR_ID,
          equipment: { ...before.equipment, state: 'CARRIED' },
          ruleFacts: before.ruleFacts,
          size: 'MEDIUM'
        })
      }
    })
    // The planned actor no longer holds the item, so a second settlement is refused.
    if (planned.kind !== 'CREATURE') throw new Error('Expected a Creature settlement.')
    expect(() =>
      planEncounterDisarmSuccess({ target: planned.actor, contest, character: null })
    ).toThrow('Disarm Creature item changed before settlement.')
  })

  it('refuses a Creature whose held item changed after the contest was sealed', () => {
    expect(() =>
      planEncounterDisarmSuccess({
        target: creatureTarget('CARRIED'),
        contest: creatureContest(),
        character: null
      })
    ).toThrow('Disarm Creature item changed before settlement.')
    const stale = disarmContest({
      heldItemId: HELD_ENTRY_ID,
      heldItemStateChecksum: 'e'.repeat(64),
      target: { kind: 'ENCOUNTER_ACTOR', currentnessChecksum: 'e'.repeat(64) }
    })
    expect(() =>
      planEncounterDisarmSuccess({ target: creatureTarget(), contest: stale, character: null })
    ).toThrow('Disarm Creature item changed before settlement.')
  })

  it("unequips a Character's held item on its Sheet in the next stream version", () => {
    const character = targetCharacter()
    const planned = planEncounterDisarmSuccess({
      target: characterActor({ id: TARGET_ACTOR_ID, characterId: TARGET_CHARACTER_ID }),
      contest: characterContest(),
      character
    })
    const nextEquipment = {
      ...character.document.state.equipment,
      equipped: [SHIELD_ITEM_INSTANCE_ID]
    }
    expect(planned).toEqual({
      kind: 'CHARACTER',
      character: {
        ...character.document,
        state: { ...character.document.state, equipment: nextEquipment }
      },
      stateTransition: {
        kind: 'CHARACTER_ITEM_USE_STATE',
        characterId: TARGET_CHARACTER_ID,
        itemInstanceId: HELD_ITEM_INSTANCE_ID,
        fromState: 'EQUIPPED',
        toState: 'CARRIED',
        beforeStreamVersion: CHARACTER_STREAM_VERSION,
        afterStreamVersion: CHARACTER_STREAM_VERSION + 1,
        beforeStateChecksum: checksumRuleDocument(character.document.state.equipment),
        afterStateChecksum: checksumRuleDocument(nextEquipment)
      }
    })
    // The item stays in inventory; only its equipped state changes.
    if (planned.kind !== 'CHARACTER') throw new Error('Expected a Character settlement.')
    expect(planned.character.state.equipment.inventory).toEqual(
      character.document.state.equipment.inventory
    )
    expect(character.document.state.equipment.equipped).toEqual([
      HELD_ITEM_INSTANCE_ID,
      SHIELD_ITEM_INSTANCE_ID
    ])
  })

  it.each([
    {
      name: 'a newer Character stream version',
      character: { ...targetCharacter(), streamVersion: CHARACTER_STREAM_VERSION + 1 },
      contest: () => characterContest()
    },
    {
      name: 'the item already unequipped',
      character: targetCharacter([SHIELD_ITEM_INSTANCE_ID]),
      contest: () => characterContest()
    },
    {
      name: 'a sealed equipped-set checksum that no longer matches',
      character: targetCharacter(),
      contest: () => characterContest({ stateChecksum: 'e'.repeat(64) })
    },
    {
      name: 'a contest sealed at another stream version',
      character: targetCharacter(),
      contest: () => characterContest({ streamVersion: CHARACTER_STREAM_VERSION - 1 })
    },
    {
      name: 'a different Character record',
      character: { ...targetCharacter(), id: '00000000-0000-4000-8000-00000000d1ff' },
      contest: () => characterContest()
    },
    { name: 'no Character record', character: null, contest: () => characterContest() }
  ])('refuses a Character target with $name', ({ character, contest }) => {
    expect(() =>
      planEncounterDisarmSuccess({
        target: characterActor({ id: TARGET_ACTOR_ID, characterId: TARGET_CHARACTER_ID }),
        contest: contest(),
        character
      })
    ).toThrow('Disarm Character item changed before settlement.')
  })

  it('refuses a Creature contest settled against a Character target, and a custom actor', () => {
    expect(() =>
      planEncounterDisarmSuccess({
        target: characterActor({ id: TARGET_ACTOR_ID, characterId: TARGET_CHARACTER_ID }),
        contest: creatureContest(),
        character: targetCharacter()
      })
    ).toThrow('Disarm Character item changed before settlement.')
    const custom = creatureActor({ id: TARGET_ACTOR_ID, kind: 'CUSTOM', snapshot: {} })
    expect(() =>
      planEncounterDisarmSuccess({ target: custom, contest: creatureContest(), character: null })
    ).toThrow('Disarm target is unavailable.')
  })

  it('refuses a contest that is not a Disarm', () => {
    const shove = prepareDnd5eOptionalCombatContestPendingContext({
      ...creatureContest(),
      actionKind: 'SHOVE_ASIDE',
      selection: {
        kind: 'SHOVE_ASIDE',
        defenderCheckDefinitionId: DEFENDER_CHECK_ID,
        destination: { x: 5, y: 0 },
        displacement: { amount: 5, unit: 'FEET', sceneUnits: 1 },
        sceneId: '00000000-0000-4000-8000-00000000d10e',
        sceneVersion: 1,
        targetTokenId: '00000000-0000-4000-8000-00000000d10f',
        stateChecksum: 'f'.repeat(64)
      }
    })
    expect(() =>
      planEncounterDisarmSuccess({ target: creatureTarget(), contest: shove, character: null })
    ).toThrow('Disarm settlement requires a Disarm contest.')
  })
})

describe('Disarm receipt outputs', () => {
  const contest = creatureContest()
  const won = planEncounterDisarmSuccess({ target: creatureTarget(), contest, character: null })

  function expectedOutputs(input: {
    rolls: ReturnType<typeof rolls>
    outcome: 'SOURCE_WIN' | 'TARGET_WIN_OR_TIE'
    stateTransition: unknown
    actionEconomyTransition: typeof actionEconomy | null
  }) {
    return {
      kind: 'CONTESTED_ACTION',
      schemaVersion: 1,
      occurrenceId: OCCURRENCE_ID,
      sourceActorId: SOURCE_ACTOR_ID,
      targetActorId: TARGET_ACTOR_ID,
      sealedContextChecksum: checksumRuleDocument(contest),
      policy: {
        definitionId: '00000000-0000-4000-8000-00000000d10c',
        definitionVersion: 1,
        definitionChecksum: '2'.repeat(64),
        moduleKey: 'd20.action.disarm',
        moduleContractVersion: 1
      },
      contestGraph: contest.contestGraph,
      sourceRoll: input.rolls.initiator,
      targetRoll: input.rolls.defender,
      outcome: input.outcome,
      stateTransition: input.stateTransition,
      actionEconomyTransition: input.actionEconomyTransition
    }
  }

  it('records a source win with its item transition and spent Action', () => {
    const settled = rolls(12, 10)
    expect(
      disarmApplicationOutputs({
        occurrenceId: OCCURRENCE_ID,
        contest,
        rolls: settled,
        stateTransition: won.stateTransition,
        actionEconomy
      })
    ).toEqual(
      expectedOutputs({
        rolls: settled,
        outcome: 'SOURCE_WIN',
        stateTransition: won.stateTransition,
        actionEconomyTransition: actionEconomy
      })
    )
  })

  it.each([
    { name: 'a tie', initiator: 10, defender: 13 },
    { name: 'a loss', initiator: 9, defender: 13 }
  ])('records $name as TARGET_WIN_OR_TIE with no state change', ({ initiator, defender }) => {
    const settled = rolls(initiator, defender)
    expect(
      disarmApplicationOutputs({
        occurrenceId: OCCURRENCE_ID,
        contest,
        rolls: settled,
        stateTransition: { kind: 'NONE' },
        actionEconomy: null
      })
    ).toEqual(
      expectedOutputs({
        rolls: settled,
        outcome: 'TARGET_WIN_OR_TIE',
        stateTransition: { kind: 'NONE' },
        actionEconomyTransition: null
      })
    )
  })

  it('refuses an outcome whose state transition contradicts the rolls', () => {
    expect(() =>
      disarmApplicationOutputs({
        occurrenceId: OCCURRENCE_ID,
        contest,
        rolls: rolls(10, 13),
        stateTransition: won.stateTransition,
        actionEconomy
      })
    ).toThrow('A contested-action target win or tie cannot mutate item state.')
    expect(() =>
      disarmApplicationOutputs({
        occurrenceId: OCCURRENCE_ID,
        contest,
        rolls: rolls(12, 10),
        stateTransition: { kind: 'NONE' },
        actionEconomy
      })
    ).toThrow('A contested-action source win requires one state transition.')
  })

  it('pins the sealed contest checksum, so evidence added later changes it', () => {
    const withEvidence = prepareDnd5eOptionalCombatContestPendingContext({
      ...contest,
      rollEvidence: {
        initiator: { requestId: 'initiator_d20', rawFaces: [12] },
        defender: { requestId: 'target_d20', rawFaces: [10] }
      }
    })
    const settled = disarmApplicationOutputs({
      occurrenceId: OCCURRENCE_ID,
      contest: withEvidence,
      rolls: rolls(12, 10),
      stateTransition: won.stateTransition,
      actionEconomy
    })
    expect(settled.sealedContextChecksum).toBe(checksumRuleDocument(withEvidence))
    expect(settled.sealedContextChecksum).not.toBe(checksumRuleDocument(contest))
  })
})
