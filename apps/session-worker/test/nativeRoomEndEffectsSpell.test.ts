import { TARGET_NOTHING_TO_END_WARNING } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  characterActor,
  srdCreatureActor
} from '@artificer-toolkit/rules-runtime/testing/dnd5eSrdEncounter'
import { activeRuleEffectDefinitionDtoSchema } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import type { EncounterRuleWarningCodeDto } from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { lesserRestoration } from '@artificer-toolkit/source-data/srd/spells/lesser-restoration.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { planEndEffects } from '../src/nativeEndEffects.js'
import { testUuid } from '../src/testing/liveCaptureFixture.js'
import { plainWolf } from '../src/testing/movementPlannerFixture.js'
import { actionRoom } from './actionRoomFixture.js'
import { seedModifierGrant } from './grantSeed.js'
import { closeTrackedSockets } from './liveRoomFixture.js'
import { readActorConditionIds, readRoomHistory } from './roomHistoryReads.js'

/**
 * SPELLS-4.T2f (D174): Lesser Restoration is one authored END_EFFECTS outcome. The cast names the
 * one held effect to end; a sole match is picked for the caster; none is an overridable warning.
 */

const CASTER_ACTOR_ID = testUuid(0x8a0)
const CASTER_ID = testUuid(0x8a1)
const WOLF_ID = testUuid(0x8a2)
const OTHER_RANGE: EncounterRuleWarningCodeDto[] = ['TARGET_RANGE_UNCHECKED']

const conditionId = (code: string) => {
  const found = srdSystemRecord.conditionTypes.find((condition) => condition.code === code)
  if (!found) throw new Error(`The SRD names the ${code} condition.`)
  return found.id
}
const POISONED = conditionId('POISONED')
const BLINDED = conditionId('BLINDED')
const FRIGHTENED = conditionId('FRIGHTENED')

afterEach(() => {
  closeTrackedSockets()
  vi.restoreAllMocks()
})

/** A caster who knows Lesser Restoration and a Wolf holding one effect per condition in `held`. */
function restorationRoom(held: readonly string[]) {
  const seeds = held.map((ownedConditionId) =>
    seedModifierGrant({
      sourceActorId: WOLF_ID,
      holderActorId: WOLF_ID,
      lifecycle: {},
      ownedConditionId
    })
  )
  return actionRoom({
    actors: [
      characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
      srdCreatureActor({ id: WOLF_ID, creature: plainWolf, conditionIds: held })
    ],
    characterSpellcasting: { spells: [lesserRestoration], prepared: [lesserRestoration.id] },
    characterAction: (action) => action.label.startsWith('Lesser Restoration'),
    seed: async (context) => {
      for (const seed of seeds) await seed(context)
    }
  })
}

type RestorationRoom = Awaited<ReturnType<typeof restorationRoom>>

/** The cast, naming `chosenEffectId` when the caster picks one. */
async function cast(
  room: RestorationRoom,
  options: { chosenEffectId?: string; acknowledgedWarnings?: EncounterRuleWarningCodeDto[] } = {}
) {
  return room.send({
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: options.acknowledgedWarnings ?? OTHER_RANGE,
    encounterId: room.room.encounterId,
    commandId: crypto.randomUUID(),
    expectedVersion: await room.version(),
    actorId: CASTER_ACTOR_ID,
    target: {
      kind: 'ACTOR',
      actorId: WOLF_ID,
      ...(options.chosenEffectId && { chosenEffectId: options.chosenEffectId })
    },
    actionId: room.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  })
}

const heldState = async (room: RestorationRoom) => {
  const history = await readRoomHistory(room.room.base.stub)
  return {
    effectIds: history.activeEffects.map(({ id }) => id).sort(),
    conditionIds: [...readActorConditionIds(history, WOLF_ID)].sort()
  }
}

