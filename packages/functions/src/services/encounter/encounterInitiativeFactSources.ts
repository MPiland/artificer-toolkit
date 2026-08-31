import {
  createCampaignCharacterMechanicsProjectionRepository,
  createCharacterMechanicsProjectionRepository,
  type DBLike,
  type EncounterActorRecord,
  type EncounterRecord
} from '@artificer-toolkit/db'
import type {
  EncounterActorRuleOutput,
  EncounterActorRuleResult
} from '@artificer-toolkit/schema/api/encounterActorRules'

import {
  checksumCampaignCharacterMechanicalContext,
  resolveCharacterLiveSessionRuleContext
} from '../character/campaignCharacterSheet.js'
import { CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION } from '../campaign/campaignCharacterMechanicsProjection.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import { requireEncounterActorRuleResult } from './encounterActorRuleEvaluation.js'

export type LockedEncounterInitiativeCharacterSource = {
  kind: 'CHARACTER'
  actor: EncounterActorRecord
  characterId: string
  systemId: string
  streamVersion: number
  mechanics: Awaited<
    ReturnType<ReturnType<typeof createCharacterMechanicsProjectionRepository>['requireCurrent']>
  >
  overlay: Awaited<
    ReturnType<
      ReturnType<typeof createCampaignCharacterMechanicsProjectionRepository>['requireCurrent']
    >
  >
}

export type LockedEncounterInitiativeActorSource =
  | LockedEncounterInitiativeCharacterSource
  | {
      kind: 'CREATURE'
      actor: EncounterActorRecord
      systemId: string
      actorRule: EncounterActorRuleResult
    }
  | {
      kind: 'CUSTOM'
      actor: EncounterActorRecord
      systemId: string | null
    }

/**
 * Mechanically relevant sources read under the established Campaign →
 * Session/lease → Encounter lock chain. This is server-only: it has no
 * viewer input or Sheet presentation authority.
 */
export type LockedEncounterInitiativeFactSources = {
  characterIds: readonly string[]
  actors: readonly LockedEncounterInitiativeActorSource[]
}

/**
 * Locks assignments first, then Character roots in canonical Character-ID
 * order. It deliberately reads only current mechanics and the no-viewer
 * Campaign mechanical overlay; conditions and vocabulary remain consumers'
 * responsibility.
 */
export async function lockEncounterInitiativeCharacterSources(input: {
  trx: DBLike
  encounter: EncounterRecord
  actors: readonly EncounterActorRecord[]
  attunementSlotOverride: number | null
}): Promise<ReadonlyMap<string, LockedEncounterInitiativeCharacterSource>> {
  const actorByCharacter = new Map<string, EncounterActorRecord>()
  for (const actor of input.actors) {
    if (actor.kind !== 'CHARACTER') continue
    if (!actor.sourceId || actor.sourceRevision === null || !actor.systemId) {
      throw new EncounterValidationError('Character initiative source is incomplete.')
    }
    if (actorByCharacter.has(actor.sourceId)) {
      throw new EncounterConflictError(
        'A Character may appear only once in an Encounter initiative batch.'
      )
    }
    actorByCharacter.set(actor.sourceId, actor)
  }

  const characterIds = [...actorByCharacter.keys()].sort()
  const overlays = createCampaignCharacterMechanicsProjectionRepository(input.trx)
  for (const characterId of characterIds) {
    await overlays.lockAssignment({
      campaignId: input.encounter.campaignId,
      characterId
    })
  }

  const roots = new Map<
    string,
    { actor: EncounterActorRecord; systemId: string; streamVersion: number }
  >()
  for (const characterId of characterIds) {
    const character = await input.trx
      .selectFrom('characters')
      .select(['id', 'system_id', 'stream_version', 'status'])
      .where('id', '=', characterId)
      .forUpdate()
      .executeTakeFirst()
    const actor = actorByCharacter.get(characterId)!
    if (
      !character ||
      character.status !== 'ACTIVE' ||
      actor.sourceRevision !== character.stream_version
    ) {
      throw new EncounterConflictError('The Encounter Character source is stale.')
    }
    if (
      character.system_id !== input.encounter.gameSystemId ||
      actor.systemId !== character.system_id
    ) {
      throw new EncounterValidationError('The Character and Encounter Game Systems do not match.')
    }
    roots.set(characterId, {
      actor,
      systemId: character.system_id,
      streamVersion: character.stream_version
    })
  }

  const result = new Map<string, LockedEncounterInitiativeCharacterSource>()
  for (const characterId of characterIds) {
    const root = roots.get(characterId)!
    const mechanics = await createCharacterMechanicsProjectionRepository(input.trx).requireCurrent({
      characterId,
      expectedStreamVersion: root.streamVersion
    })
    const ruleContext = await resolveCharacterLiveSessionRuleContext(input.trx, characterId, {
      id: input.encounter.campaignId,
      attunementSlotOverride: input.attunementSlotOverride
    })
    if (!ruleContext) {
      throw new EncounterConflictError('The Character Campaign rule context is stale.')
    }
    const overlay = await overlays.requireCurrent({
      campaignId: input.encounter.campaignId,
      characterId,
      expectedBaseMechanicsProjectionChecksum: mechanics.projectionChecksum,
      expectedCharacterStreamVersion: root.streamVersion,
      expectedMechanicalContextChecksum: checksumCampaignCharacterMechanicalContext({
        adjustments: ruleContext.adjustments,
        attunementSlotOverride: ruleContext.attunementSlotOverride
      }),
      expectedProjectionSchemaVersion: CAMPAIGN_CHARACTER_MECHANICS_PROJECTION_SCHEMA_VERSION,
      baseMechanicsProjection: mechanics
    })
    result.set(characterId, {
      kind: 'CHARACTER',
      actor: root.actor,
      characterId,
      systemId: root.systemId,
      streamVersion: root.streamVersion,
      mechanics,
      overlay
    })
  }
  return result
}

