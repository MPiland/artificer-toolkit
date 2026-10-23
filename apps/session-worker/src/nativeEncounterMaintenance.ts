import { prepareMaintainedEffectStateRecord } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import { prepareEncounterActionMaintenance } from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import { SpellcastingLockedError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  MAX_ACTIVE_RULE_EFFECTS_PER_OWNER,
  MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR
} from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MovementMaintenanceProjection } from '@artificer-toolkit/rules-runtime/encounterMovementMaintenance'
import type { MovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { ProjectableCharacterFacts } from '@artificer-toolkit/rules-runtime/encounterActionProjection'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import {
  readCharacterRecord,
  type StoredCharacter
} from '@artificer-toolkit/schema/projections/characterStoredState'

export type NativeLiveMovementMaintenanceProjection = MovementMaintenanceProjection<StoredCharacter>

export function readNativeLiveMaintenanceCharacter(row: StoredCharacter, gameSystemId: string) {
  const character = readCharacterRecord(row)
  if (character.systemId !== gameSystemId) throw new Error('Movement Character identity mismatch.')
  return character
}

type Capture = (
  request: LiveSessionEncounterRulesRequest
) => Promise<LiveSessionEncounterRulesResponse>

export async function readNativeLiveMaintenanceSlot(input: {
  encounterId: string
  actorId: string
  definitionId: string
  capture: Capture
}) {
  const { encounterId, actorId, definitionId, capture } = input
  const response = await capture({ kind: 'MAINTENANCE_SLOT', actorId, definitionId })
  if (response.kind !== 'MAINTENANCE_SLOT') throw new Error('Maintenance slot is unavailable.')
  const state = response.state
  if (!state) return { state: null, dependents: [], zoneIds: [] }
  if (
    state.encounterId !== encounterId ||
    state.ownerActorId !== actorId ||
    state.maintenanceDefinitionId !== definitionId
  )
    throw new Error('Maintenance slot identity mismatch.')
  const pages = await Promise.all(
    (['CHARACTER', 'ENCOUNTER_ACTOR'] as const).map(async (ownerKind) => {
      const effects: ActiveRuleEffectRecord[] = []
      const cursors = new Set<string>()
      let cursor: string | null = null
      do {
        const page = await capture({
          kind: 'MAINTENANCE_DEPENDENTS',
          actorId,
          definitionId,
          stateId: state.id,
          ownerKind,
          cursor
        })
        if (page.kind !== 'MAINTENANCE_DEPENDENTS')
          throw new Error('Maintenance dependents are unavailable.')
        for (const effect of page.effects) {
          if (
            effect.maintainedEffectStateId !== state.id ||
            effect.owner.kind !== ownerKind ||
            (effect.owner.kind === 'CHARACTER' && effect.sourceEncounterId !== encounterId) ||
            (effect.owner.kind === 'ENCOUNTER_ACTOR' && effect.owner.encounterId !== encounterId)
          )
            throw new Error('Maintenance dependent identity mismatch.')
          effects.push(effect)
        }
        if (effects.length > MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR)
          throw new Error('Maintained effect dependents exceed the supported bound.')
        cursor = page.continueCursor
        if (cursor !== null) {
          if (cursors.has(cursor)) throw new Error('Maintenance capture cursor repeated.')
          cursors.add(cursor)
        }
      } while (cursor !== null)
      return effects
    })
  )
  const dependents = pages.flat()
  if (dependents.length > MAX_MAINTAINED_RULE_EFFECT_DEPENDENTS_PER_ACTOR)
    throw new Error('Maintained effect dependents exceed the supported bound.')
  return { state, dependents, zoneIds: response.zoneIds }
}

export async function readNativeLiveMaintenanceOwners(input: {
  gameSystemId: string
  actors: readonly EncounterRunActorState[]
  activeEffectsByActorId: ReadonlyMap<string, readonly ActiveRuleEffectRecord[]>
  removed: readonly ActiveRuleEffectRecord[]
  /** Null when the caster has no maintained slot to replace and only carried grants end. */
  slot: { actorId: string; definitionId: string; stateId: string } | null
  capture: Capture
  targets?: ReadonlyMap<string, MovementTarget<ProjectableCharacterFacts>>
  projection?: NativeLiveMovementMaintenanceProjection
}) {
  const { gameSystemId, actors, activeEffectsByActorId, removed, slot, capture } = input
  const owners: Array<{
    owner: ActiveRuleEffectRecord['owner']
    effects: ActiveRuleEffectRecord[]
    character: StoredCharacter | null
  }> = []
  const characterVersions: Array<{ characterId: string; beforeStreamVersion: number }> = []
  const uniqueOwners = new Map(
    removed.map((effect) => [checksumCanonicalJson(effect.owner), effect.owner])
  )
  for (const [ownerKey, owner] of uniqueOwners) {
    const target = [...(input.targets?.values() ?? [])].find((candidate) =>
      owner.kind === 'CHARACTER'
        ? candidate.actor.kind === 'CHARACTER' && candidate.actor.sourceId === owner.characterId
        : candidate.actor.id === owner.targetActorId
    )
    const projected = input.projection?.owners.get(ownerKey)
    // Without a slot only carried grants end, and their holders are loaded Run Characters.
    if (!slot && !target && !projected) throw new Error('Maintenance slot is unavailable.')
    const scope = slot ? { ...slot, owner } : null
    const response =
      !scope || target || projected ? null : await capture({ kind: 'MAINTENANCE_OWNER', ...scope })
    if (
      response &&
      (response.kind !== 'MAINTENANCE_OWNER' || checksumCanonicalJson(response.owner) !== ownerKey)
    )
      throw new Error('Maintenance owner identity mismatch.')
    const actor = actors.find((candidate) =>
      owner.kind === 'CHARACTER'
        ? candidate.kind === 'CHARACTER' && candidate.sourceId === owner.characterId
        : candidate.id === owner.targetActorId
    )
    const captured =
      target?.activeEffects ??
      projected?.effects ??
      (actor ? activeEffectsByActorId.get(actor.id) : undefined)
    const effects = captured ? [...captured] : []
    if (!captured && scope) {
      let afterEffectId: string | null = null
      for (;;) {
        const page = await capture({
          kind: 'MAINTENANCE_OWNER_EFFECTS',
          ...scope,
          afterEffectId
        })
        if (
          page.kind !== 'MAINTENANCE_OWNER_EFFECTS' ||
          checksumCanonicalJson(page.owner) !== ownerKey
        )
          throw new Error('Maintenance owner effect scope mismatch.')
        let lastId: string | null = afterEffectId
        for (const effect of page.effects) {
          if (
            checksumCanonicalJson(effect.owner) !== ownerKey ||
            (lastId !== null && effect.id <= lastId)
          )
            throw new Error('Maintenance owner effect page mismatch.')
          effects.push(effect)
          lastId = effect.id
        }
        if (effects.length > MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)
          throw new Error('Active rule effects exceed the supported bound.')
        if (page.continueAfter === null) break
        if (page.effects.length !== 4 || page.continueAfter !== lastId || lastId === afterEffectId)
          throw new Error('Maintenance owner effect cursor mismatch.')
        afterEffectId = page.continueAfter
      }
      effects.sort((a, b) => a.createdOrdinal - b.createdOrdinal || a.id.localeCompare(b.id))
    }
    const character =
      owner.kind === 'CHARACTER' && (target || projected)
        ? (target?.characterFacts?.active ?? projected?.character ?? null)
        : response?.kind === 'MAINTENANCE_OWNER'
          ? response.character
          : null
    if (owner.kind === 'CHARACTER') {
      if (
        !character ||
        character.id !== owner.characterId ||
        character.status !== 'ACTIVE' ||
        character.systemId !== gameSystemId
      )
        throw new Error('Maintained-effect Character owner is unavailable.')
      characterVersions.push({
        characterId: character.id,
        beforeStreamVersion: character.play.streamVersion
      })
    } else if (character) throw new Error('Maintenance actor owner contains Character state.')
    owners.push({ owner, effects, character })
  }
  characterVersions.sort((a, b) => a.characterId.localeCompare(b.characterId))
  return { owners, characterVersions }
}

/** Captures only the current slot and its authorized owners; policy preparation stays in the DO. */
export async function prepareNativeLiveActionMaintenance(input: {
  prepared: Parameters<typeof prepareEncounterActionMaintenance>[0]['prepared'] & {
    actors: readonly EncounterRunActorState[]
  }
  activeEffectsByActorId: ReadonlyMap<string, ActiveRuleEffectRecord[]>
  capture: Capture
  targets?: ReadonlyMap<string, MovementTarget<ProjectableCharacterFacts>>
  projection?: NativeLiveMovementMaintenanceProjection
  /** D99: given, a Character caster's new Concentration ends carried grants; loads and fences each holder. */
  loadCarriedHolder?: (
    actor: EncounterRunActorState
  ) => Promise<MovementTarget<ProjectableCharacterFacts>>
}) {
  const { prepared, capture, loadCarriedHolder } = input
  const carriedHolders = new Map<string, MovementTarget<ProjectableCharacterFacts>>()
  let slot: { definitionId: string; stateId: string } | null = null
  return prepareEncounterActionMaintenance({
    prepared,
    activeEffects: input.activeEffectsByActorId.get(prepared.actor.id) ?? [],
    readDefinition: async (definitionId) => {
      const response = await capture({ kind: 'DEFINITION', definitionId })
      if (response.kind !== 'DEFINITION') throw new Error('Maintenance definition is unavailable.')
      return response.definition
    },
    readSlot: async (definitionId) => {
      const result =
        input.projection?.slots.get(`${prepared.actor.id}:${definitionId}`) ??
        (await readNativeLiveMaintenanceSlot({
          encounterId: prepared.state.id,
          actorId: prepared.actor.id,
          definitionId,
          capture
        }))
      if (result.state) slot = { definitionId, stateId: result.state.id }
      return result
    },
    readCarried: loadCarriedHolder
      ? async () =>
          prepared.actors.flatMap((actor) =>
            actor.kind === 'CHARACTER' ? (input.activeEffectsByActorId.get(actor.id) ?? []) : []
          )
      : undefined,
    readOwners: async (removed, carried) => {
      for (const { owner } of carried)
        if (owner.kind === 'CHARACTER') {
          const holder = prepared.actors.find(
            (actor) => actor.kind === 'CHARACTER' && actor.sourceId === owner.characterId
          )
          if (holder && loadCarriedHolder && !carriedHolders.has(holder.id))
            carriedHolders.set(holder.id, await loadCarriedHolder(holder))
        }
      if (!slot && !removed.length) return { owners: [], characterVersions: [] }
      return readNativeLiveMaintenanceOwners({
        gameSystemId: prepared.state.gameSystemId,
        actors: prepared.actors,
        activeEffectsByActorId: input.activeEffectsByActorId,
        removed,
        slot: slot ? { ...slot, actorId: prepared.actor.id } : null,
        capture,
        targets: new Map([...(input.targets ?? []), ...carriedHolders]),
        projection: input.projection
      })
    }
  }).catch((error: unknown) => {
    if (error instanceof SpellcastingLockedError)
      throw new LiveSessionDomainRejectionError(422, {
        code: 'DOMAIN_REJECTED',
        reason: 'SOURCE_REQUIREMENTS_NOT_MET',
        message: DOMAIN_REJECTION_MESSAGES.SOURCE_REQUIREMENTS_NOT_MET
      })
    throw error
  })
}

/** The maintained state a completed action's Concentration creates, once its policy still matches the prepared one. */
export function prepareNativeLiveMaintainedState(input: {
  completedPolicy: NonNullable<
    Awaited<ReturnType<typeof prepareNativeLiveActionMaintenance>>
  >['policy']
  maintenance: Awaited<ReturnType<typeof prepareNativeLiveActionMaintenance>>
  encounterId: string
  ownerActorId: string
  actionId: string
  sourceOccurrenceId: string
  occurredAt: string
}) {
  const { maintenance } = input
  if (
    !maintenance ||
    checksumCanonicalJson(input.completedPolicy) !== checksumCanonicalJson(maintenance.policy)
  )
    throw new Error('The completed action maintenance policy changed.')
  // A repeat joins the live Concentration instead of opening a new one.
  if (maintenance.joins) return maintenance.prior
  return prepareMaintainedEffectStateRecord({
    id: crypto.randomUUID(),
    encounterId: input.encounterId,
    ownerActorId: input.ownerActorId,
    occurredAt: input.occurredAt,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: maintenance.policy.definitionId,
      definitionChecksum: maintenance.definitionChecksum,
      provenance: {
        kind: 'ACTION',
        sourceActionId: input.actionId,
        sourceOccurrenceId: input.sourceOccurrenceId
      },
      sourceActorId: input.ownerActorId,
      replacementPolicy: maintenance.policy.replacementPolicy,
      emptyDependentPolicy: maintenance.policy.emptyDependentPolicy
    }
  })
}
