import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SRD_CONDITION_TYPES,
  SRD_DAMAGE_TYPES
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import { planDamageSaveChain } from '../encounterDamageSaveChain.js'
import { targetEndedEffects } from '../encounterEndedEffectRelease.js'
import { movementDamageEnds, spatialDamageEnds } from '../encounterSpatialDamageEnds.js'
import type { EncounterEvent } from '../events/encounterEventTable.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { ENCOUNTER_ID, creatureActor } from '../testing/dnd5eSrdEncounter.js'
import { activeEffect } from './encounterActiveEffectFixtures.js'

const raised = vi.hoisted(() => ({ events: [] as EncounterEvent[][] }))

vi.mock('../events/encounterEventHooks.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../events/encounterEventHooks.js')>()
  return {
    ...original,
    discoverEncounterEventHooks: (
      input: Parameters<typeof original.discoverEncounterEventHooks>[0]
    ) => {
      raised.events.push([...input.events])
      return original.discoverEncounterEventHooks(input)
    }
  }
})

type SpatialApplication = Parameters<
  typeof spatialDamageEnds
>[0]['executions'][number]['applications'][number]

const damagedRaises = () =>
  raised.events.flat().filter((event) => event.kind === 'DAMAGED' && event.phase === 'AFTER')

const FIRE = SRD_DAMAGE_TYPES.find((entry) => entry.code === 'FIRE')!.id
const INVISIBLE = SRD_CONDITION_TYPES.find((entry) => entry.code === 'INVISIBLE')!.id
const HOLDER_ID = '00000000-0000-4000-8000-00000000f401'
const OTHER_ID = '00000000-0000-4000-8000-00000000f402'
const ZONE_A = '00000000-0000-4000-8000-00000000f403'
const ZONE_B = '00000000-0000-4000-8000-00000000f404'
const EFFECT_ID = '00000000-0000-4000-8000-00000000f405'
const STATE_ID = '00000000-0000-4000-8000-00000000f406'
const MOVE_OCCURRENCE_ID = '00000000-0000-4000-8000-00000000f407'
const CAST_AT = '2026-01-01T00:00:00.000Z'

beforeEach(() => {
  raised.events.length = 0
})

