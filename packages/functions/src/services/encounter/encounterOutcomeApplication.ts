import { randomUUID } from 'node:crypto'
import { sql } from 'kysely'
import { z } from 'zod'

import {
  createEncounterRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord
} from '@artificer-toolkit/db'
import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import {
  appliedRuleOutcomeDtoSchema,
  type AppliedRuleOutcomeDto,
  type ProposedRuleOutcomeDto
} from '@artificer-toolkit/schema/api/rules'

import { getCharacterSheetForUser } from '../character/characterApplicationService.js'
import { executeCharacterSheetCommand } from '../character/sheetService.js'
import type { LiveSessionCommandAuthority } from '../campaign/liveSessionCommandAuthority.js'
import {
  featureChargeUsed,
  snapshotFeatureDefinitions,
  withFeatureChargeUsed
} from './encounterActorState.js'
import { findEncounterFeatureResource } from './encounterActorRuleEvaluation.js'
import { EncounterValidationError } from './encounterErrors.js'

type JsonValue = z.infer<ReturnType<typeof z.json>>

interface CharacterOutcomeState {
  actor: EncounterActorRecord
  sheet: CharacterSheetResponseDto
  streamVersion: number
}

function json(value: unknown): JsonValue {
  return z.json().parse(value)
}

function actorState(actor: EncounterActorRecord): JsonValue {
  return json({
    hitPoints: {
      current: actor.currentHitPoints,
      maximum: actor.maxHitPoints,
      temporary: actor.tempHitPoints
    },
    conditions: actor.conditions,
    resources: actor.resources
  })
}

function sheetState(sheet: CharacterSheetResponseDto): JsonValue {
  return json({
    hitPoints: {
      current: sheet.overview.currentHitPoints,
      maximum: sheet.overview.maxHitPoints,
      temporary: sheet.overview.tempHitPoints
    },
    conditions: sheet.overview.conditions,
    resources: sheet.resources.items
  })
}

function enemyConditionIds(actor: EncounterActorRecord): string[] {
  if (
    !Array.isArray(actor.conditions) ||
    actor.conditions.some((condition) => typeof condition !== 'string')
  ) {
    throw new EncounterValidationError(
      `Enemy "${actor.label}" has condition state that cannot be resolved automatically.`
    )
  }
  return actor.conditions.filter((condition): condition is string => typeof condition === 'string')
}

function applyEnemyOutcome(
  actor: EncounterActorRecord,
  outcome: Exclude<ProposedRuleOutcomeDto, { kind: 'MANUAL' }>,
  actorRules: EncounterActorRuleOutput
): EncounterActorRecord {
  switch (outcome.kind) {
    case 'DAMAGE': {
      const absorbed = Math.min(actor.tempHitPoints, outcome.amount)
      return {
        ...actor,
        tempHitPoints: actor.tempHitPoints - absorbed,
        currentHitPoints: Math.max(actor.currentHitPoints - (outcome.amount - absorbed), 0)
      }
    }
    case 'HEAL':
      return outcome.temporary
        ? { ...actor, tempHitPoints: Math.max(actor.tempHitPoints, outcome.amount) }
        : {
            ...actor,
            currentHitPoints: Math.min(actor.currentHitPoints + outcome.amount, actor.maxHitPoints)
          }
    case 'CONDITION': {
      const conditions = enemyConditionIds(actor)
      return {
        ...actor,
        conditions:
          outcome.operation === 'APPLY'
            ? [...new Set([...conditions, outcome.conditionId])]
            : conditions.filter((conditionId) => conditionId !== outcome.conditionId)
      }
    }
    case 'RESOURCE': {
      const feature = snapshotFeatureDefinitions(actor).find(
        (candidate) => candidate.id === outcome.resourceId
      )
      const maximum = feature
        ? (findEncounterFeatureResource(actorRules, actor.id, feature.id)?.maximum ?? null)
        : null
      if (!feature || maximum === null) {
        throw new EncounterValidationError(`Enemy resource "${outcome.resourceId}" is unavailable.`)
      }
      const used = featureChargeUsed(actor, feature.id)
      const nextRemaining = maximum - used + outcome.remainingDelta
      if (nextRemaining < 0 || nextRemaining > maximum) {
        throw new EncounterValidationError(
          `Enemy resource "${outcome.resourceId}" cannot make that change.`
        )
      }
      return {
        ...actor,
        resources: withFeatureChargeUsed(actor, feature.id, maximum - nextRemaining)
      }
    }
  }
}

function characterCommand(
  outcome: Exclude<ProposedRuleOutcomeDto, { kind: 'MANUAL' }>,
  state: CharacterOutcomeState,
  commandId: string
): CharacterSheetCommandInputDto {
  const base = { commandId, expectedVersion: state.streamVersion }
  switch (outcome.kind) {
    case 'DAMAGE':
      return { ...base, type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: outcome.amount }
    case 'HEAL':
      return outcome.temporary
        ? {
            ...base,
            type: 'SET_HIT_POINTS',
            temp: Math.max(state.sheet.overview.tempHitPoints, outcome.amount)
          }
        : { ...base, type: 'ADJUST_HIT_POINTS', mode: 'HEAL', amount: outcome.amount }
    case 'CONDITION':
      return outcome.operation === 'APPLY'
        ? { ...base, type: 'ADD_CONDITION', conditionTypeId: outcome.conditionId }
        : { ...base, type: 'REMOVE_CONDITION', conditionTypeId: outcome.conditionId }
    case 'RESOURCE': {
      const amount = Math.abs(outcome.remainingDelta)
      return outcome.remainingDelta < 0
        ? { ...base, type: 'USE_RESOURCE', resourceGrantId: outcome.resourceId, amount }
        : {
            ...base,
            type: 'RESTORE_RESOURCE',
            resourceGrantId: outcome.resourceId,
            amount
          }
    }
  }
}

