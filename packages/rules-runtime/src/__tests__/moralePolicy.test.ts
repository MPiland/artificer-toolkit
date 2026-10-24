import { describe, expect, it } from 'vitest'
import { SRD_ABILITY_DEFINITION_IDS } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type {
  MoraleActorFacts,
  MoralePreparationInput
} from '../optionalCombatPolicyCapability.js'
import { optionalCombatPolicyCapabilityRegistry } from '../platformEncounterPolicy.js'
import { SRD_SYSTEM_ID, srdOptionalCombat, testUuid } from '../testing/dnd5eSrdEncounter.js'

const WISDOM = SRD_ABILITY_DEFINITION_IDS.WISDOM
const rules = srdOptionalCombat(['MORALE'])
const policy = optionalCombatPolicyCapabilityRegistry.require(SRD_SYSTEM_ID)
const ENEMIES = testUuid(0x5e1)
const HEROES = testUuid(0x5e2)

function creature(id: number, overrides: Partial<MoraleActorFacts> = {}): MoraleActorFacts {
  return {
    actorId: testUuid(id),
    sideId: ENEMIES,
    kind: 'CREATURE',
    currentHitPoints: 10,
    maxHitPoints: 10,
    removed: false,
    morale: null,
    ...overrides
  }
}

const hero = creature(0x90, { kind: 'CHARACTER', sideId: HEROES, currentHitPoints: 1 })
const policyInput = { automationMode: 'ASSISTED', gameSystemId: SRD_SYSTEM_ID } as const

function offers(actors: readonly MoraleActorFacts[], snapshot = rules) {
  return policy.offerMoraleTriggers({
    ...policyInput,
    optionalCombatSnapshot: snapshot.snapshot,
    optionalCombatSnapshotChecksum: snapshot.checksum,
    actors
  })
}

function prepare(
  actors: readonly MoraleActorFacts[],
  input: Partial<MoralePreparationInput> & Pick<MoralePreparationInput, 'triggerKind'>
) {
  return policy.prepareMoraleSave({
    ...policyInput,
    optionalCombatSnapshot: rules.snapshot,
    optionalCombatSnapshotChecksum: rules.checksum,
    actors,
    subjectActorId: actors[0]!.actorId,
    leaderActorId: null,
    overwhelmingOpposition: false,
    escapePossible: true,
    rollers: new Map(
      actors.map((actor) => [actor.actorId, { canAct: true, saveModifiers: new Map([[WISDOM, 0]]) }])
    ),
    ...input
  })
}

function proposal(resolution: ReturnType<typeof prepare>) {
  if (resolution.kind !== 'PROPOSED') throw new Error(`Expected a proposal, got ${resolution.kind}.`)
  return resolution.proposal
}

const declared = (triggerKind: string) => ({ triggerKind, origin: 'GM_DECLARED' })
const fromRun = (triggerKind: string) => ({ triggerKind, origin: 'RUN_STATE' })

describe('Morale offers (ENCOUNTER-6.1)', () => {
  it('derive half hit points, half the side removed and a removed leader from Run state', () => {
    const wounded = creature(1, { currentHitPoints: 5 })
    const fallen = creature(2, { removed: true })
    expect(offers([wounded, fallen, hero]).get(wounded.actorId)).toEqual([
      declared('INDIVIDUAL_SURPRISED'),
      fromRun('INDIVIDUAL_REDUCED_TO_HALF'),
      declared('INDIVIDUAL_CANNOT_HARM_OPPOSITION'),
      declared('GROUP_SURPRISED'),
      fromRun('GROUP_HALF_REMOVED'),
      declared('GROUP_LEADER_REMOVED'),
      declared('GROUP_LEADER_INCAPACITATED'),
      declared('GROUP_LEADER_TAKEN_PRISONER')
    ])
  })

  it('offer nothing to Characters or removed creatures, and nothing without the Morale rule', () => {
    const fallen = creature(2, { removed: true })
    const result = offers([creature(1), fallen, hero])
    expect(result.has(hero.actorId)).toBe(false)
    expect(result.has(fallen.actorId)).toBe(false)
    expect(offers([creature(1)], srdOptionalCombat(['DISARM'])).size).toBe(0)
  })

  it('hold back unmet derived triggers and every trigger already checked', () => {
    const leader = creature(3)
    const morale = proposalRecord({ groupLeaderActorId: leader.actorId })
    const steady = creature(1, { morale })
    const kinds = offers([steady, leader, creature(2)])
      .get(steady.actorId)!
      .map(({ triggerKind }) => triggerKind)
    expect(kinds).toEqual([
      'INDIVIDUAL_CANNOT_HARM_OPPOSITION',
      'GROUP_SURPRISED',
      'GROUP_LEADER_INCAPACITATED',
      'GROUP_LEADER_TAKEN_PRISONER'
    ])
    const leaderGone = offers([steady, { ...leader, removed: true }, creature(2)])
    expect(leaderGone.get(steady.actorId)).toContainEqual(fromRun('GROUP_LEADER_REMOVED'))
  })
})

