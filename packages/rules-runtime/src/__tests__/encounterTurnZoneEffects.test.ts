import { beforeAll, describe, expect, it } from 'vitest'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { initiativeCompleteRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResultBranches'
import { zoneApplicationKey } from '@artificer-toolkit/shared/vtt'

import type { EncounterResponseAnswer } from '../encounterEvidenceAnswer.js'
import { planEncounterInitiativeAdvance } from '../encounterInitiativeStateSettlement.js'
import { projectNativeTurnPending, turnPendingActorId } from '../encounterTurnPending.js'
import { prepareEncounterTurnZoneEffects } from '../encounterTurnZoneEffects.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureTarget,
  srdEncounterState
} from '../testing/dnd5eSrdEncounter.js'
import { roundAt } from './encounterInitiativeFixtures.js'
import {
  actorIdByTokenId,
  actors,
  AUTO_ROLL,
  authoredZone,
  END,
  GM_USER_ID,
  GOBLIN_ID,
  OCCURRENCE_ID,
  placedZone,
  root,
  SOURCE_ID,
  START,
  tokens
} from '../testing/encounterTurnZoneFixture.js'

let runtime: RulesRuntimeService
beforeAll(async () => {
  runtime = createSrdRulesRuntime()
})

function prepare(input: {
  zones: readonly EncounterSpatialRuleEffectRecord[]
  boundary: typeof START | typeof END
  /** Who auto-rolls; both creatures by default. The scripted roll is always the lowest face. */
  autoRollByActorId?: Record<string, boolean>
  state?: ReturnType<typeof srdEncounterState>
  pending?: ServerRuleExecutionPendingSnapshotDto
  resolution?: EncounterResponseAnswer
}) {
  return prepareEncounterTurnZoneEffects({
    state: input.state ?? srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 3 }),
    userId: GM_USER_ID,
    root,
    occurrenceId: OCCURRENCE_ID,
    actors,
    boundary: input.boundary,
    loadScene: async () => ({ effects: input.zones, tokens, actorIdByTokenId }),
    loadTarget: async (actorId) => srdCreatureTarget(actors.find((actor) => actor.id === actorId)!),
    createRuntime: async () => runtime,
    random: () => 0,
    autoRollByActorId: input.autoRollByActorId ?? AUTO_ROLL,
    ...(input.pending ? { pending: input.pending } : {}),
    ...(input.resolution ? { resolution: input.resolution } : {})
  })
}

async function complete(run: ReturnType<typeof prepare>) {
  const result = await run
  if (result.kind !== 'COMPLETE') throw new Error('Expected a completed zone phase.')
  return result
}

async function pending(run: ReturnType<typeof prepare>) {
  const result = await run
  if (result.kind !== 'PENDING') throw new Error('Expected a pending zone phase.')
  return result.snapshot
}

const hitPoints = (list: readonly EncounterRunActorState[], id: string) => {
  const actor = list.find((candidate) => candidate.id === id)
  return actor && actor.kind !== 'CHARACTER' ? actor.currentHitPoints : undefined
}
const effectIds = (plan: Awaited<ReturnType<typeof complete>>['plan']) =>
  plan?.executions.map((execution) => execution.candidate.candidate.effectId)

