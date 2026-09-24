import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'
import type { CharacterBuilderResolution } from './builderTypes.js'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characters'
import {
  createCharacterResourceOwnerKey,
  createCharacterMechanicSourceKey,
  toCharacterResourceOwnerKey,
  type CharacterMechanicSourceRef,
  type CharacterResourceOwnerRef
} from '@artificer-toolkit/shared/character'
import type {
  CreatureAuthored,
  CharacterAuthored,
  CharacterProvenance
} from '@artificer-toolkit/shared/subjects/authored'
import { getCharacterProvenanceIdentityKey } from '@artificer-toolkit/shared/subjects/authored'

type PolicyResource = CharacterRuleEvaluationResult['output']['resources'][number]
type PolicySpellAccess = CharacterRuleEvaluationResult['output']['spellAccess'][number]
type SheetResource = CharacterSheetResponseDto['resources']['items'][number]
type GrantFoldFacts = CharacterRuleEvaluationResult['facts']['grantFoldFacts']

function recovery(resetKind: PolicyResource['resetKind']): SheetResource['recoveries'][number] {
  return { trigger: resetKind, amount: { kind: 'ALL' } }
}

function resourceGrantSourceRef(
  source: CharacterProvenance,
  systemId: string
): CharacterMechanicSourceRef {
  if (source.kind === 'MANUAL') return { kind: 'SYSTEM', systemId }
  const definitionId =
    source.kind === 'CLASS'
      ? source.classId
      : source.kind === 'SUBCLASS'
        ? source.subclassId
        : source.kind === 'RACE'
          ? source.raceId
          : source.kind === 'SUBRACE'
            ? source.subraceId
            : source.kind === 'ANCESTRY'
              ? source.optionId
              : source.kind === 'BACKGROUND'
                ? source.backgroundId
                : source.kind === 'FEAT'
                  ? source.featId
                  : source.kind === 'FEATURE'
                    ? source.featureId
                    : source.optionId
  return {
    kind: 'AUTHORED',
    sourceKind: source.kind,
    definitionId,
    sourceInstanceId: getCharacterProvenanceIdentityKey(source)
  }
}

function grantFoldSources(
  facts: GrantFoldFacts
): Array<{ sourceId: string; mechanicSource: CharacterMechanicSourceRef }> {
  return [
    ...facts.classes.flatMap((entry) =>
      [entry.base?.source, entry.subclass?.source].flatMap((source) => (source ? [source] : []))
    ),
    ...(facts.background ? [facts.background] : []),
    ...facts.features.flatMap((entry) =>
      [entry.definition, ...entry.selectedOptions, entry.featDefinition].flatMap((source) =>
        source ? [source] : []
      )
    ),
    ...facts.equipmentItems.flatMap((entry) => [
      {
        sourceId: entry.rootSourceId,
        mechanicSource: {
          kind: 'EQUIPMENT_INSTANCE' as const,
          equipmentId: entry.equipmentId,
          itemInstanceId: entry.instanceId
        }
      },
      ...entry.features.map((feature) => feature.source)
    ])
  ]
}

function matchesSpellAccessSource(source: CharacterProvenance, access: PolicySpellAccess): boolean {
  switch (access.sourceKind) {
    case 'CLASS':
      return source.kind === 'CLASS' && source.classId === access.sourceId
    case 'SUBCLASS':
      return source.kind === 'SUBCLASS' && source.subclassId === access.sourceId
    case 'RACE':
      return source.kind === 'RACE' && source.raceId === access.sourceId
    case 'SUBRACE':
      return source.kind === 'SUBRACE' && source.subraceId === access.sourceId
  }
}

function required<T>(matches: readonly T[], description: string): T {
  if (matches.length !== 1) {
    throw new Error(
      `Character rule resource presentation is ${matches.length === 0 ? 'missing' : 'ambiguous'}: ${description}`
    )
  }
  return matches[0]!
}

function assertPoolId(poolId: string, owner: CharacterResourceOwnerRef): void {
  if (createCharacterResourceOwnerKey(toCharacterResourceOwnerKey(owner)) !== poolId) {
    throw new Error(`Character rule resource owner key mismatch: ${poolId}`)
  }
}