async function loadCharacterState(
  db: DBLike,
  userId: string,
  actor: EncounterActorRecord
): Promise<CharacterOutcomeState> {
  if (actor.kind !== 'CHARACTER' || !actor.sourceId) {
    throw new EncounterValidationError('Rule outcome does not target a Character actor.')
  }
  const sheet = await getCharacterSheetForUser(db, actor.sourceId, userId)
  if (!sheet) throw new EncounterValidationError(`Character "${actor.label}" is unavailable.`)
  return { actor, sheet, streamVersion: sheet.meta.streamVersion }
}

async function applyCharacterOutcome(input: {
  db: DBLike
  userId: string
  repository: ReturnType<typeof createEncounterRepository>
  state: CharacterOutcomeState
  outcome: Exclude<ProposedRuleOutcomeDto, { kind: 'MANUAL' }>
  correlationId: string
  liveSessionAuthority?: LiveSessionCommandAuthority
}): Promise<{ applied: AppliedRuleOutcomeDto; state: CharacterOutcomeState }> {
  const before = sheetState(input.state.sheet)
  const commandId = randomUUID()
  const result = await executeCharacterSheetCommand({
    db: input.db,
    characterId: input.state.actor.sourceId as string,
    command: characterCommand(input.outcome, input.state, commandId),
    userId: input.userId,
    ...(input.liveSessionAuthority ? { liveSessionAuthority: input.liveSessionAuthority } : {})
  })
  await sql`
    UPDATE public.character_events
    SET event_data = event_data || jsonb_build_object('correlationId', ${input.correlationId}::text)
    WHERE character_id = ${input.state.actor.sourceId} AND command_id = ${commandId}
  `.execute(input.db)

  const actor = {
    ...input.state.actor,
    currentHitPoints: Math.max(result.sheet.overview.currentHitPoints, 0),
    maxHitPoints: Math.max(result.sheet.overview.maxHitPoints, 0),
    tempHitPoints: Math.max(result.sheet.overview.tempHitPoints, 0),
    conditions: json(result.sheet.overview.conditions)
  }
  await input.repository.updateActor(actor)
  return {
    state: { actor, sheet: result.sheet, streamVersion: result.streamVersion },
    applied: appliedRuleOutcomeDtoSchema.parse({
      proposed: input.outcome,
      status: 'APPLIED',
      before,
      after: sheetState(result.sheet),
      correlatedCommandId: commandId
    })
  }
}

export async function applyEncounterRuleOutcomes(input: {
  db: DBLike
  userId: string
  encounter: EncounterRecord
  outcomes: ProposedRuleOutcomeDto[]
  allowedActorIds: Set<string>
  overridden: boolean
  correlationId: string
  actorRules: EncounterActorRuleOutput
  liveSessionAuthority?: LiveSessionCommandAuthority
}): Promise<AppliedRuleOutcomeDto[]> {
  for (const outcome of input.outcomes) {
    if (outcome.kind !== 'MANUAL' && !input.allowedActorIds.has(outcome.targetActorId)) {
      throw new EncounterValidationError('A rule outcome targeted an actor outside this action.')
    }
  }

  const repository = createEncounterRepository(input.db)
  const actors = new Map(input.encounter.actors.map((actor) => [actor.id, actor]))
  const characterStates = new Map<string, CharacterOutcomeState>()
  const results = new Map<number, AppliedRuleOutcomeDto>()
  const ordered = input.outcomes
    .map((outcome, index) => ({
      outcome,
      index,
      targetActorId: outcome.kind === 'MANUAL' ? '' : outcome.targetActorId
    }))
    .sort((left, right) =>
      left.targetActorId === right.targetActorId
        ? left.index - right.index
        : left.targetActorId.localeCompare(right.targetActorId)
    )

  for (const { outcome, index } of ordered) {
    if (outcome.kind === 'MANUAL') {
      results.set(
        index,
        appliedRuleOutcomeDtoSchema.parse({
          proposed: outcome,
          status: 'MANUAL',
          before: null,
          after: null,
          correlatedCommandId: null
        })
      )
      continue
    }
    const actor = actors.get(outcome.targetActorId)
    if (!actor) throw new EncounterValidationError('Rule outcome actor was not found.')

    if (actor.kind === 'CHARACTER') {
      const state =
        characterStates.get(actor.id) ?? (await loadCharacterState(input.db, input.userId, actor))
      const applied = await applyCharacterOutcome({
        db: input.db,
        userId: input.userId,
        repository,
        state,
        outcome,
        correlationId: input.correlationId,
        ...(input.liveSessionAuthority ? { liveSessionAuthority: input.liveSessionAuthority } : {})
      })
      characterStates.set(actor.id, applied.state)
      actors.set(actor.id, applied.state.actor)
      results.set(
        index,
        input.overridden ? { ...applied.applied, status: 'OVERRIDDEN' as const } : applied.applied
      )
      continue
    }

    const before = actorState(actor)
    const next = applyEnemyOutcome(actor, outcome, input.actorRules)
    await repository.updateActor(next)
    actors.set(actor.id, next)
    results.set(
      index,
      appliedRuleOutcomeDtoSchema.parse({
        proposed: outcome,
        status: input.overridden ? 'OVERRIDDEN' : 'APPLIED',
        before,
        after: actorState(next),
        correlatedCommandId: null
      })
    )
  }

  return input.outcomes.map((_, index) => {
    const result = results.get(index)
    if (!result) throw new Error('Rule outcome was not applied.')
    return result
  })
}
