import type { EncounterActorRecord, EncounterRecord, Json } from '@artificer-toolkit/db'
import { ruleCapabilityReusableDefinitionDocumentDtoSchema } from '@artificer-toolkit/schema/shared/ruleState'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { actionEconomyCapabilityRegistry } from '../rules/actionEconomyCapabilityRegistry.default.js'
import type { CurrentReusableDefinitionSource } from '../rules/ruleCapabilityStateService.js'
import { encounterRuleUsageUsed, withEncounterRuleUsageUsed } from './encounterActorState.js'
import { EncounterConflictError } from './encounterErrors.js'

export interface StagedActionEconomyRefresh {
  ordinal: number
  actorId: string
  capabilityDefinitionId: string
  definitionVersion: number
  definitionChecksum: string
  beforeUsed: number
  afterUsed: 0
}

export interface EncounterActionEconomyRefreshPlan {
  refreshes: readonly StagedActionEconomyRefresh[]
  refreshedActor: EncounterActorRecord | null
}

function mergeActorResourceState(left: Json, right: Json): Json {
  if (
    typeof left !== 'object' ||
    left === null ||
    Array.isArray(left) ||
    typeof right !== 'object' ||
    right === null ||
    Array.isArray(right)
  ) {
    return right
  }
  const merged: { [key: string]: Json | undefined } = { ...left, ...right }
  for (const key of ['featureCharges', 'ruleUsage']) {
    const before = left[key]
    const after = right[key]
    if (
      typeof before === 'object' &&
      before !== null &&
      !Array.isArray(before) &&
      typeof after === 'object' &&
      after !== null &&
      !Array.isArray(after)
    ) {
      merged[key] = { ...before, ...after }
    }
  }
  return merged
}

/** Combines terminal actor writes so independently staged aggregate resource changes survive together. */
export function mergeEncounterActorTerminalUpdates(
  updates: readonly (readonly EncounterActorRecord[])[]
): readonly EncounterActorRecord[] {
  const merged = new Map<string, EncounterActorRecord>()
  for (const group of updates) {
    for (const actor of group) {
      const prior = merged.get(actor.id)
      merged.set(
        actor.id,
        prior
          ? {
              ...prior,
              ...actor,
              resources: mergeActorResourceState(prior.resources, actor.resources)
            }
          : actor
      )
    }
  }
  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id))
}

async function requireRefreshableCapability(input: {
  definitions: CurrentReusableDefinitionSource
  definitionId: string
  gameSystemId: string
}) {
  const current = await input.definitions.requireCurrent(input.definitionId)
  if (checksumRuleDocument(current.document) !== current.checksum) {
    throw new EncounterConflictError('Action-economy capability checksum is invalid.')
  }
  const document = ruleCapabilityReusableDefinitionDocumentDtoSchema.safeParse(current.document)
  if (
    !document.success ||
    document.data.gameSystemId !== input.gameSystemId ||
    document.data.usage?.refreshBoundary !== 'START_OF_TURN'
  ) {
    throw new EncounterConflictError('Action-economy capability refresh is unavailable.')
  }
  return { current, document: document.data }
}

/** Stages one actor's System-owned usage refresh without mutating persistence. */
export async function stageEncounterActionEconomyRefreshes(input: {
  actorId: string
  encounter: Pick<EncounterRecord, 'actors'>
  definitions: CurrentReusableDefinitionSource
}): Promise<EncounterActionEconomyRefreshPlan> {
  const owner = input.encounter.actors.find((actor) => actor.id === input.actorId)
  if (!owner?.systemId) return { refreshes: [], refreshedActor: null }
  const definitionIds = actionEconomyCapabilityRegistry.requireRefreshCapabilityDefinitionIds(
    owner.systemId
  )
  let refreshed = owner
  const refreshes: StagedActionEconomyRefresh[] = []
  for (const definitionId of definitionIds) {
    const capability = await requireRefreshableCapability({
      definitions: input.definitions,
      definitionId,
      gameSystemId: owner.systemId
    })
    const beforeUsed = encounterRuleUsageUsed(refreshed, definitionId)
    if (beforeUsed === 0) continue
    if (beforeUsed > capability.document.usage!.maximum) {
      throw new EncounterConflictError('Action-economy usage exceeds its pinned maximum.')
    }
    refreshes.push({
      ordinal: refreshes.length,
      actorId: owner.id,
      capabilityDefinitionId: definitionId,
      definitionVersion: capability.current.version,
      definitionChecksum: capability.current.checksum,
      beforeUsed,
      afterUsed: 0
    })
    refreshed = {
      ...refreshed,
      resources: withEncounterRuleUsageUsed(refreshed, definitionId, 0)
    }
  }
  return { refreshes, refreshedActor: refreshes.length > 0 ? refreshed : null }
}

/** Revalidates and applies a sealed refresh plan exactly once at terminal commit. */
export async function applyStagedActionEconomyRefreshes(input: {
  encounter: Pick<EncounterRecord, 'actors'>
  definitions: CurrentReusableDefinitionSource
  refreshes: readonly StagedActionEconomyRefresh[]
}): Promise<readonly EncounterActorRecord[]> {
  const actorIds = [...new Set(input.refreshes.map((refresh) => refresh.actorId))].sort()
  const updated: EncounterActorRecord[] = []
  for (const actorId of actorIds) {
    const owner = input.encounter.actors.find((actor) => actor.id === actorId)
    if (!owner?.systemId)
      throw new EncounterConflictError('Action-economy refresh owner is unavailable.')
    let refreshed = owner
    for (const refresh of input.refreshes
      .filter((candidate) => candidate.actorId === actorId)
      .sort((left, right) => left.ordinal - right.ordinal)) {
      const capability = await requireRefreshableCapability({
        definitions: input.definitions,
        definitionId: refresh.capabilityDefinitionId,
        gameSystemId: owner.systemId
      })
      if (
        capability.current.version !== refresh.definitionVersion ||
        capability.current.checksum !== refresh.definitionChecksum ||
        refresh.afterUsed !== 0 ||
        encounterRuleUsageUsed(refreshed, refresh.capabilityDefinitionId) !== refresh.beforeUsed
      ) {
        throw new EncounterConflictError('Action-economy refresh plan is stale.')
      }
      refreshed = {
        ...refreshed,
        resources: withEncounterRuleUsageUsed(refreshed, refresh.capabilityDefinitionId, 0)
      }
    }
    updated.push(refreshed)
  }
  return updated
}