export interface CharacterRuleResourceProjectionInput {
  policy: Pick<CharacterRuleEvaluationResult['output'], 'resources' | 'spellAccess'>
  snapshot: Pick<CharacterRuleEvaluationResult['snapshot'], 'equipmentItems' | 'features'>
  grantFoldFacts: CharacterRuleEvaluationResult['facts']['grantFoldFacts']
  character: CharacterAuthored
  resolution: CharacterBuilderResolution
  creaturesById: ReadonlyMap<string, CreatureAuthored>
}

export function projectCharacterRuleResources(
  params: CharacterRuleResourceProjectionInput
): SheetResource[] {
  const { policy, snapshot, grantFoldFacts, character, resolution, creaturesById } = params
  const sourceFacts = grantFoldSources(grantFoldFacts)
  const inventoryById = new Map(character.state.equipment.inventory.map((item) => [item.id, item]))
  const itemsByInstanceId = new Map(snapshot.equipmentItems.map((item) => [item.instanceId, item]))
  const featureDefinitions = [
    ...resolution.registry.features,
    ...resolution.registry.races.flatMap((race) => [
      ...(race.features ?? []),
      ...(race.ancestry?.options.flatMap((option) => option.features ?? []) ?? [])
    ]),
    ...resolution.registry.classes.flatMap((classRecord) => classRecord.features ?? []),
    ...resolution.registry.backgrounds.flatMap((background) => background.features ?? []),
    ...(resolution.registry.feats ?? []).flatMap((feat) => feat.features ?? [])
  ]
  const duplicateItemCopyLabels = new Map<string, string>()
  const policyItemIds = new Set(
    policy.resources
      .filter((resource) => resource.ownerKind === 'ITEM_INSTANCE')
      .map((resource) => resource.itemInstanceId)
  )
  const copiesByLabel = new Map<string, CharacterAuthored['state']['equipment']['inventory']>()
  for (const item of character.state.equipment.inventory) {
    if (!policyItemIds.has(item.id)) continue
    const equipment = required(
      resolution.registry.equipment.filter((entry) => entry.id === item.equipmentId),
      `equipment definition ${item.equipmentId}`
    )
    const label = item.customName ?? equipment.label
    const copies = copiesByLabel.get(label) ?? []
    copies.push(item)
    copiesByLabel.set(label, copies)
  }
  for (const [label, items] of copiesByLabel) {
    if (items.length < 2) continue
    for (const [index, item] of items.entries())
      duplicateItemCopyLabels.set(item.id, `${label} #${index + 1}`)
  }

  return policy.resources.flatMap<SheetResource>((resource) => {
    if (
      resource.state !== 'RESOLVED' ||
      resource.maximum === null ||
      resource.effectiveUsed === null ||
      resource.remaining === null
    )
      return []
    const common = {
      id: resource.poolId,
      used: resource.effectiveUsed,
      max: resource.maximum,
      remaining: resource.remaining,
      recoveries: [recovery(resource.resetKind)]
    }

    if (resource.ownerKind === 'AUTHORED_GRANT') {
      const grants = (character.intent.resourceGrants ?? []).filter(
        (grant) => grant.id === resource.resourceGrantId
      )
      const summaries = resolution.grants.resources.filter(
        (entry) => entry.id === resource.resourceDefinitionId
      )
      const grant = grants.length === 1 ? grants[0] : null
      const matchingSummaries = grant
        ? summaries.filter(
            (entry) =>
              getCharacterProvenanceIdentityKey(entry.source) ===
              getCharacterProvenanceIdentityKey(grant.source)
          )
        : summaries.length === 1
          ? summaries
          : []
      const summary = matchingSummaries.length === 1 ? matchingSummaries[0] : null
      if (!summary) {
        throw new Error(
          `Character rule resource presentation is missing: authored grant ${resource.resourceGrantId}`
        )
      }
      const owner: CharacterResourceOwnerRef = {
        kind: 'AUTHORED_GRANT',
        resourceGrantId: resource.resourceGrantId,
        source: resourceGrantSourceRef(grant?.source ?? summary.source, character.systemId)
      }
      assertPoolId(resource.poolId, owner)
      return [
        {
          ...common,
          owner,
          label: summary.label,
          description: summary.description,
          sourceLabel: summary.sourceLabel
        }
      ]
    }

    if (resource.ownerKind === 'AUTHORED_SOURCE') {
      const authoredSource = resource.source
      if (authoredSource.kind !== 'AUTHORED') {
        throw new Error(
          `Character rule authored resource has non-authored source: ${resource.sourceId}`
        )
      }
      required(
        sourceFacts.filter(
          (entry) =>
            entry.sourceId === resource.sourceId &&
            createCharacterMechanicSourceKey(entry.mechanicSource) ===
              createCharacterMechanicSourceKey(authoredSource)
        ),
        `authored source ${resource.sourceId}`
      )
      const branches = grantFoldFacts.features
        .flatMap((entry, index) => [
          entry.definition?.sourceId === resource.sourceId
            ? { kind: 'FEATURE' as const, index }
            : null,
          ...entry.selectedOptions.flatMap((option) =>
            option.sourceId === resource.sourceId ? [{ kind: 'OPTION' as const, index }] : []
          ),
          entry.featDefinition?.sourceId === resource.sourceId
            ? { kind: 'FEAT' as const, index }
            : null
        ])
        .filter(
          (entry): entry is { kind: 'FEATURE' | 'OPTION' | 'FEAT'; index: number } => entry !== null
        )
      const branch = required(branches, `authored source branch ${resource.sourceId}`)
      const snapshotFeature = required(
        [snapshot.features[branch.index]].filter(Boolean),
        `snapshot feature ${branch.index}`
      )
      const sourceSummaries = resolution.grants.features.filter(
        (entry) =>
          entry.id === snapshotFeature.featureId &&
          getCharacterProvenanceIdentityKey(entry.source) ===
            getCharacterProvenanceIdentityKey(snapshotFeature.source)
      )
      const sourceSummary =
        branch.kind === 'FEAT' && sourceSummaries.length === 0
          ? null
          : required(sourceSummaries, `feature presentation ${snapshotFeature.featureId}`)
      const presentation = (() => {
        if (branch.kind === 'FEATURE') return sourceSummary!
        if (branch.kind === 'FEAT') {
          return required(
            (resolution.registry.feats ?? []).filter(
              (entry) =>
                snapshotFeature.source.kind === 'FEAT' && entry.id === snapshotFeature.source.featId
            ),
            `feat definition ${snapshotFeature.featureId}`
          )
        }
        const featureDefinition = required(
          featureDefinitions.filter((entry) => entry.id === snapshotFeature.featureId),
          `feature definition ${snapshotFeature.featureId}`
        )
        return required(
          (featureDefinition.options ?? []).filter(
            (entry) => entry.id === authoredSource.definitionId
          ),
          `feature option ${authoredSource.definitionId}`
        )
      })()
      const owner: CharacterResourceOwnerRef = {
        kind: 'AUTHORED_SOURCE',
        chargeId: resource.chargeId,
        source: resource.source
      }
      assertPoolId(resource.poolId, owner)
      return [
        {
          ...common,
          owner,
          label: presentation.label,
          description: presentation.description,
          sourceLabel: sourceSummary?.sourceLabel ?? presentation.label,
          ...(branch.kind === 'FEAT' ? {} : { sourceFeatureId: snapshotFeature.featureId })
        }
      ]
    }

    if (resource.ownerKind === 'ITEM_INSTANCE') {
      const item = itemsByInstanceId.get(resource.itemInstanceId)
      const state = inventoryById.get(resource.itemInstanceId)
      if (!item || !state) {
        throw new Error(
          `Character rule resource presentation is missing: item instance ${resource.itemInstanceId}`
        )
      }
      const equipment = required(
        resolution.registry.equipment.filter((entry) => entry.id === item.contentRef.definitionId),
        `equipment definition ${item.contentRef.definitionId}`
      )
      const itemLabel = duplicateItemCopyLabels.get(state.id) ?? state.customName ?? equipment.label
      const grantFoldItem = grantFoldFacts.equipmentItems.find(
        (entry) => entry.instanceId === resource.itemInstanceId
      )
      const nestedIndexes =
        resource.sourceId === null
          ? []
          : (grantFoldItem?.features ?? []).flatMap((entry, index) =>
              entry.source.sourceId === resource.sourceId ? [index] : []
            )
      if (resource.sourceId !== null && nestedIndexes.length !== 1) {
        throw new Error(
          `Character rule resource presentation is ${nestedIndexes.length === 0 ? 'missing' : 'ambiguous'}: nested item source ${resource.sourceId}`
        )
      }
      const featureId =
        nestedIndexes.length === 1
          ? (grantFoldItem?.features[nestedIndexes[0]!]?.sourceChargeUse?.featureId ?? null)
          : null
      const feature = featureId ? equipment.features?.filter((entry) => entry.id === featureId) : []
      const matchingFeatures = feature ?? []
      if (resource.sourceId !== null && matchingFeatures.length !== 1) {
        throw new Error(
          `Character rule resource presentation is ${matchingFeatures.length === 0 ? 'missing' : 'ambiguous'}: nested item feature ${resource.sourceId}`
        )
      }
      const owner: CharacterResourceOwnerRef = {
        kind: 'ITEM_INSTANCE',
        itemInstanceId: resource.itemInstanceId,
        chargeId: resource.chargeId
      }
      assertPoolId(resource.poolId, owner)
      return [
        {
          ...common,
          owner,
          label: matchingFeatures[0]?.label ?? `${itemLabel} charges`,
          description: matchingFeatures[0]?.description,
          sourceLabel: itemLabel
        }
      ]
    }

    if (resource.ownerKind === 'COMPANION_FEATURE') {
      const instance = (character.state.creatures ?? []).filter(
        (entry) => entry.id === resource.companionInstanceId
      )
      const creature = instance.length === 1 ? creaturesById.get(instance[0]!.creatureId) : null
      const feature = creature?.features?.filter((entry) => entry.id === resource.featureId) ?? []
      if (!creature || feature.length !== 1) {
        throw new Error(
          `Character rule resource presentation is ${creature && feature.length > 1 ? 'ambiguous' : 'missing'}: companion feature ${resource.featureId}`
        )
      }
      const owner: CharacterResourceOwnerRef = {
        kind: 'COMPANION_FEATURE',
        companionInstanceId: resource.companionInstanceId,
        featureId: resource.featureId,
        chargeId: resource.chargeId
      }
      assertPoolId(resource.poolId, owner)
      return [
        {
          ...common,
          owner,
          label: feature[0]!.label,
          description: feature[0]!.description || undefined,
          sourceLabel: creature.label
        }
      ]
    }

    const access = policy.spellAccess.filter(
      (entry) =>
        entry.accessId === resource.accessId &&
        entry.sourceInstanceId === resource.sourceInstanceId &&
        entry.spellId === resource.spellId
    )
    const spell = resolution.catalog.spells.filter((entry) => entry.id === resource.spellId)
    const sourceFeature =
      access.length === 1
        ? resolution.grants.features.filter(
            (entry) =>
              entry.id === access[0]!.sourceFeatureId &&
              matchesSpellAccessSource(entry.source, access[0]!)
          )
        : []
    required(access, `included spell access ${resource.accessId}`)
    required(spell, `spell ${resource.spellId}`)
    required(sourceFeature, `spell source feature ${resource.accessId}`)
    const owner: CharacterResourceOwnerRef = {
      kind: 'SPELL_SOURCE',
      resourceGrantId: resource.accessId,
      source: {
        spellId: resource.spellId,
        sourceKind: 'FEATURE',
        sourceInstanceId: resource.sourceInstanceId
      }
    }
    assertPoolId(resource.poolId, owner)
    return [
      {
        ...common,
        owner,
        label: `${spell[0]!.label} uses`,
        description: undefined,
        sourceLabel: sourceFeature[0]!.label,
        sourceFeatureId: access[0]!.sourceFeatureId
      }
    ]
  })
}
