import {
  characterActor,
  creatureFeature,
  currentSrdDefinition,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { encounterBasicActionId } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  SRD_BASIC_ACTION_DEFINITIONS,
  SRD_BASIC_ACTION_IDS
} from '@artificer-toolkit/source-data/srd/basicActions.js'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_MEDICINE_SKILL_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { guidance } from '@artificer-toolkit/source-data/srd/spells/guidance.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { actionRoom, biteWolf, withCheckTotals } from './actionRoomFixture.js'
import { heldDieEffect, seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { parseReceiptExecution, readRoomHistory } from './roomHistoryReads.js'

const WOLF_ID = testUuid(0xf00)
const FIGHTER_ACTOR_ID = testUuid(0xf01)
const FIGHTER_ID = testUuid(0xf02)
/** The hostile Wolf's touch cannot be measured in a room without a Scene, as for the Healer's Kit. */
const TOUCH_WITHOUT_SCENE: EncounterRuleWarningCodeDto[] = [
  'TARGET_DISPOSITION',
  'TARGET_RANGE_UNCHECKED'
]
const firstAidDefinition = SRD_BASIC_ACTION_DEFINITIONS.find(
  ({ id }) => id === SRD_BASIC_ACTION_IDS.FIRST_AID
)
if (firstAidDefinition?.document.kind !== 'BASIC_ACTION')
  throw new Error('Missing First Aid fixture.')
const firstAidEffectId = firstAidDefinition.document.effects[0]!.id
/** The zero-based draw of a d20 that shows `face`. */
const draw = (face: number) => face - 1

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** The helper Wolf, whose Wisdom (Medicine) total is +3. */
function medicWolf() {
  return withCheckTotals(
    srdCreatureActor({ id: WOLF_ID, creature: biteWolf('ATTACK', { damage: 1, reachFeet: 5 }) }),
    { [SRD_MEDICINE_SKILL_ID]: 3, [SRD_ABILITY_DEFINITION_IDS.STRENGTH]: 3 }
  )
}

/** The Wolf acts and gives First Aid to the Fighter, who is at the given hit points. */
function firstAidRoom(options: { currentHitPoints?: number; autoRoll: boolean; faces: number[] }) {
  return actionRoom({
    ...(options.autoRoll ? { autoRoll: 'BOTH' as const } : {}),
    rolls: options.faces.map(draw),
    characterPlay:
      options.currentHitPoints === undefined
        ? undefined
        : { currentHitPoints: options.currentHitPoints },
    actors: [medicWolf(), characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID })],
    ownerFeatureId: creatureFeature(biteWolf('ATTACK', { damage: 1, reachFeet: 5 }), 'Bite').id
  })
}

async function useFirstAid(
  room: Awaited<ReturnType<typeof firstAidRoom>>,
  acknowledgedWarnings: EncounterRuleWarningCodeDto[] = TOUCH_WITHOUT_SCENE
) {
  return room.startAction(
    FIGHTER_ACTOR_ID,
    acknowledgedWarnings,
    null,
    null,
    encounterBasicActionId(WOLF_ID, SRD_BASIC_ACTION_IDS.FIRST_AID, firstAidEffectId),
    WOLF_ID
  )
}

/** The one basic action check a Run settled: its stored rule execution and the occurrence state. */
async function settledCheck(room: Awaited<ReturnType<typeof firstAidRoom>>) {
  const history = await readRoomHistory(room.room.base.stub)
  const outputs = history.receipts.flatMap((receipt) => {
    const execution = parseReceiptExecution(receipt)
    return execution.status === 'COMPLETE' &&
      execution.applicationOutputs?.kind === 'BASIC_ACTION_CHECK'
      ? [execution.applicationOutputs]
      : []
  })
  return { outputs, occurrences: history.occurrences }
}

const STEADY_ID = testUuid(0xf10)
const STEADY_EFFECT_ID = testUuid(0xf11)
const STRONG_ID = testUuid(0xf12)
const STRONG_EFFECT_ID = testUuid(0xf13)