describe('Lesser Restoration cast in the room (SPELLS-4.T2f)', () => {
  it('ends the chosen effect and releases only the condition it alone held, in one undoable command', async () => {
    const room = await restorationRoom([POISONED, BLINDED])
    const before = await heldState(room)
    expect(before.effectIds).toHaveLength(2)
    const [poisonEffectId] = before.effectIds

    const unchosen = await cast(room)
    expect(unchosen.type).not.toBe('COMMAND_COMMITTED')
    expect(await heldState(room)).toEqual(before)

    const answer = await cast(room, { chosenEffectId: poisonEffectId })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    const after = await heldState(room)
    expect(after.effectIds).not.toContain(poisonEffectId)
    expect(after.effectIds).toHaveLength(1)
    expect(after.conditionIds).toHaveLength(1)

    const undone = await room.send({
      type: 'REVERT_LAST_ACTION',
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version()
    })
    expect(undone.type, JSON.stringify(undone)).toBe('COMMAND_COMMITTED')
    expect(await heldState(room)).toEqual(before)
  })

  it('picks the one matching effect itself', async () => {
    const room = await restorationRoom([POISONED])
    const answer = await cast(room)
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(await heldState(room)).toEqual({ effectIds: [], conditionIds: [] })
  })

  it('warns when the target holds nothing the spell ends, and goes ahead when overridden', async () => {
    const room = await restorationRoom([FRIGHTENED])
    const before = await heldState(room)

    const warned = await cast(room)
    expect(JSON.stringify(warned)).toContain('TARGET_NOTHING_TO_END')
    expect(await heldState(room)).toEqual(before)

    const overridden = await cast(room, {
      acknowledgedWarnings: [...OTHER_RANGE, 'TARGET_NOTHING_TO_END']
    })
    expect(overridden.type, JSON.stringify(overridden)).toBe('COMMAND_COMMITTED')
    expect(await heldState(room)).toEqual(before)
  })
})

/**
 * SPELLS-31.T5k: nothing to end breaks a rule only when ending is all the action does. An action
 * that ends its own earlier grant and grants anew (Fiendish Resilience) has nothing to replace yet.
 */
describe('the nothing-to-end warning (SPELLS-31.T5k)', () => {
  const plan = (outcomes: Parameters<typeof planEndEffects>[0]) =>
    planEndEffects(outcomes, [], { kind: 'ACTOR' }, { castLevel: null, actors: [] }).warnings
  const ends = {
    kind: 'EFFECT',
    endEffects: { scope: 'ALL', selectors: [{ kind: 'SAME_EFFECT', effectId: WOLF_ID }] }
  } as const

  it('warns when an action only ends effects and the target holds none', () => {
    expect(plan([ends])).toEqual([TARGET_NOTHING_TO_END_WARNING])
  })

  it('does not warn when the action also grants and the target holds nothing to replace', () => {
    expect(plan([ends, { kind: 'EFFECT' }])).toEqual([])
  })
})

/**
 * SPELLS-4.T2f1a (D182): a Dispel-style spell is one END_EFFECTS outcome with a spell-level
 * selector and no check; it ends every held effect cast at or below the slot it was cast at.
 */
describe('a spell-level END_EFFECTS spell cast in the room (SPELLS-4.T2f1a)', () => {
  const dispelStyle = structuredClone(lesserRestoration)
  const outcome = dispelStyle.effects?.[0]?.paths[0]
  if (outcome?.selectionKind !== 'FIXED') throw new Error('Expected a fixed path.')
  outcome.resultBlock.outcomes = [
    {
      id: outcome.resultBlock.outcomes[0]!.id,
      effectKind: 'END_EFFECTS' as const,
      scope: 'ALL' as const,
      selectors: [{ kind: 'SPELL_LEVEL' as const, limit: 'SLOT_LEVEL' as const }]
    }
  ]

  it('ends the effects at or below the cast level and leaves a higher one, with no roll', async () => {
    const room = await actionRoom({
      actors: [
        characterActor({ id: CASTER_ACTOR_ID, characterId: CASTER_ID }),
        srdCreatureActor({ id: WOLF_ID, creature: plainWolf })
      ],
      characterSpellcasting: { spells: [dispelStyle], prepared: [dispelStyle.id] },
      characterAction: (action) => action.label.startsWith('Lesser Restoration'),
      seed: async (context) => {
        for (const spellCastLevel of [1, 2, 4])
          await seedModifierGrant({
            sourceActorId: WOLF_ID,
            holderActorId: WOLF_ID,
            lifecycle: {},
            spellCastLevel
          })(context)
      }
    })
    const before = await readRoomHistory(room.room.base.stub)
    const levels = (history: typeof before) =>
      history.activeEffects
        .map(
          ({ definitionJson }) =>
            activeRuleEffectDefinitionDtoSchema.parse(JSON.parse(definitionJson)).originLevel
        )
        .sort()
    expect(levels(before)).toEqual([1, 2, 4])

    const answer = await room.send({
      type: 'RESOLVE_ACTION',
      acceptedWieldConflict: null,
      acknowledgedWarnings: OTHER_RANGE,
      encounterId: room.room.encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: await room.version(),
      actorId: CASTER_ACTOR_ID,
      target: { kind: 'ACTOR', actorId: WOLF_ID },
      actionId: room.actionId,
      optionalCombatIntent: null,
      sceneContext: null
    })
    expect(answer.type, JSON.stringify(answer)).toBe('COMMAND_COMMITTED')
    expect(levels(await readRoomHistory(room.room.base.stub))).toEqual([4])
  })
})