describe('a zone acting at a turn boundary (SPELLS-20 T4b2b)', () => {
  it('deals its failed-save damage at the start of the turn of a creature standing in it', async () => {
    const zone = placedZone(0x3a1, authoredZone(['START_TURN_IN_SPACE']), 1)
    const phase = await complete(prepare({ zones: [zone], boundary: START }))
    expect(phase.plan?.executions).toHaveLength(1)
    const [execution] = phase.plan!.executions
    expect(execution).toMatchObject({
      ordinal: 0,
      candidate: {
        boundaryOrdinal: 1,
        candidate: {
          effectId: zone.id,
          sourceActorId: SOURCE_ID,
          targetActorId: GOBLIN_ID,
          trigger: 'START_OF_TURN'
        }
      }
    })
    expect(execution!.targetTransition.after.currentHitPoints).toBe(
      execution!.targetTransition.before.currentHitPoints - 1
    )
    expect(hitPoints(phase.actors, GOBLIN_ID)).toBe(
      execution!.targetTransition.after.currentHitPoints
    )
    expect(hitPoints(phase.actors, SOURCE_ID)).toBe(hitPoints(actors, SOURCE_ID))
  })

  it('acts only at the boundary it names', async () => {
    const startOnly = placedZone(0x3a1, authoredZone(['START_TURN_IN_SPACE']), 1)
    const endOnly = placedZone(0x3a2, authoredZone(['END_TURN_IN_SPACE']), 2)
    const atEnd = await complete(prepare({ zones: [startOnly, endOnly], boundary: END }))
    expect(effectIds(atEnd.plan)).toEqual([endOnly.id])
    expect(atEnd.plan?.executions[0]?.candidate.boundaryOrdinal).toBe(0)
    const atStart = await complete(prepare({ zones: [startOnly, endOnly], boundary: START }))
    expect(effectIds(atStart.plan)).toEqual([startOnly.id])
  })

  it('applies two zones at one boundary in effect-id order, each from the state the last left', async () => {
    const authored = authoredZone(['START_TURN_IN_SPACE'])
    const later = placedZone(0x3a9, authored, 1)
    const earlier = placedZone(0x3a3, authored, 2)
    const phase = await complete(prepare({ zones: [later, earlier], boundary: START }))
    expect(effectIds(phase.plan)).toEqual([earlier.id, later.id])
    const [first, second] = phase.plan!.executions
    expect(second!.targetTransition.before).toEqual(first!.targetTransition.after)
    expect(second!.targetTransition.after.currentHitPoints).toBe(
      second!.targetTransition.before.currentHitPoints - 1
    )
    expect(hitPoints(phase.actors, GOBLIN_ID)).toBe(second!.targetTransition.after.currentHitPoints)
  })

  it('does not catch a creature that stands outside the zone', async () => {
    const zone = placedZone(0x3a1, authoredZone(['START_TURN_IN_SPACE']), 1)
    const phase = await complete(
      prepare({ zones: [zone], boundary: { ...START, actorId: SOURCE_ID } })
    )
    expect(phase.plan).toBeNull()
    expect(phase.actors).toBe(actors)
  })

  it('answers the contacted creature’s save, then the zone source’s damage die, each by its own roller', async () => {
    const zone = placedZone(0x3a1, authoredZone(['START_TURN_IN_SPACE']), 1)
    const saveRequest = await pending(
      prepare({ zones: [zone], boundary: START, autoRollByActorId: {} })
    )
    expect(turnPendingActorId(saveRequest)).toBe(GOBLIN_ID)
    expect(
      projectNativeTurnPending({
        snapshot: saveRequest,
        occurrenceId: OCCURRENCE_ID,
        occurrenceVersion: 1,
        encounterVersion: 7
      })
    ).toMatchObject({ kind: 'D20_EVIDENCE', rollerActorId: GOBLIN_ID })
    if (saveRequest.snapshotKind !== 'KERNEL_EVIDENCE')
      throw new Error('Expected a kernel request.')

    const dieRequest = await pending(
      prepare({
        zones: [zone],
        boundary: START,
        autoRollByActorId: {},
        pending: saveRequest,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: saveRequest.request.requestId,
          rawFaces: [1],
          rollMode: 'NORMAL'
        }
      })
    )
    expect(turnPendingActorId(dieRequest)).toBe(SOURCE_ID)
    expect(
      projectNativeTurnPending({
        snapshot: dieRequest,
        occurrenceId: OCCURRENCE_ID,
        occurrenceVersion: 1,
        encounterVersion: 7
      })
    ).toMatchObject({ kind: 'ACTION_OUTCOME_EVIDENCE', rollerActorId: SOURCE_ID })
    if (dieRequest.snapshotKind !== 'KERNEL_EVIDENCE') throw new Error('Expected a kernel request.')

    const phase = await complete(
      prepare({
        zones: [zone],
        boundary: START,
        autoRollByActorId: {},
        pending: dieRequest,
        resolution: { kind: 'ENTER_INTEGER', requestId: dieRequest.request.requestId, value: 3 }
      })
    )
    const [execution] = phase.plan!.executions
    expect(execution!.targetTransition.after.currentHitPoints).toBe(
      execution!.targetTransition.before.currentHitPoints - 3
    )
  })

  it('applies a zone with a per-turn limit once per turn and not again until the turn changes', async () => {
    const zone = placedZone(0x3a1, authoredZone(['START_TURN_IN_SPACE'], 1), 1)
    const spent = (turnSequence: number) => ({
      ...srdEncounterState({ actors, currentActorId: GOBLIN_ID, turnSequence: 3 }),
      zoneApplications: { [zoneApplicationKey(zone.id, GOBLIN_ID)]: { turnSequence, count: 1 } }
    })
    // The incoming turn is sequence 4; an application counted for it is spent, an earlier turn's is not.
    expect(
      (await complete(prepare({ zones: [zone], boundary: START, state: spent(4) }))).plan
    ).toBeNull()
    expect(
      effectIds((await complete(prepare({ zones: [zone], boundary: START, state: spent(3) }))).plan)
    ).toEqual([zone.id])
  })
})