/** A homebrew basic action on the same CHECK test as First Aid, against a harder DC of 15. */
function homebrewCheckDefinition(
  ids: { id: string; effectId: string },
  checks: { skillIds: string[]; abilityDefinitionIds: string[] }
) {
  const document = {
    ...firstAidDefinition!.document,
    id: ids.id,
    effects: [
      {
        ...firstAidDefinition!.document.effects[0]!,
        id: ids.effectId,
        invocation: {
          ...firstAidDefinition!.document.effects[0]!.invocation,
          check: { checks, dc: { kind: 'FIXED' as const, value: 15 } }
        }
      }
    ]
  }
  return currentSrdDefinition({
    ...firstAidDefinition!,
    id: ids.id,
    document,
    checksum: checksumRuleDocument(document)
  })
}
const STEADY = { id: STEADY_ID, effectId: STEADY_EFFECT_ID }
const STRONG = { id: STRONG_ID, effectId: STRONG_EFFECT_ID }
const steadyDefinition = homebrewCheckDefinition(STEADY, {
  skillIds: [SRD_MEDICINE_SKILL_ID],
  abilityDefinitionIds: []
})
/** The same action authored as a plain Strength check rather than a skill. */
const strongDefinition = homebrewCheckDefinition(STRONG, {
  skillIds: [],
  abilityDefinitionIds: [SRD_ABILITY_DEFINITION_IDS.STRENGTH]
})

describe('a homebrew basic action authored with the CHECK test, in the room', () => {
  async function useHomebrew(
    definition: typeof steadyDefinition,
    ids: { id: string; effectId: string },
    face: number
  ) {
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: [draw(face)],
      characterPlay: { currentHitPoints: 0 },
      definitions: [definition],
      actors: [medicWolf(), characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID })],
      ownerFeatureId: creatureFeature(biteWolf('ATTACK', { damage: 1, reachFeet: 5 }), 'Bite').id
    })
    const { answer } = await room.startAction(
      FIGHTER_ACTOR_ID,
      TOUCH_WITHOUT_SCENE,
      null,
      null,
      encounterBasicActionId(WOLF_ID, ids.id, ids.effectId),
      WOLF_ID
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    return settledCheck(room)
  }
  const useSteady = (face: number) => useHomebrew(steadyDefinition, STEADY, face)

  it('runs its outcome when the total reaches its own DC', async () => {
    expect((await useSteady(14)).outputs).toMatchObject([
      { check: { dc: 15 }, outcome: 'STABILIZED' }
    ])
  })

  it('runs no outcome and writes no effect when the total falls short, though First Aid’s DC 10 would pass', async () => {
    const { outputs } = await useSteady(10)
    expect(outputs).toMatchObject([
      { check: { dc: 15 }, d20: { selectedNatural: 10 }, outcome: 'FAILED', targetTransition: null }
    ])
  })

  it('rolls a plain ability check the same way, a Strength check against its own DC', async () => {
    expect((await useHomebrew(strongDefinition, STRONG, 14)).outputs).toMatchObject([
      { check: { dc: 15 }, outcome: 'STABILIZED' }
    ])
    expect((await useHomebrew(strongDefinition, STRONG, 10)).outputs).toMatchObject([
      { check: { dc: 15 }, outcome: 'FAILED', targetTransition: null }
    ])
  })
})

