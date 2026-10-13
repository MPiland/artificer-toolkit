import type { CharacterGrantFoldSource } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import { createCharacterMechanicSourceKey } from '@artificer-toolkit/shared/character'
import type {
  CompiledFeatGrant,
  CompiledModifierGrant,
  CompiledProficiencyGrant,
  CompiledSenseGrant,
  CompiledSpellGrant
} from '@artificer-toolkit/shared/compilers'
import type { CharacterBuildSnapshot } from '@artificer-toolkit/shared/core'
import type { FacetAuthored } from '@artificer-toolkit/shared/authored'
import {
  getCharacterProvenanceIdentityKey,
  type CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'

import { normalizeCharacterGrantRestrictions } from './characterGrantFoldRestrictionFacts.js'

type GrantBearingDefinition = {
  id?: string
  restrictions?: FacetAuthored | FacetAuthored<'CHARACTER'>
  proficiencies?: readonly CompiledProficiencyGrant[]
  senses?: readonly CompiledSenseGrant[]
  modifiers?: readonly CompiledModifierGrant[]
  feats?: readonly CompiledFeatGrant[]
  spells?: readonly CompiledSpellGrant[]
}

type JsonFact = CharacterGrantFoldSource['modifiers'][number]['grant']

function jsonFact(value: unknown): JsonFact {
  const serialized = JSON.stringify(value)
  if (serialized === undefined) throw new Error('Character grant mechanics must be JSON values.')
  return JSON.parse(serialized) as JsonFact
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

function chosenTargets(
  snapshot: CharacterBuildSnapshot,
  grantId: string,
  owner: CharacterProvenance,
  progressionLevel?: number
): string[] {
  const identity = [
    encodeURIComponent(grantId),
    progressionLevel ?? 'root',
    encodeURIComponent(getCharacterProvenanceIdentityKey(owner))
  ].join(':')
  return [
    ...(snapshot.chosenGrantSelections?.find(
      (selection) =>
        [
          encodeURIComponent(selection.grantId),
          selection.progressionLevel ?? 'root',
          encodeURIComponent(getCharacterProvenanceIdentityKey(selection.source))
        ].join(':') === identity
    )?.targetIds ?? [])
  ]
}

function proficiencyTargets(
  grant: CompiledProficiencyGrant,
  snapshot: CharacterBuildSnapshot,
  owner: CharacterProvenance
): string[] {
  if (grant.selectionKind === 'CHOSEN') return chosenTargets(snapshot, grant.id, owner)
  if (grant.authoringModeKind === 'ALL') return ['*']
  const value = grant as unknown as Record<string, unknown>
  let targets: string[]
  switch (grant.proficiencyKind) {
    case 'SKILL':
      targets = strings(value.skillIds)
      break
    case 'SAVE_ABILITY':
      targets = strings(value.abilities)
      break
    case 'LANGUAGE':
      targets = strings(value.languageIds)
      break
    case 'EQUIPMENT':
      targets = strings(value.equipmentIds)
      break
    case 'EQUIPMENT_PROPERTY':
      targets = strings(value.properties)
      break
  }
  return targets
}

export function buildCharacterGrantFoldProficiencyFacts(
  grants: readonly CompiledProficiencyGrant[] | undefined,
  snapshot: CharacterBuildSnapshot,
  owner: CharacterProvenance,
  normalizeTarget?: (kind: string, targetId: string) => string
): CharacterGrantFoldSource['proficiencies'] {
  return (grants ?? []).map((grant) => {
    const targetIds = proficiencyTargets(grant, snapshot, owner)
    return {
      grantId: grant.id,
      proficiencyKind: grant.proficiencyKind,
      targetIds,
      matchIds: targetIds.map((targetId) =>
        normalizeTarget ? normalizeTarget(grant.proficiencyKind, targetId) : targetId
      ),
      category:
        grant.proficiencyKind === 'EQUIPMENT_PROPERTY' && 'category' in grant
          ? (grant.category ?? null)
          : null,
      scaling: grant.level === 'DOUBLE' ? 'DOUBLE' : grant.level === 'HALF' ? 'HALF' : 'FULL'
    }
  })
}

function scalingTargets(
  grant: CompiledSenseGrant | CompiledFeatGrant | CompiledSpellGrant,
  idKey: 'senseIds' | 'featIds' | 'spellIds',
  snapshot: CharacterBuildSnapshot,
  owner: CharacterProvenance
): { targetIds: string[]; levels: Array<{ level: number; targetIds: string[] }> } {
  const value = grant as unknown as Record<string, unknown>
  const targetIds =
    grant.selectionKind === 'CHOSEN'
      ? chosenTargets(snapshot, grant.id, owner)
      : strings(value[idKey])
  const levels =
    grant.scalingKind === 'PER_LEVEL'
      ? grant.levels.map((level) => {
          const entry = level as unknown as Record<string, unknown>
          return {
            level: level.level,
            targetIds:
              grant.selectionKind === 'CHOSEN'
                ? chosenTargets(snapshot, grant.id, owner, level.level)
                : strings(entry[idKey])
          }
        })
      : []
  return { targetIds, levels }
}

function mechanicSource(
  snapshot: CharacterBuildSnapshot,
  owner: CharacterProvenance,
  definitionId: string,
  sourceInstanceId?: string
): CharacterGrantFoldSource['mechanicSource'] {
  if (owner.kind === 'MANUAL') return { kind: 'SYSTEM', systemId: snapshot.systemId }
  return {
    kind: 'AUTHORED',
    sourceKind: owner.kind,
    definitionId,
    sourceInstanceId: sourceInstanceId ?? getCharacterProvenanceIdentityKey(owner)
  }
}

export function buildCharacterGrantFoldModifierFacts(
  grants: readonly CompiledModifierGrant[] | undefined,
  normalizeProficiencyTarget?: (kind: string, targetId: string) => string
): CharacterGrantFoldSource['modifiers'] {
  return (grants ?? []).map((grant) => ({
    grantId: grant.id,
    valueDomainCode: grant.valueDomainCode,
    modifierKind: grant.modifierKind,
    domain: jsonFact(grant.domain),
    grant: jsonFact(grant),
    restrictions: normalizeCharacterGrantRestrictions(
      grant.restrictions,
      normalizeProficiencyTarget
    ),
    scopeSpellIds: (grant.restrictions?.groups ?? [])
      .flatMap((group) => group.contexts)
      .flatMap((context) =>
        context.subject === 'SPELL' &&
        context.authoringModeKind === 'SELECTED' &&
        context.spellIds.length > 0
          ? [...context.spellIds]
          : []
      )
  }))
}

export function buildCharacterGrantFoldSourceFacts(params: {
  definition: GrantBearingDefinition
  owner: CharacterProvenance
  definitionId: string
  sourceId?: string
  sourceInstanceId?: string
  snapshot: CharacterBuildSnapshot
  proficiencies?: readonly CompiledProficiencyGrant[]
  sourceState?: { carried: boolean; equipped: boolean; attuned: boolean }
  equipmentSource?: CharacterGrantFoldSource['mechanicSource']
  normalizeProficiencyTarget?: (kind: string, targetId: string) => string
}): CharacterGrantFoldSource {
  const source =
    params.equipmentSource ??
    mechanicSource(params.snapshot, params.owner, params.definitionId, params.sourceInstanceId)
  return {
    sourceId: params.sourceId ?? createCharacterMechanicSourceKey(source),
    mechanicSource: source,
    sourceState: params.sourceState ?? null,
    restrictions: normalizeCharacterGrantRestrictions(
      params.definition.restrictions,
      params.normalizeProficiencyTarget
    ),
    proficiencies: buildCharacterGrantFoldProficiencyFacts(
      params.proficiencies ?? params.definition.proficiencies,
      params.snapshot,
      params.owner,
      params.normalizeProficiencyTarget
    ),
    senses: (params.definition.senses ?? []).map((grant) => ({
      grantId: grant.id,
      scalingKind: grant.scalingKind,
      ...scalingTargets(grant, 'senseIds', params.snapshot, params.owner),
      range: grant.range
    })),
    modifiers: buildCharacterGrantFoldModifierFacts(
      params.definition.modifiers,
      params.normalizeProficiencyTarget
    ),
    feats: (params.definition.feats ?? []).map((grant) => ({
      grantId: grant.id,
      scalingKind: grant.scalingKind,
      ...scalingTargets(grant, 'featIds', params.snapshot, params.owner)
    })),
    spells: (params.definition.spells ?? []).map((grant) => ({
      grantId: grant.id,
      scalingKind: grant.scalingKind,
      ...scalingTargets(grant, 'spellIds', params.snapshot, params.owner)
    }))
  }
}

/** Variant ancestry of a Character's compiled item, nearest parent first. */
export function compiledEquipmentParentIds(
  item: CharacterBuildSnapshot['equipmentItems'][number]['compiledItem']
): string[] {
  return item.category === 'VARIANT' ? [item.parentEquipmentId] : [...item.parentEquipmentIds]
}

export function getCharacterGrantFoldSelectedOptionIds(
  feature: CharacterBuildSnapshot['features'][number]
): Set<string> {
  const ids = new Set<string>()
  for (const selection of feature.selections ?? []) {
    if (selection.selectionKey !== 'options') continue
    for (const value of selection.values) {
      if (value.kind === 'ID') ids.add(value.id)
      if (value.kind === 'IDS') value.ids.forEach((id) => ids.add(id))
    }
  }
  return ids
}