export async function lockEncounterInitiativeFactSources(input: {
  trx: DBLike
  encounter: EncounterRecord
  actors: readonly EncounterActorRecord[]
  attunementSlotOverride: number | null
  getEncounterActorSnapshot?: () => Promise<{
    rules: EncounterActorRuleOutput
    encounter: EncounterRecord
  }>
}): Promise<LockedEncounterInitiativeFactSources> {
  const lockedCharacters = await lockEncounterInitiativeCharacterSources(input)
  const nonCharacterIds = input.actors
    .filter((actor) => actor.kind !== 'CHARACTER')
    .map((actor) => actor.id)
    .sort()

  if (nonCharacterIds.length > 0 && !input.getEncounterActorSnapshot) {
    throw new EncounterValidationError('Encounter actor rules are required for initiative facts.')
  }
  const snapshot = nonCharacterIds.length > 0 ? await input.getEncounterActorSnapshot!() : null
  const currentActors = new Map(snapshot?.encounter.actors.map((actor) => [actor.id, actor]))

  const sources = input.actors.map((actor): LockedEncounterInitiativeActorSource => {
    if (actor.kind === 'CHARACTER') return lockedCharacters.get(actor.sourceId!)!
    const current = currentActors.get(actor.id)
    if (
      !current ||
      current.kind !== actor.kind ||
      current.sourceId !== actor.sourceId ||
      current.sourceRevision !== actor.sourceRevision ||
      current.systemId !== actor.systemId ||
      JSON.stringify(current.snapshot) !== JSON.stringify(actor.snapshot)
    ) {
      throw new EncounterConflictError('Encounter actor changed before initiative evaluation.')
    }
    if (actor.kind === 'CUSTOM') {
      return { kind: 'CUSTOM', actor: current, systemId: current.systemId }
    }
    if (!current.systemId || current.systemId !== input.encounter.gameSystemId) {
      throw new EncounterValidationError('The Creature and Encounter Game Systems do not match.')
    }
    return {
      kind: 'CREATURE',
      actor: current,
      systemId: current.systemId,
      actorRule: requireEncounterActorRuleResult(snapshot!.rules, current.id)
    }
  })

  return {
    characterIds: [...lockedCharacters.keys()].sort(),
    actors: sources.sort((left, right) => left.actor.id.localeCompare(right.actor.id))
  }
}