describe('the stored evidence of a zone phase (SPELLS-20 T4b2b)', () => {
  const ORDER = [GOBLIN_ID, SOURCE_ID]

  /** A real zone phase and the initiative advance of the same turn, as the stored result holds them. */
  async function storedResult(zones: readonly EncounterSpatialRuleEffectRecord[]) {
    const plan = (await complete(prepare({ zones, boundary: START }))).plan!
    const round = await roundAt(ORDER, GOBLIN_ID, 'ENCOUNTER_START')
    return {
      status: 'INITIATIVE_COMPLETE' as const,
      schemaVersion: 1 as const,
      occurrenceId: OCCURRENCE_ID,
      occurrenceVersion: 1,
      encounterId: ENCOUNTER_ID,
      commandType: 'ADVANCE_TURN' as const,
      initiativeAdvance: planEncounterInitiativeAdvance({
        state: round,
        currentActorId: GOBLIN_ID,
        defeatedActorIds: new Set<string>()
      }),
      incomingZoneEffects: {
        kind: 'EXECUTED' as const,
        selectionChecksum: plan.selectionChecksum,
        executions: plan.executions,
        characterTransitions: [],
        encounterActorTransitions: [
          {
            targetActorId: GOBLIN_ID,
            before: plan.executions[0]!.targetTransition.before,
            after: plan.executions.at(-1)!.targetTransition.after
          }
        ]
      }
    }
  }

  const authored = authoredZone(['START_TURN_IN_SPACE'])
  const twoZones = () => [placedZone(0x3a9, authored, 1), placedZone(0x3a3, authored, 2)]
  const parse = (result: object) => initiativeCompleteRuleExecutionResultDtoSchema.safeParse(result)

  it('accepts what the planner produced', async () => {
    const result = await storedResult(twoZones())
    expect(parse(result).success).toBe(true)
  })

  it('rejects an outgoing zone phase on a START command', async () => {
    const { incomingZoneEffects, ...result } = await storedResult(twoZones())
    expect(
      parse({ ...result, commandType: 'START', outgoingZoneEffects: incomingZoneEffects }).success
    ).toBe(false)
  })

  it('rejects executions out of effect-id order and a phase with none', async () => {
    const result = await storedResult(twoZones())
    const { incomingZoneEffects: phase } = result
    expect(
      parse({
        ...result,
        incomingZoneEffects: { ...phase, executions: [...phase.executions].reverse() }
      }).success
    ).toBe(false)
    expect(parse({ ...result, incomingZoneEffects: { ...phase, executions: [] } }).success).toBe(
      false
    )
  })

  it('rejects a phase whose owner transitions are not exactly one', async () => {
    const result = await storedResult(twoZones())
    const { incomingZoneEffects: phase } = result
    expect(
      parse({
        ...result,
        incomingZoneEffects: {
          ...phase,
          encounterActorTransitions: [
            ...phase.encounterActorTransitions,
            ...phase.encounterActorTransitions
          ]
        }
      }).success
    ).toBe(false)
  })
})