describe('DAMAGED(AFTER) once per command and holder (QUALITY-14.T2)', () => {
  const damage = (): SpatialApplication => ({
    ordinal: 0,
    kind: 'DAMAGE',
    damageTypeId: FIRE,
    damageDisposition: 'NORMAL',
    incomingHalved: false,
    critical: false,
    sourceNodeId: 'damage',
    sourceOperationKey: 'damage',
    authoredPath: null,
    resolvedPath: null,
    requestedAmount: 4,
    resolvedAmount: 4,
    appliedAmount: 4,
    beforeCurrentHitPoints: 20,
    afterCurrentHitPoints: 16,
    beforeTemporaryHitPoints: 0,
    afterTemporaryHitPoints: 0,
    maximumHitPoints: 20
  })
  const execution = (sourceActorId: string) => ({
    applications: [damage()],
    candidate: { candidate: { sourceActorId } }
  })

  it('raises one event for a holder two zone contacts damaged, one hit per contact source', () => {
    const sleeper = activeEffect({
      id: EFFECT_ID,
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
      createdOrdinal: 1,
      endTriggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }],
      sourceActorId: OTHER_ID,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })
    const { endedEffects } = spatialDamageEnds({
      holderActorId: HOLDER_ID,
      held: [sleeper],
      executions: [execution(ZONE_A), execution(ZONE_B)],
      turnActorId: null,
      dispositions: new Map()
    })
    expect(endedEffects).toEqual([sleeper])
    const raises = damagedRaises()
    expect(raises).toHaveLength(1)
    expect(raises[0]).toMatchObject({
      holderActorId: HOLDER_ID,
      hits: [{ damagerActorId: ZONE_A }, { damagerActorId: ZONE_B }]
    })
  })

  describe('a list or area that names a holder again (QUALITY-14.T2e)', () => {
    const untilFire = activeEffect({
      id: EFFECT_ID,
      owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId: HOLDER_ID },
      createdOrdinal: 1,
      endTriggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: [FIRE] }],
      sourceActorId: OTHER_ID,
      stateContributions: [
        { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
      ]
    })
    /** Damage that reached the holder, as an outcome's applications name it. */
    const dealt = (resolvedAmount: number) => ({
      ...damage(),
      targetActorId: HOLDER_ID,
      resolvedAmount
    })
    const outcome = (damageBySource: Parameters<typeof targetEndedEffects>[0]['damageBySource']) =>
      targetEndedEffects({
        holderActorId: HOLDER_ID,
        held: [untilFire],
        attack: { melee: false },
        testEvidence: [],
        turnActorId: null,
        applications: [dealt(4)],
        damagerActorId: ZONE_A,
        damageBySource,
        dispositions: new Map()
      })

    it('raises one event at the first outcome with a hit per entry that damaged the holder', () => {
      const { endedEffects } = outcome([
        { damagerActorId: ZONE_A, applications: [dealt(4)] },
        { damagerActorId: ZONE_A, applications: [dealt(0)] },
        { damagerActorId: ZONE_A, applications: [dealt(4)] }
      ])
      expect(endedEffects).toEqual([untilFire])
      expect(damagedRaises()).toEqual([
        {
          kind: 'DAMAGED',
          phase: 'AFTER',
          holderActorId: HOLDER_ID,
          hits: [
            { damagerActorId: ZONE_A, damageTypeIds: [FIRE] },
            { damagerActorId: ZONE_A, damageTypeIds: [FIRE] }
          ],
          dispositions: new Map()
        }
      ])
    })

    it('raises no damage at a later outcome, which still meets its attack', () => {
      const { endedEffects } = outcome([])
      expect(endedEffects).toEqual([])
      expect(damagedRaises()).toEqual([])
      expect(raised.events.flat().map(({ kind }) => kind)).toEqual(['ATTACKED'])
    })
  })

  describe('a move whose zones damage two creatures (QUALITY-14.T2b)', () => {
    const untilDamaged = (id: string, targetActorId: string) =>
      activeEffect({
        id,
        owner: { kind: 'ENCOUNTER_ACTOR', encounterId: ENCOUNTER_ID, targetActorId },
        createdOrdinal: 1,
        endTriggers: [{ event: 'DAMAGE_TAKEN', by: 'ANYONE', damageTypeIds: null }],
        sourceActorId: targetActorId,
        stateContributions: [
          { kind: 'CONDITION_OWNERSHIP', conditionId: INVISIBLE, baselinePresent: false }
        ]
      })
    const contact = (sourceActorId: string, targetActorId: string) => ({
      applications: [damage()],
      candidate: { candidate: { sourceActorId, targetActorId } }
    })
    const held = new Map([
      [HOLDER_ID, [untilDamaged(EFFECT_ID, HOLDER_ID)]],
      [OTHER_ID, [untilDamaged(STATE_ID, OTHER_ID)]]
    ])
    const executions = [
      contact(ZONE_A, HOLDER_ID),
      contact(ZONE_B, HOLDER_ID),
      contact(ZONE_A, OTHER_ID)
    ]
    const endedBy = (occurrenceId: string) =>
      [...held].flatMap(
        ([holderActorId, effects]) =>
          movementDamageEnds({
            holder: creatureActor({ id: holderActorId, kind: 'CUSTOM', snapshot: {} }),
            held: effects,
            executions,
            encounter: { id: ENCOUNTER_ID, currentActorId: null },
            occurrenceId,
            commandId: MOVE_OCCURRENCE_ID,
            dispositions: new Map()
          }).endedEffects
      )

    it('raises one event per holder for the whole move, with one hit per contact that reached it', () => {
      expect(endedBy(MOVE_OCCURRENCE_ID).map(({ id }) => id)).toEqual([EFFECT_ID, STATE_ID])
      const raises = damagedRaises()
      expect(raises).toHaveLength(2)
      expect(raises).toMatchObject([
        {
          holderActorId: HOLDER_ID,
          hits: [{ damagerActorId: ZONE_A }, { damagerActorId: ZONE_B }]
        },
        { holderActorId: OTHER_ID, hits: [{ damagerActorId: ZONE_A }] }
      ])
    })

    it('never ends an effect the move itself placed', () => {
      expect(endedBy(held.get(HOLDER_ID)![0]!.definition.origin.sourceOccurrenceId)).toEqual([])
    })
  })

  const stress = (targetActorId: string, ordinal: number) => ({
    ordinal,
    sourceNodeId: 'stress',
    sourceOperationKey: 'damage.apply',
    targetActorId,
    appliedAmount: 2,
    damageTypeId: null
  })
  const plan = (applications: ReturnType<typeof stress>[]) =>
    planDamageSaveChain({
      gameSystemId: DND5E_SYSTEM_ID,
      applications,
      maintainedStates: new Map([[HOLDER_ID, [{ id: STATE_ID, createdAt: CAST_AT }]]]),
      parentOccurrenceId: 'parent',
      damagerActorId: null,
      dispositions: new Map(),
      effectSaves: null
    })

  it('raises one event for a holder one command damaged twice, and owes a save per damage source', () => {
    const chain = plan([stress(HOLDER_ID, 0), stress(HOLDER_ID, 1)])
    expect(chain).toEqual([
      { ...stress(HOLDER_ID, 0), maintainedStateId: STATE_ID, castAt: CAST_AT },
      { ...stress(HOLDER_ID, 1), maintainedStateId: STATE_ID, castAt: CAST_AT }
    ])
    const raises = damagedRaises()
    expect(raises).toHaveLength(1)
    expect(raises[0]).toMatchObject({ holderActorId: HOLDER_ID, hits: [{}, {}] })
  })

  it('raises nothing for a holder that holds nothing the damage could end or check', () => {
    expect(plan([stress(OTHER_ID, 0)])).toEqual([])
    expect(damagedRaises()).toHaveLength(0)
  })
})
