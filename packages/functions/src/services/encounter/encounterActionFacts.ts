import { z } from 'zod'

import type { DBLike, EncounterActorRecord, EncounterRecord } from '@artificer-toolkit/db'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'

import { getCharacterSheetForUser } from '../character/characterApplicationService.js'
import { snapshotFeatures } from './encounterActorState.js'
import { requireEncounterActorRuleResult } from './encounterActorRuleEvaluation.js'
import { EncounterValidationError } from './encounterErrors.js'
import { snapshotStatBlock } from './encounterProjection.js'

type RuleFacts = z.infer<ReturnType<typeof z.json>>

function requireActor(encounter: EncounterRecord, actorId: string): EncounterActorRecord {
  const actor = encounter.actors.find((candidate) => candidate.id === actorId)
  if (!actor) throw new EncounterValidationError('Encounter actor was not found.')
  return actor
}

async function actorFacts(
  db: DBLike,
  userId: string,
  actor: EncounterActorRecord,
  actorRules: EncounterActorRuleOutput
): Promise<RuleFacts> {
  if (actor.kind === 'CHARACTER' && actor.sourceId) {
    const sheet = await getCharacterSheetForUser(db, actor.sourceId, userId)
    if (!sheet) throw new EncounterValidationError(`Character "${actor.label}" is unavailable.`)
    return z.json().parse({
      id: actor.id,
      kind: actor.kind,
      label: actor.label,
      systemId: actor.systemId,
      hitPoints: {
        current: sheet.overview.currentHitPoints,
        maximum: sheet.overview.maxHitPoints,
        temporary: sheet.overview.tempHitPoints
      },
      armorClass: sheet.overview.armorClass,
      conditions: sheet.overview.conditions,
      savingThrows: sheet.overview.savingThrows,
      resources: sheet.resources.items,
      actions: sheet.actions.items
    })
  }

  return z.json().parse({
    id: actor.id,
    kind: actor.kind,
    label: actor.label,
    systemId: actor.systemId,
    hitPoints: {
      current: actor.currentHitPoints,
      maximum: actor.maxHitPoints,
      temporary: actor.tempHitPoints
    },
    conditions: actor.conditions,
    resources: actor.resources,
    statBlock: snapshotStatBlock(actor),
    features: snapshotFeatures(actor, requireEncounterActorRuleResult(actorRules, actor.id))
  })
}

export async function buildEncounterActionFacts(input: {
  db: DBLike
  userId: string
  encounter: EncounterRecord
  command: ResolveEncounterActionInputDto
  actorRules: EncounterActorRuleOutput
}): Promise<RuleFacts> {
  const actor = requireActor(input.encounter, input.command.actorId)
  const targets = input.command.targetActorIds.map((actorId) =>
    requireActor(input.encounter, actorId)
  )
  const [resolvedActor, resolvedTargets] = await Promise.all([
    actorFacts(input.db, input.userId, actor, input.actorRules),
    Promise.all(
      targets.map((target) => actorFacts(input.db, input.userId, target, input.actorRules))
    )
  ])

  return z.json().parse({
    encounter: {
      id: input.encounter.id,
      status: input.encounter.status,
      round: input.encounter.round,
      currentActorId: input.encounter.currentActorId
    },
    action: {
      actorId: actor.id,
      targetActorIds: targets.map((target) => target.id),
      choices: input.command.selections
    },
    actor: resolvedActor,
    targets: resolvedTargets,
    rolls: []
  })
}
