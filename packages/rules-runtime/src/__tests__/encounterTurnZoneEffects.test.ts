import { beforeAll, describe, expect, it } from 'vitest'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { initiativeCompleteRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResultBranches'
import { zoneApplicationKey } from '@artificer-toolkit/shared/vtt'
import { SRD_DAMAGE_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { EncounterResponseAnswer } from '../encounterEvidenceAnswer.js'
import { planEncounterInitiativeAdvance } from '../encounterInitiativeStateSettlement.js'
import { projectNativeTurnPending, turnPendingActorId } from '../encounterTurnPending.js'
import { prepareEncounterTurnZoneEffects } from '../encounterTurnZoneEffects.js'
import type { RulesRuntimeService } from '../rulesRuntimeService.js'
import {
  createSrdRulesRuntime,
  ENCOUNTER_ID,
  srdCreatureActor,
  srdCreatureTarget,
  srdDefinitions,
  srdEncounterState,
  testUuid
} from '../testing/dnd5eSrdEncounter.js'
import { SRD, srdByLabel } from '../testing/dnd5eSrdCharacter.js'
import { DND5E_SYSTEM_ID } from '../systems/dnd5e/identity.js'
import { encounterRuleUsageUsed, withEncounterRuleUsageUsed } from '../encounterActorState.js'
import { SRD_ACTION_ALLOWANCE_DEFINITION_ID as ACTION } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  failedSaveOnly,
  losesAction,
  lostActionOutcome,
  noSave
} from '../testing/authoredZoneFixture.js'
import { SLEEP_CONDITION_ID, sleepEffectOn } from '../testing/sleepEffectFixture.js'
import { roundAt } from './encounterInitiativeFixtures.js'
import {
  actorIdByTokenId,
  actors,
  AUTO_ROLL,
  authoredZone,
  END,
  GM_USER_ID,
  goblin,
  GOBLIN_ID,
  OCCURRENCE_ID,
  placedZone,
  root,
  SOURCE_ID,
  source,
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
  /** The Scene's tokens and the encounter's actors; the fixture's by default. */
  tokens?: typeof tokens
  actors?: typeof actors
  actorIdByTokenId?: typeof actorIdByTokenId
  /** Whether the occupant and the zone's source see each other; both do by default. */
  sight?: { occupantSeesSource: boolean; sourceSeesOccupant: boolean }
  /** The effects the goblin carries when the boundary starts. */
  goblinEffects?: Parameters<typeof srdCreatureTarget>[1]
}) {
  const sceneActors = input.actors ?? actors
  return prepareEncounterTurnZoneEffects({
    state:
      input.state ??
      srdEncounterState({ actors: sceneActors, currentActorId: GOBLIN_ID, turnSequence: 3 }),
    userId: GM_USER_ID,
    root,
    occurrenceId: OCCURRENCE_ID,
    actors: sceneActors,
    boundary: input.boundary,
    loadScene: async () => ({
      effects: input.zones,
      tokens: input.tokens ?? tokens,
      actorIdByTokenId: input.actorIdByTokenId ?? actorIdByTokenId
    }),
    loadTarget: async (actorId) =>
      srdCreatureTarget(
        sceneActors.find((actor) => actor.id === actorId)!,
        actorId === GOBLIN_ID ? input.goblinEffects : undefined
      ),
    loadSourceSight: async () =>
      input.sight ?? { occupantSeesSource: true, sourceSeesOccupant: true },
    createRuntime: async () => runtime,
    definitions: srdDefinitions,
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

  it('wakes a creature whose sleep the zone’s damage ends, and releases the condition it held (SPELLS-33.T6e4)', async () => {
    const zone = placedZone(0x3a1, authoredZone(['START_TURN_IN_SPACE']), 1)
    const sleeper = sleepEffectOn({
      encounterId: ENCOUNTER_ID,
      id: testUuid(0x3d1),
      sourceActorId: SOURCE_ID,
      holder: goblin
    })
    const asleep = srdCreatureActor({
      id: GOBLIN_ID,
      creature: srdByLabel(SRD.creatures, 'Goblin'),
      conditionIds: [SLEEP_CONDITION_ID]
    })
    const phase = await complete(
      prepare({
        zones: [zone],
        boundary: START,
        actors: [asleep, source],
        goblinEffects: [sleeper]
      })
    )
    expect(phase.plan?.executions).toHaveLength(1)
    const woken = phase.actors.find(({ id }) => id === GOBLIN_ID)
    expect(woken && woken.kind !== 'CHARACTER' ? woken.conditions : null).toEqual([])
    expect(phase.movementTargets.get(GOBLIN_ID)?.activeEffects).toEqual([])
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
        gameSystemId: DND5E_SYSTEM_ID,
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
        gameSystemId: DND5E_SYSTEM_ID,
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

describe('a zone that catches only some creatures (SPELLS-20 T4b3a)', () => {
  /** The goblin moved half its width out of the zone: it still shares area with it. */
  const partlyOut = tokens.map((token) =>
    token.id === tokens[0]!.id
      ? { ...token, position: { x: token.position.x + 50, y: token.position.y } }
      : token
  )
  const fullyWithin = authoredZone(['START_TURN_IN_SPACE'], undefined, {
    requiresFullyWithin: true
  })

  it('catches a creature whose whole space is inside a zone that requires it', async () => {
    const zone = placedZone(0x3a1, fullyWithin, 1)
    const phase = await complete(prepare({ zones: [zone], boundary: START }))
    expect(effectIds(phase.plan)).toEqual([zone.id])
  })

  it('does not catch a creature only partly inside a zone that requires it fully within', async () => {
    const zone = placedZone(0x3a1, fullyWithin, 1)
    const phase = await complete(prepare({ zones: [zone], boundary: START, tokens: partlyOut }))
    expect(phase.plan).toBeNull()
    // The same footprint is caught by a zone that needs only overlap.
    const overlap = placedZone(0x3a2, authoredZone(['START_TURN_IN_SPACE']), 1)
    const caught = await complete(prepare({ zones: [overlap], boundary: START, tokens: partlyOut }))
    expect(effectIds(caught.plan)).toEqual([overlap.id])
  })

  it('lets a creature immune to the authored damage type succeed automatically on the zone save', async () => {
    const skeleton = srdCreatureActor({
      id: GOBLIN_ID,
      creature: srdByLabel(SRD.creatures, 'Skeleton')
    })
    const immunityZone = (offset: number, damageTypeCode: string) =>
      placedZone(
        offset,
        authoredZone(['START_TURN_IN_SPACE'], undefined, {
          automaticSaveSuccessImmunityDamageTypeId: SRD_DAMAGE_TYPES.find(
            ({ code }) => code === damageTypeCode
          )?.id
        }),
        1
      )
    const zone = immunityZone(0x3a1, 'POISON')
    const phase = await complete(
      prepare({ zones: [zone], boundary: START, actors: [skeleton, source] })
    )
    // The scripted roll is the lowest face, which fails the save unless it succeeds unrolled.
    const [execution] = phase.plan!.executions
    expect(execution!.targetTransition.after).toEqual(execution!.targetTransition.before)
    // The Skeleton is not immune to fire, so a zone naming fire takes its roll.
    const firePhase = await complete(
      prepare({ zones: [immunityZone(0x3a2, 'FIRE')], boundary: START, actors: [skeleton, source] })
    )
    const [burned] = firePhase.plan!.executions
    expect(burned!.targetTransition.after.currentHitPoints).toBe(
      burned!.targetTransition.before.currentHitPoints - 1
    )
    // A creature without the immunity fails the same save.
    const goblinPhase = await complete(prepare({ zones: [zone], boundary: START }))
    const [failed] = goblinPhase.plan!.executions
    expect(failed!.targetTransition.after.currentHitPoints).toBe(
      failed!.targetTransition.before.currentHitPoints - 1
    )
  })
})

describe('a zone that needs sight of its source (SPELLS-33.T6e)', () => {
  const sightZone = (requiredSight: ('OCCUPANT_SEES_SOURCE' | 'SOURCE_SEES_OCCUPANT')[]) =>
    placedZone(0x3a1, authoredZone(['START_TURN_IN_SPACE'], undefined, { requiredSight }), 1)
  const saved = (phase: Awaited<ReturnType<typeof complete>>) => {
    const [execution] = phase.plan!.executions
    return (
      execution!.targetTransition.after.currentHitPoints ===
      execution!.targetTransition.before.currentHitPoints
    )
  }

  it('rolls the save of an occupant that sees the source, which the lowest face fails', async () => {
    const zone = sightZone(['OCCUPANT_SEES_SOURCE'])
    expect(saved(await complete(prepare({ zones: [zone], boundary: START })))).toBe(false)
  })

  it('lets an occupant that cannot see the source succeed on the save unrolled', async () => {
    const zone = sightZone(['OCCUPANT_SEES_SOURCE'])
    const phase = await complete(
      prepare({
        zones: [zone],
        boundary: START,
        sight: { occupantSeesSource: false, sourceSeesOccupant: true }
      })
    )
    expect(saved(phase)).toBe(true)
    expect(phase.plan!.executions[0]!.execution.outputs.resultPath).toBe('ON_SAVE_SUCCESS')
  })

  it('needs each sight the zone names, and ignores one it does not', async () => {
    const both = sightZone(['OCCUPANT_SEES_SOURCE', 'SOURCE_SEES_OCCUPANT'])
    const unseenBySource = { occupantSeesSource: true, sourceSeesOccupant: false }
    expect(
      saved(await complete(prepare({ zones: [both], boundary: START, sight: unseenBySource })))
    ).toBe(true)
    const occupantOnly = sightZone(['OCCUPANT_SEES_SOURCE'])
    expect(
      saved(
        await complete(prepare({ zones: [occupantOnly], boundary: START, sight: unseenBySource }))
      )
    ).toBe(false)
  })

  it('reads no sight for a zone that needs none', async () => {
    const zone = placedZone(0x3a1, authoredZone(['START_TURN_IN_SPACE']), 1)
    const phase = await complete(
      prepare({
        zones: [zone],
        boundary: START,
        sight: { occupantSeesSource: false, sourceSeesOccupant: false }
      })
    )
    expect(saved(phase)).toBe(false)
  })
})

describe('a zone whose failed save costs the Action (SPELLS-20 T4b3b, D141)', () => {
  const lostActionZone = (offset: number, componentOptions = {}) =>
    placedZone(
      offset,
      authoredZone(
        ['START_TURN_IN_SPACE'],
        undefined,
        componentOptions,
        failedSaveOnly(lostActionOutcome())
      ),
      1
    )
  const actionsUsed = (list: readonly EncounterRunActorState[], id: string) =>
    encounterRuleUsageUsed(
      list.find((actor) => actor.id === id)!,
      ACTION
    )

  it('spends the unspent Action of a creature failing the save at the start of its turn', async () => {
    const phase = await complete(prepare({ zones: [lostActionZone(0x3a1)], boundary: START }))
    const [execution] = phase.plan!.executions
    expect(execution).toMatchObject({
      applications: [],
      actionEconomy: { definitionId: ACTION, maximum: 1, beforeUsed: 0, afterUsed: 1 }
    })
    expect(execution!.execution.outputs.resultPath).toBe('ON_SAVE_FAIL')
    expect(execution!.targetTransition.after).toEqual(execution!.targetTransition.before)
    expect(actionsUsed(actors, GOBLIN_ID)).toBe(0)
    expect(actionsUsed(phase.actors, GOBLIN_ID)).toBe(1)
    expect(actionsUsed(phase.actors, SOURCE_ID)).toBe(0)
  })

  it('spends nothing when the Action is already spent', async () => {
    const spentGoblin = encounterRunActorStateSchema.parse({
      ...goblin,
      resources: withEncounterRuleUsageUsed(goblin, ACTION, 1)
    })
    const phase = await complete(
      prepare({ zones: [lostActionZone(0x3a1)], boundary: START, actors: [spentGoblin, source] })
    )
    expect(phase.plan!.executions[0]!.actionEconomy).toBeNull()
    expect(actionsUsed(phase.actors, GOBLIN_ID)).toBe(1)
  })

  it('spends the Action once when two such zones catch the creature at one boundary', async () => {
    const phase = await complete(
      prepare({ zones: [lostActionZone(0x3a1), lostActionZone(0x3a2)], boundary: START })
    )
    expect(
      phase.plan!.executions.map(({ actionEconomy }) => actionEconomy?.afterUsed ?? null)
    ).toEqual([1, null])
    expect(actionsUsed(phase.actors, GOBLIN_ID)).toBe(1)
  })

  it('spends nothing on a made save', async () => {
    const skeleton = srdCreatureActor({
      id: GOBLIN_ID,
      creature: srdByLabel(SRD.creatures, 'Skeleton')
    })
    // The Skeleton is immune to poison, so it makes the save without a roll.
    const zone = lostActionZone(0x3a1, {
      automaticSaveSuccessImmunityDamageTypeId: SRD_DAMAGE_TYPES.find(
        ({ code }) => code === 'POISON'
      )?.id
    })
    const phase = await complete(
      prepare({ zones: [zone], boundary: START, actors: [skeleton, source] })
    )
    const [execution] = phase.plan!.executions
    expect(execution!.execution.outputs.resultPath).toBe('ON_SAVE_SUCCESS')
    expect(execution!.actionEconomy).toBeNull()
    expect(actionsUsed(phase.actors, GOBLIN_ID)).toBe(0)
  })

  it('deals the failed save’s damage and spends the Action together', async () => {
    const zone = placedZone(
      0x3a1,
      authoredZone(['START_TURN_IN_SPACE'], undefined, {}, losesAction),
      1
    )
    const phase = await complete(prepare({ zones: [zone], boundary: START }))
    const [execution] = phase.plan!.executions
    expect(execution!.actionEconomy).toMatchObject({ beforeUsed: 0, afterUsed: 1 })
    expect(hitPoints(phase.actors, GOBLIN_ID)).toBe(hitPoints(actors, GOBLIN_ID)! - 1)
    expect(actionsUsed(phase.actors, GOBLIN_ID)).toBe(1)
  })
})

describe('a zone outcome with no save at the start of its source’s turn (SPELLS-20 T6a, D144)', () => {
  // A second goblin whose id sorts before the first, listed last in the Scene, and the source
  // itself, all standing in the zone.
  const OTHER_ID = testUuid(0x300)
  const OTHER_TOKEN_ID = testUuid(0x30a)
  const other = srdCreatureActor({ id: OTHER_ID, creature: srdByLabel(SRD.creatures, 'Goblin') })
  const crowd = [goblin, source, other]
  const crowdTokens = [
    tokens[0]!,
    { ...tokens[1]!, position: tokens[0]!.position },
    { ...tokens[0]!, id: OTHER_TOKEN_ID }
  ]
  const crowdBindings = new Map([...actorIdByTokenId, [OTHER_TOKEN_ID, OTHER_ID]])
  const SOURCE_START = { ...START, actorId: SOURCE_ID }
  const aura = () =>
    placedZone(
      0x3a1,
      authoredZone([], undefined, {}, (parts) => noSave()(parts)),
      1
    )
  const prepareCrowd = (input: Omit<Parameters<typeof prepare>[0], 'zones'>) =>
    prepare({
      zones: [aura()],
      actors: crowd,
      tokens: crowdTokens,
      actorIdByTokenId: crowdBindings,
      ...input
    })

  it('deals its damage to every other creature in it, ordered by actorId, with no save', async () => {
    const phase = await complete(prepareCrowd({ boundary: SOURCE_START }))
    const executions = phase.plan!.executions
    expect(executions.map(({ candidate }) => candidate.candidate)).toMatchObject([
      { targetActorId: OTHER_ID, sourceActorId: SOURCE_ID, trigger: 'START_OF_SOURCE_TURN' },
      { targetActorId: GOBLIN_ID, sourceActorId: SOURCE_ID, trigger: 'START_OF_SOURCE_TURN' }
    ])
    for (const execution of executions) {
      expect(execution.candidate.d20Policy).toBeNull()
      expect(execution.targetTransition.after.currentHitPoints).toBe(
        execution.targetTransition.before.currentHitPoints - 1
      )
    }
    for (const id of [OTHER_ID, GOBLIN_ID])
      expect(hitPoints(phase.actors, id)).toBe(hitPoints(crowd, id)! - 1)
    expect(hitPoints(phase.actors, SOURCE_ID)).toBe(hitPoints(crowd, SOURCE_ID))
  })

  it('stays quiet at the start of another creature’s turn and at the end of its source’s', async () => {
    for (const boundary of [START, { ...END, actorId: SOURCE_ID }]) {
      const phase = await complete(prepareCrowd({ boundary }))
      expect(phase.plan).toBeNull()
    }
  })

  it('waits on its source for each creature’s damage die when the source does not auto-roll', async () => {
    let result = await prepareCrowd({ boundary: SOURCE_START, autoRollByActorId: {} })
    const values = [4, 2]
    while (result.kind === 'PENDING') {
      const snapshot = result.snapshot
      expect(turnPendingActorId(snapshot)).toBe(SOURCE_ID)
      expect(
        projectNativeTurnPending({
          gameSystemId: DND5E_SYSTEM_ID,
          snapshot,
          occurrenceId: OCCURRENCE_ID,
          occurrenceVersion: 1,
          encounterVersion: 7
        })
      ).toMatchObject({ kind: 'ACTION_OUTCOME_EVIDENCE', rollerActorId: SOURCE_ID })
      if (snapshot.snapshotKind !== 'KERNEL_EVIDENCE') throw new Error('Expected a kernel request.')
      const value = values.shift()
      if (value === undefined) throw new Error('Expected one die per creature.')
      result = await prepareCrowd({
        boundary: SOURCE_START,
        autoRollByActorId: {},
        pending: snapshot,
        resolution: { kind: 'ENTER_INTEGER', requestId: snapshot.request.requestId, value }
      })
    }
    expect(values).toEqual([])
    const damage = result.plan!.executions.map(
      ({ targetTransition }) =>
        targetTransition.before.currentHitPoints - targetTransition.after.currentHitPoints
    )
    expect(damage).toEqual([4, 2])
  })

  it('stores one chained mechanics batch per creature it caught, in canonical order', async () => {
    const plan = (await complete(prepareCrowd({ boundary: SOURCE_START }))).plan!
    const round = await roundAt([GOBLIN_ID, SOURCE_ID, OTHER_ID], SOURCE_ID, 'ENCOUNTER_START')
    const result = {
      status: 'INITIATIVE_COMPLETE' as const,
      schemaVersion: 1 as const,
      occurrenceId: OCCURRENCE_ID,
      occurrenceVersion: 1,
      encounterId: ENCOUNTER_ID,
      commandType: 'ADVANCE_TURN' as const,
      initiativeAdvance: planEncounterInitiativeAdvance({
        state: round,
        currentActorId: SOURCE_ID,
        defeatedActorIds: new Set<string>()
      }),
      incomingZoneEffects: {
        kind: 'EXECUTED' as const,
        selectionChecksum: plan.selectionChecksum,
        executions: plan.executions,
        characterTransitions: [],
        encounterActorTransitions: plan.executions.map(({ candidate, targetTransition }) => ({
          targetActorId: candidate.candidate.targetActorId,
          before: targetTransition.before,
          after: targetTransition.after
        }))
      }
    }
    const parse = (value: object) =>
      initiativeCompleteRuleExecutionResultDtoSchema.safeParse(value).success
    const phase = result.incomingZoneEffects
    expect(parse(result)).toBe(true)
    expect(
      parse({
        ...result,
        incomingZoneEffects: { ...phase, executions: [...phase.executions].reverse() }
      })
    ).toBe(false)
    expect(
      parse({
        ...result,
        incomingZoneEffects: {
          ...phase,
          encounterActorTransitions: phase.encounterActorTransitions.slice(1)
        }
      })
    ).toBe(false)
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