/** A recorded group check that already fired Surprised; the leader is the one it named. */
function proposalRecord(overrides: { groupLeaderActorId: string }) {
  return {
    commandId: testUuid(0x700),
    definitionId: rules.snapshot.definitions[0]!.definitionId,
    triggerKind: 'GROUP_SURPRISED' as const,
    scope: 'GROUP' as const,
    rollerActorId: overrides.groupLeaderActorId,
    groupLeaderActorId: overrides.groupLeaderActorId,
    save: null,
    proposed: 'FLEE' as const,
    disposition: 'CONTINUE' as const,
    firedTriggerKinds: ['GROUP_SURPRISED' as const, 'INDIVIDUAL_SURPRISED' as const]
  }
}

describe('Morale save preparation (ENCOUNTER-6.1, 6.2)', () => {
  it('seals an individual Wisdom save against the authored DC: flee on failure, surrender with no escape', () => {
    const subject = creature(1)
    const sealed = proposal(prepare([subject, hero], { triggerKind: 'INDIVIDUAL_SURPRISED' }))
    expect(sealed).toMatchObject({
      triggerKind: 'INDIVIDUAL_SURPRISED',
      scope: 'SUBJECT',
      rollerActorId: subject.actorId,
      groupLeaderActorId: null,
      memberActorIds: [subject.actorId],
      abilityDefinitionId: WISDOM,
      difficultyClass: 10,
      contributors: [],
      automaticFailure: false,
      successDisposition: 'CONTINUE',
      failureDisposition: 'FLEE'
    })
    expect(
      proposal(
        prepare([subject], { triggerKind: 'INDIVIDUAL_SURPRISED', escapePossible: false })
      ).failureDisposition
    ).toBe('SURRENDER')
  })

  it('rolls overwhelming opposition at disadvantage', () => {
    const sealed = proposal(
      prepare([creature(1)], { triggerKind: 'INDIVIDUAL_SURPRISED', overwhelmingOpposition: true })
    )
    expect(sealed.contributors.map(({ influence }) => influence)).toEqual(['DISADVANTAGE'])
  })

  it('covers the side’s present creatures and lets the named leader roll', () => {
    const subject = creature(2)
    const leader = creature(3)
    const sealed = proposal(
      prepare([subject, creature(1, { removed: true }), leader, hero], {
        triggerKind: 'GROUP_SURPRISED',
        leaderActorId: leader.actorId
      })
    )
    expect(sealed).toMatchObject({
      scope: 'GROUP',
      rollerActorId: leader.actorId,
      groupLeaderActorId: leader.actorId,
      memberActorIds: [subject.actorId, leader.actorId]
    })
  })

  it('falls back to the best able save without a leader, ties to the lower id', () => {
    const actors = [creature(4), creature(3), creature(2), creature(1)]
    const save = (modifier: number) => ({ canAct: true, saveModifiers: new Map([[WISDOM, modifier]]) })
    const rollers = new Map([
      [testUuid(1), { canAct: false, saveModifiers: new Map([[WISDOM, 9]]) }],
      [testUuid(2), save(3)],
      [testUuid(3), save(3)],
      [testUuid(4), save(1)]
    ])
    expect(
      proposal(prepare(actors, { triggerKind: 'GROUP_SURPRISED', rollers })).rollerActorId
    ).toBe(testUuid(2))
  })

  it('refuses a leader on an individual trigger, a leader who cannot act, and a trigger not offered', () => {
    const subject = creature(1)
    const leader = creature(2)
    expect(
      prepare([subject, leader], {
        triggerKind: 'INDIVIDUAL_SURPRISED',
        leaderActorId: leader.actorId
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MORALE_LEADER_FOR_INDIVIDUAL_TRIGGER' })
    expect(
      prepare([subject, leader], {
        triggerKind: 'GROUP_SURPRISED',
        leaderActorId: leader.actorId,
        rollers: new Map([[leader.actorId, { canAct: false, saveModifiers: new Map([[WISDOM, 2]]) }]])
      })
    ).toEqual({ kind: 'JUDGMENT_REQUIRED', reason: 'MORALE_ROLLER_UNAVAILABLE' })
    expect(prepare([subject], { triggerKind: 'INDIVIDUAL_REDUCED_TO_HALF' })).toEqual({
      kind: 'NOT_APPLICABLE'
    })
    expect(prepare([hero], { triggerKind: 'INDIVIDUAL_SURPRISED' })).toEqual({
      kind: 'NOT_APPLICABLE'
    })
  })
})