describe('a Creature feature authored with a contested CHECK test', () => {
  it('is refused, since only a basic action makes a contest, and nothing is spent or written', async () => {
    const attack = biteWolf('ATTACK', { damage: 1, reachFeet: 5 })
    const checkWolf = creatureAuthoredDtoSchema.parse({
      ...attack,
      features: attack.features?.map((feature) =>
        feature.label !== 'Bite'
          ? feature
          : {
              ...feature,
              effects: feature.effects?.map((effect) => ({
                ...effect,
                invocation: {
                  ...effect.invocation,
                  triggerCode: 'CHECK' as const,
                  check: {
                    checks: { skillIds: [SRD_MEDICINE_SKILL_ID], abilityDefinitionIds: [] },
                    dc: {
                      kind: 'CONTEST' as const,
                      checks: { skillIds: [SRD_MEDICINE_SKILL_ID], abilityDefinitionIds: [] }
                    }
                  }
                },
                paths: effect.paths.map((path) => ({ ...path, pathCode: 'ON_CHECK_SUCCESS' }))
              }))
            }
      )
    })
    const room = await actionRoom({
      autoRoll: 'BOTH',
      rolls: [draw(20)],
      characterPlay: { currentHitPoints: 0 },
      actors: [
        srdCreatureActor({ id: WOLF_ID, creature: checkWolf }),
        characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID })
      ],
      ownerFeatureId: creatureFeature(checkWolf, 'Bite').id
    })
    const before = await room.version()
    const { answer } = await room.startAction(FIGHTER_ACTOR_ID, TOUCH_WITHOUT_SCENE)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
    expect(answer).toMatchObject({ code: 'DOMAIN_REJECTED', reason: 'SOURCE_REQUIREMENTS_NOT_MET' })
    expect(JSON.stringify(answer)).not.toContain('RULE_WARNINGS')
    expect(await room.version()).toBe(before)
    expect((await settledCheck(room)).outputs).toEqual([])
  })
})

