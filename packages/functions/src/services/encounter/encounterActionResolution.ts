import { randomUUID } from 'node:crypto'
import { z } from 'zod'

import type { EncounterRecord, RulePackRecord, RulePackRevisionRecord } from '@artificer-toolkit/db'
import type { DBLike } from '@artificer-toolkit/db'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { RollRecordDto, RollSourceDto } from '@artificer-toolkit/schema/api/rolls'
import {
  ruleEvaluationDtoSchema,
  ruleResolutionEvidenceDtoSchema,
  type ProposedRuleOutcomeDto,
  type RuleEvaluationDto,
  type RuleModelKeyDto,
  type RuleOutcomeOverrideDto,
  type RuleResolutionEvidenceDto,
  type RuleRollRequestDto
} from '@artificer-toolkit/schema/api/rules'

import { evaluateRuleRevision } from '../rules/ruleRevisionRuntime.js'
import { executeDiceConfiguration } from '../rolls/rollService.js'
import type { LiveSessionCommandAuthority } from '../campaign/liveSessionCommandAuthority.js'
import { buildEncounterActionFacts } from './encounterActionFacts.js'
import { EncounterValidationError } from './encounterErrors.js'
import { applyEncounterRuleOutcomes } from './encounterOutcomeApplication.js'

type JsonValue = z.infer<ReturnType<typeof z.json>>

function rollSourceKind(kind: RuleRollRequestDto['kind']): RollSourceDto['kind'] {
  switch (kind) {
    case 'ATTACK':
      return 'ATTACK'
    case 'SAVE':
      return 'SAVING_THROW'
    case 'CHECK':
      return 'ABILITY_CHECK'
    case 'DAMAGE':
      return 'DAMAGE'
    case 'HEAL':
      return 'HEALING'
    case 'CUSTOM':
      return 'MANUAL'
  }
}

function requireJsonObject(value: JsonValue): Record<string, JsonValue | undefined> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new EncounterValidationError('Normalized rule facts must be an object.')
  }
  return value
}

function validateOutputTargets(
  outcomes: ProposedRuleOutcomeDto[],
  allowedActorIds: Set<string>
): void {
  if (
    outcomes.some(
      (outcome) => outcome.kind !== 'MANUAL' && !allowedActorIds.has(outcome.targetActorId)
    )
  ) {
    throw new EncounterValidationError('The rule model proposed an actor outside this action.')
  }
}

function evaluateOutput(result: JsonValue): RuleEvaluationDto {
  const parsed = ruleEvaluationDtoSchema.safeParse(result)
  if (!parsed.success) {
    throw new EncounterValidationError('The rule model returned an invalid resolution shape.')
  }
  return parsed.data
}

function rollRequestRecord(input: {
  request: RuleRollRequestDto
  encounter: EncounterRecord
  pack: RulePackRecord
  actingActorId: string
}): RollRecordDto {
  const target = input.request.targetActorId
    ? input.encounter.actors.find((actor) => actor.id === input.request.targetActorId)
    : undefined
  const actingActor = input.encounter.actors.find((actor) => actor.id === input.actingActorId)
  const systemId =
    target?.systemId ??
    actingActor?.systemId ??
    input.encounter.actors.find((actor) => actor.systemId !== null)?.systemId
  if (!systemId) {
    throw new EncounterValidationError('Rule rolls require a system-backed Encounter actor.')
  }
  let result
  try {
    result = executeDiceConfiguration({ configuration: input.request.configuration })
  } catch {
    throw new EncounterValidationError(
      `Rule roll "${input.request.label}" has an invalid dice expression.`
    )
  }
  return {
    id: result.id,
    normalizedExpression: result.normalizedExpression,
    evidence: result.evidence,
    characterId: target?.kind === 'CHARACTER' ? target.sourceId : null,
    characterLabel: target?.label ?? actingActor?.label ?? 'Encounter action',
    source: {
      kind: rollSourceKind(input.request.kind),
      label: input.request.label
    },
    ruleset: {
      systemId,
      code: input.pack.rulesetCode,
      version: input.pack.version
    },
    createdAt: new Date().toISOString()
  }
}

async function evaluateModel(input: {
  db: DBLike
  revisionId: string
  modelKey: string
  context: JsonValue
}): Promise<{
  evaluation: RuleEvaluationDto
  trace: JsonValue | null
  zenEvaluationMs: number
}> {
  try {
    const result = await evaluateRuleRevision({
      db: input.db,
      revisionId: input.revisionId,
      modelKey: input.modelKey,
      contractKey: 'encounter-resolve',
      normalizedFacts: input.context,
      trace: true
    })
    return {
      evaluation: evaluateOutput(result.result),
      trace: result.trace,
      zenEvaluationMs: result.evaluationDurationMs
    }
  } catch (error) {
    if (error instanceof EncounterValidationError) throw error
    const detail = error instanceof Error ? ` ${error.message.slice(0, 300)}` : ''
    throw new EncounterValidationError(
      `The pinned rule model could not resolve this action.${detail}`
    )
  }
}

