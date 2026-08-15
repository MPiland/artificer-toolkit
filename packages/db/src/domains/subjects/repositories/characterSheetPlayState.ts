import type {
  CharacterResourceOwnerKey,
  CharacterResourceUsage,
  CharacterSpellSourceRef,
  CharacterSpellSourceKind
} from '@artificer-toolkit/shared/character'
import type { DBLike } from '#types'

export interface CharacterSpellCustomization {
  id: string
  characterId: string
  source: CharacterSpellSourceRef
  customName?: string
  notes?: string
  displayAsAttack: boolean
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

export interface CharacterSheetPlayStateRepository {
  listResourceUsage(characterId: string): Promise<CharacterResourceUsage[]>
  setResourceUsage(input: {
    id: string
    characterId: string
    actorId: string
    owner: CharacterResourceOwnerKey
    used: number
  }): Promise<void>
  listSpellCustomizations(characterId: string): Promise<CharacterSpellCustomization[]>
  setSpellCustomization(input: {
    id: string
    characterId: string
    actorId: string
    source: CharacterSpellSourceRef
    customName?: string
    notes?: string
    displayAsAttack: boolean
  }): Promise<void>
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value
}

function resourceOwnerFromRow(row: {
  owner_kind: string
  resource_grant_id: string | null
  source_id: string | null
  spell_id: string | null
  source_kind: string | null
  source_instance_id: string | null
  charge_id: string | null
  item_instance_id: string | null
  sense_grant_id: string | null
  companion_instance_id: string | null
  feature_id: string | null
}): CharacterResourceOwnerKey {
  switch (row.owner_kind) {
    case 'AUTHORED_GRANT':
      return { kind: row.owner_kind, resourceGrantId: row.resource_grant_id! }
    case 'AUTHORED_SOURCE':
      return {
        kind: row.owner_kind,
        sourceId: row.source_id!,
        chargeId: row.charge_id!
      }
    case 'SPELL_SOURCE':
      return {
        kind: row.owner_kind,
        resourceGrantId: row.resource_grant_id!,
        spellId: row.spell_id!,
        sourceKind: row.source_kind! as CharacterSpellSourceKind,
        sourceInstanceId: row.source_instance_id!
      }
    case 'ITEM_INSTANCE':
      return {
        kind: row.owner_kind,
        chargeId: row.charge_id!,
        itemInstanceId: row.item_instance_id!
      }
    case 'SENSE_GRANT':
      return { kind: row.owner_kind, senseGrantId: row.sense_grant_id! }
    case 'COMPANION_FEATURE':
      return {
        kind: row.owner_kind,
        chargeId: row.charge_id!,
        companionInstanceId: row.companion_instance_id!,
        featureId: row.feature_id!
      }
    default:
      throw new Error(`Unsupported character resource owner kind: ${row.owner_kind}`)
  }
}

function ownerColumns(owner: CharacterResourceOwnerKey) {
  const empty = {
    resource_grant_id: null,
    source_id: null,
    spell_id: null,
    source_kind: null,
    source_instance_id: null,
    charge_id: null,
    item_instance_id: null,
    sense_grant_id: null,
    companion_instance_id: null,
    feature_id: null
  }
  switch (owner.kind) {
    case 'AUTHORED_GRANT':
      return { ...empty, resource_grant_id: owner.resourceGrantId }
    case 'AUTHORED_SOURCE':
      return { ...empty, source_id: owner.sourceId, charge_id: owner.chargeId }
    case 'SPELL_SOURCE':
      return {
        ...empty,
        resource_grant_id: owner.resourceGrantId,
        spell_id: owner.spellId,
        source_kind: owner.sourceKind,
        source_instance_id: owner.sourceInstanceId
      }
    case 'ITEM_INSTANCE':
      return {
        ...empty,
        charge_id: owner.chargeId,
        item_instance_id: owner.itemInstanceId
      }
    case 'SENSE_GRANT':
      return { ...empty, sense_grant_id: owner.senseGrantId }
    case 'COMPANION_FEATURE':
      return {
        ...empty,
        charge_id: owner.chargeId,
        companion_instance_id: owner.companionInstanceId,
        feature_id: owner.featureId
      }
  }
}

async function removeResourceOwner(
  db: DBLike,
  characterId: string,
  owner: CharacterResourceOwnerKey
): Promise<void> {
  let query = db
    .deleteFrom('character_sheet_resource_usage')
    .where('character_id', '=', characterId)
    .where('owner_kind', '=', owner.kind)
  switch (owner.kind) {
    case 'AUTHORED_GRANT':
      query = query.where('resource_grant_id', '=', owner.resourceGrantId)
      break
    case 'AUTHORED_SOURCE':
      query = query.where('source_id', '=', owner.sourceId).where('charge_id', '=', owner.chargeId)
      break
    case 'SPELL_SOURCE':
      query = query
        .where('resource_grant_id', '=', owner.resourceGrantId)
        .where('spell_id', '=', owner.spellId)
        .where('source_kind', '=', owner.sourceKind)
        .where('source_instance_id', '=', owner.sourceInstanceId)
      break
    case 'ITEM_INSTANCE':
      query = query
        .where('charge_id', '=', owner.chargeId)
        .where('item_instance_id', '=', owner.itemInstanceId)
      break
    case 'SENSE_GRANT':
      query = query.where('sense_grant_id', '=', owner.senseGrantId)
      break
    case 'COMPANION_FEATURE':
      query = query
        .where('charge_id', '=', owner.chargeId)
        .where('companion_instance_id', '=', owner.companionInstanceId)
        .where('feature_id', '=', owner.featureId)
      break
  }
  await query.execute()
}

export function createCharacterSheetPlayStateRepository(
  db: DBLike
): CharacterSheetPlayStateRepository {
  return {
    async listResourceUsage(characterId) {
      const rows = await db
        .selectFrom('character_sheet_resource_usage')
        .selectAll()
        .where('character_id', '=', characterId)
        .execute()
      return rows.map((row) => ({
        id: row.id,
        characterId: row.character_id,
        owner: resourceOwnerFromRow(row),
        used: row.used,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at)
      }))
    },

    async setResourceUsage({ id, characterId, actorId, owner, used }) {
      await removeResourceOwner(db, characterId, owner)
      if (used === 0) return
      await db
        .insertInto('character_sheet_resource_usage')
        .values({
          id,
          character_id: characterId,
          owner_kind: owner.kind,
          ...ownerColumns(owner),
          used,
          created_by: actorId,
          updated_by: actorId
        })
        .execute()
    },

    async listSpellCustomizations(characterId) {
      const rows = await db
        .selectFrom('character_spell_customizations')
        .selectAll()
        .where('character_id', '=', characterId)
        .execute()
      return rows.map((row) => ({
        id: row.id,
        characterId: row.character_id,
        source: {
          spellId: row.spell_id,
          sourceKind: row.source_kind as CharacterSpellSourceKind,
          sourceInstanceId: row.source_instance_id
        },
        ...(row.custom_name == null ? {} : { customName: row.custom_name }),
        ...(row.notes == null ? {} : { notes: row.notes }),
        displayAsAttack: row.display_as_attack,
        createdBy: row.created_by,
        updatedBy: row.updated_by,
        createdAt: toIsoString(row.created_at),
        updatedAt: toIsoString(row.updated_at)
      }))
    },

    async setSpellCustomization(input) {
      const { source } = input
      await db
        .deleteFrom('character_spell_customizations')
        .where('character_id', '=', input.characterId)
        .where('spell_id', '=', source.spellId)
        .where('source_kind', '=', source.sourceKind)
        .where('source_instance_id', '=', source.sourceInstanceId)
        .execute()
      if (!input.customName && !input.notes && !input.displayAsAttack) return
      await db
        .insertInto('character_spell_customizations')
        .values({
          id: input.id,
          character_id: input.characterId,
          spell_id: source.spellId,
          source_kind: source.sourceKind,
          source_instance_id: source.sourceInstanceId,
          custom_name: input.customName ?? null,
          notes: input.notes ?? null,
          display_as_attack: input.displayAsAttack,
          created_by: input.actorId,
          updated_by: input.actorId
        })
        .execute()
    }
  }
}