describe('First Aid, a System basic action with a check, in the room', () => {
  it('rolls for the helper who rolls automatically, and a roll that reaches the DC makes the dying target stable', async () => {
    const room = await firstAidRoom({ currentHitPoints: 0, autoRoll: true, faces: [20] })
    const { answer } = await useFirstAid(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences } = await settledCheck(room)
    expect(outputs).toMatchObject([
      {
        helperActorId: WOLF_ID,
        targetActorId: FIGHTER_ACTOR_ID,
        check: { dc: 10 },
        d20: { selectedNatural: 20 },
        outcome: 'STABILIZED',
        targetTransition: {
          before: { currentHitPoints: 0, deathSaves: { stable: false } },
          after: { currentHitPoints: 0, deathSaves: { successes: 0, failures: 0, stable: true } }
        }
      }
    ])
    expect(occurrences.map((occurrence) => occurrence.state)).toEqual(['COMPLETED'])
  })

  it('changes nothing for the target when the roll misses the DC, though the Action is spent', async () => {
    const room = await firstAidRoom({ currentHitPoints: 0, autoRoll: true, faces: [1] })
    const before = await room.version()
    const { answer } = await useFirstAid(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await room.version()).toBe(before + 1)

    const { outputs } = await settledCheck(room)
    expect(outputs).toMatchObject([
      { d20: { selectedNatural: 1 }, outcome: 'FAILED', targetTransition: null }
    ])
  })

  it('waits for the helper’s d20 when they roll by hand, then settles the frozen check with it', async () => {
    const room = await firstAidRoom({ currentHitPoints: 0, autoRoll: false, faces: [] })
    const { answer } = await useFirstAid(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect((await settledCheck(room)).outputs).toEqual([])

    const decision = await room.pendingDecision()
    expect(decision.pending).toMatchObject({
      kind: 'D20_EVIDENCE',
      rollerActorId: WOLF_ID,
      trigger: { kind: 'BASIC_ACTION_CHECK', actionLabel: 'First Aid', dc: 10 }
    })
    if (decision.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected a d20 request.')
    const settled = await room.resolve(decision, {
      kind: 'ENTER_DICE',
      requestId: decision.pending.request.requestId,
      rawFaces: [20],
      rollMode: decision.pending.request.rollMode
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences } = await settledCheck(room)
    expect(outputs).toMatchObject([
      { outcome: 'STABILIZED', targetTransition: { after: { deathSaves: { stable: true } } } }
    ])
    expect(occurrences.map((occurrence) => occurrence.state)).toEqual(['COMPLETED'])
  })

  it('warns, overridably, for a target that is not dying, and then rolls nothing', async () => {
    const room = await firstAidRoom({ autoRoll: true, faces: [20] })
    const refused = await useFirstAid(room)
    expect(refused.answer.type).toBe('COMMAND_REJECTED')
    expect(JSON.stringify(refused.answer)).toContain('TARGET_NOT_DYING')

    const applied = await useFirstAid(room, [...TOUCH_WITHOUT_SCENE, 'TARGET_NOT_DYING'])
    expect(applied.answer.type, JSON.stringify(applied.answer)).toBe('COMMAND_COMMITTED')
    const { outputs, occurrences } = await settledCheck(room)
    expect(outputs).toEqual([])
    expect(occurrences).toEqual([])
  })

  it('warns, overridably, that a hostile target is not willing, and acknowledging it proceeds', async () => {
    const room = await firstAidRoom({ currentHitPoints: 0, autoRoll: true, faces: [20] })
    const before = await room.version()
    const warned = await useFirstAid(room, [])
    expect(warned.answer.type, JSON.stringify(warned.answer)).toBe('COMMAND_REJECTED')
    expect(warned.answer).toMatchObject({
      reason: 'RULE_WARNINGS',
      warnings: [
        { code: 'TARGET_DISPOSITION', message: 'This action needs a willing target.' },
        { code: 'TARGET_RANGE_UNCHECKED' }
      ]
    })
    expect(await room.version()).toBe(before)

    const applied = await useFirstAid(room)
    expect(applied.answer.type, JSON.stringify(applied.answer)).toBe('COMMAND_COMMITTED')
  })

  it('refuses a helper who aims it at themself, whatever warnings the command acknowledges', async () => {
    const room = await firstAidRoom({ autoRoll: true, faces: [20] })
    const before = await room.version()
    const { answer } = await room.startAction(
      WOLF_ID,
      [...TOUCH_WITHOUT_SCENE, 'TARGET_NOT_DYING', 'ACTION_ECONOMY_UNAVAILABLE'],
      null,
      null,
      encounterBasicActionId(WOLF_ID, SRD_BASIC_ACTION_IDS.FIRST_AID, firstAidEffectId),
      WOLF_ID
    )
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
    expect(answer).toMatchObject({
      reason: 'TARGET_UNAVAILABLE',
      message: 'The selected action does not permit this target.'
    })
    expect(JSON.stringify(answer)).not.toContain('RULE_WARNINGS')
    expect(await room.version()).toBe(before)
  })

  it('refuses a point on the Scene, since a check action aims at one creature', async () => {
    const room = await firstAidRoom({ autoRoll: true, faces: [20] })
    const before = await room.version()
    const answer = await room.send({
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: TOUCH_WITHOUT_SCENE,
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: before,
      actorId: WOLF_ID,
      target: {
        kind: 'POINT',
        sceneId: room.room.scene.id,
        expectedSceneVersion: room.room.scene.version,
        point: { x: 1, y: 1 }
      },
      actionId: encounterBasicActionId(WOLF_ID, SRD_BASIC_ACTION_IDS.FIRST_AID, firstAidEffectId),
      optionalCombatIntent: null,
      sceneContext: null
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_REJECTED')
    expect(answer).toMatchObject({
      reason: 'TARGET_UNAVAILABLE',
      message: 'The selected action does not permit this target.'
    })
    expect(await room.version()).toBe(before)
  })
})

describe('a die the helper holds for after the d20, in the First Aid room (SPELLS-31.T4c1a)', () => {
  async function heldDieRoom(effect: ReturnType<typeof heldDieEffect>) {
    const room = await actionRoom({
      rolls: [],
      characterPlay: { currentHitPoints: 0 },
      actors: [medicWolf(), characterActor({ id: FIGHTER_ACTOR_ID, characterId: FIGHTER_ID })],
      ownerFeatureId: creatureFeature(biteWolf('ATTACK', { damage: 1, reachFeet: 5 }), 'Bite').id,
      seed: seedModifierGrant({
        sourceActorId: WOLF_ID,
        holderActorId: WOLF_ID,
        lifecycle: {},
        effect,
        sourceLabel: guidance.label
      })
    })
    const { answer } = await useFirstAid(room as Awaited<ReturnType<typeof firstAidRoom>>)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    return room as Awaited<ReturnType<typeof firstAidRoom>>
  }

  /** The helper enters a natural 5 (total 8 against DC 10) and meets the window it opens. */
  async function openWindow(room: Awaited<ReturnType<typeof firstAidRoom>>) {
    const roll = await room.pendingDecision()
    if (roll.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the helper’s d20.')
    const opened = await room.resolve(roll, {
      kind: 'ENTER_DICE',
      requestId: roll.pending.request.requestId,
      rawFaces: [5],
      rollMode: roll.pending.request.rollMode
    })
    expect(opened.type, JSON.stringify(opened)).toBe('COMMAND_COMMITTED')
    expect((await settledCheck(room)).outputs).toEqual([])
    const decision = await room.pendingDecision()
    if (decision.pending.kind !== 'D20_WINDOW') throw new Error('Expected the d20 window.')
    return { decision, pending: decision.pending }
  }

  it('offers the die once the d20 is seen, and spending it turns a miss into a stabilize and ends the effect', async () => {
    const room = await heldDieRoom(heldDieEffect())
    const { decision, pending } = await openWindow(room)
    expect(pending).toMatchObject({
      rollerActorId: WOLF_ID,
      d20: { selectedNatural: 5, total: 8 },
      options: [{ label: 'Guidance', count: 1, faces: 4, sign: 'ADD' }]
    })
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toHaveLength(1)

    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [3]
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')

    const { outputs, occurrences } = await settledCheck(room)
    expect(outputs).toMatchObject([
      {
        d20: {
          selectedNatural: 5,
          total: 11,
          addedDice: [{ label: 'Guidance', rolledFaces: [3] }]
        },
        outcome: 'STABILIZED'
      }
    ])
    expect(occurrences.map((occurrence) => occurrence.state)).toEqual(['COMPLETED'])
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toEqual([])
  })

  it('keeps the roll and the die when the helper declines', async () => {
    const room = await heldDieRoom(heldDieEffect())
    const { decision, pending } = await openWindow(room)
    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_DECLINE',
      requestId: pending.requestId
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect((await settledCheck(room)).outputs).toMatchObject([
      { d20: { total: 8 }, outcome: 'FAILED', targetTransition: null }
    ])
    expect((await readRoomHistory(room.room.base.stub)).activeEffects).toHaveLength(1)
  })

  it('offers a homebrew die authored differently (two dice, Wisdom only) through the same path', async () => {
    const room = await heldDieRoom(heldDieEffect({ count: 2, ability: 'WISDOM' }))
    const { decision, pending } = await openWindow(room)
    expect(pending.options).toMatchObject([{ count: 2, faces: 4 }])
    const settled = await room.resolve(decision, {
      kind: 'D20_WINDOW_USE',
      requestId: pending.requestId,
      optionId: pending.options[0]!.optionId,
      faces: [1, 2]
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect((await settledCheck(room)).outputs).toMatchObject([
      { d20: { total: 11 }, outcome: 'STABILIZED' }
    ])
  })

  it('offers no die whose ability the check is not', async () => {
    const room = await heldDieRoom(heldDieEffect({ ability: 'STRENGTH' }))
    const roll = await room.pendingDecision()
    if (roll.pending.kind !== 'D20_EVIDENCE') throw new Error('Expected the helper’s d20.')
    const settled = await room.resolve(roll, {
      kind: 'ENTER_DICE',
      requestId: roll.pending.request.requestId,
      rawFaces: [5],
      rollMode: roll.pending.request.rollMode
    })
    expect(settled.type, JSON.stringify(settled)).toBe('COMMAND_COMMITTED')
    expect((await settledCheck(room)).outputs).toMatchObject([{ outcome: 'FAILED' }])
  })
})