export async function resolveEncounterAction(input: {
  db: DBLike
  userId: string
  encounter: EncounterRecord
  command: {
    encounterId: string
    commandId: string
    expectedVersion: number
    type: 'RESOLVE_ACTION'
    actorId: string
    modelKey: RuleModelKeyDto
    targetActorIds: readonly string[]
    selections: unknown
    visibility: 'PRIVATE' | 'TABLE'
    override?: RuleOutcomeOverrideDto
  }
  pack: RulePackRecord
  revision: RulePackRevisionRecord
  actorRules: EncounterActorRuleOutput
  liveSessionAuthority?: LiveSessionCommandAuthority
}): Promise<{
  evidence: RuleResolutionEvidenceDto
  correlationId: string
  zenEvaluationMs: number
}> {
  if (input.revision.state === 'DRAFT') {
    throw new EncounterValidationError('Encounter rule revisions must be activated.')
  }
  const normalizedFacts = await buildEncounterActionFacts({
    db: input.db,
    userId: input.userId,
    encounter: input.encounter,
    command: input.command,
    actorRules: input.actorRules
  })
  const allowedActorIds = new Set([input.command.actorId, ...input.command.targetActorIds])
  const initial = await evaluateModel({
    db: input.db,
    revisionId: input.revision.id,
    modelKey: input.command.modelKey,
    context: normalizedFacts
  })
  if (initial.evaluation.rollRequests.length > 0 && initial.evaluation.outcomes.length > 0) {
    throw new EncounterValidationError(
      'Rule models must request rolls before proposing roll-dependent outcomes.'
    )
  }
  if (
    initial.evaluation.rollRequests.some(
      (request) => request.targetActorId && !allowedActorIds.has(request.targetActorId)
    )
  ) {
    throw new EncounterValidationError('The rule model requested a roll for an unrelated actor.')
  }
  if (!initial.evaluation.eligibility.allowed && !input.command.override) {
    throw new EncounterValidationError(initial.evaluation.eligibility.reasonCode)
  }

  const requestedRolls = initial.evaluation.rollRequests.map((request) => ({
    request,
    record: rollRequestRecord({
      request,
      encounter: input.encounter,
      pack: input.pack,
      actingActorId: input.command.actorId
    })
  }))
  let final = initial
  if (requestedRolls.length > 0) {
    const resolvedContext = z.json().parse({
      ...requireJsonObject(normalizedFacts),
      rolls: requestedRolls.map(({ request, record }) => ({
        requestId: request.id,
        targetActorId: request.targetActorId,
        rollId: record.id,
        normalizedExpression: record.normalizedExpression,
        total: record.evidence.total,
        evidence: record.evidence
      }))
    })
    final = await evaluateModel({
      db: input.db,
      revisionId: input.revision.id,
      modelKey: input.command.modelKey,
      context: resolvedContext
    })
    if (final.evaluation.rollRequests.length > 0) {
      throw new EncounterValidationError('Rule models cannot request more than one roll stage.')
    }
    if (!final.evaluation.eligibility.allowed && !input.command.override) {
      throw new EncounterValidationError(final.evaluation.eligibility.reasonCode)
    }
  }

  validateOutputTargets(final.evaluation.outcomes, allowedActorIds)
  const effectiveOutcomes = input.command.override?.outcomes ?? final.evaluation.outcomes
  validateOutputTargets(effectiveOutcomes, allowedActorIds)
  const correlationId = randomUUID()
  const appliedOutcomes = await applyEncounterRuleOutcomes({
    db: input.db,
    userId: input.userId,
    encounter: input.encounter,
    outcomes: effectiveOutcomes,
    allowedActorIds,
    overridden: input.command.override !== undefined,
    correlationId,
    actorRules: input.actorRules,
    ...(input.liveSessionAuthority ? { liveSessionAuthority: input.liveSessionAuthority } : {})
  })
  const trace = z.json().parse({
    initial: initial.trace,
    resolved: requestedRolls.length > 0 ? final.trace : null
  })
  return {
    correlationId,
    zenEvaluationMs:
      initial.zenEvaluationMs + (requestedRolls.length > 0 ? final.zenEvaluationMs : 0),
    evidence: ruleResolutionEvidenceDtoSchema.parse({
      rulePackRevisionId: input.revision.id,
      checksum: input.revision.checksum,
      evaluatorKind: input.revision.evaluatorKind,
      evaluatorVersion: input.revision.evaluatorVersion,
      modelContractVersion: input.revision.modelContractVersion,
      modelKey: input.command.modelKey,
      normalizedFacts,
      trace,
      rolls: requestedRolls.map(({ record }) => record),
      proposedOutcomes: final.evaluation.outcomes,
      appliedOutcomes,
      override: input.command.override ?? null
    })
  }
}
