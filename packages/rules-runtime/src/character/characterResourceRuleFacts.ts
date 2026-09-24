import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterGrantFoldInput } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import type { CharacterResourcePoolCandidate } from '@artificer-toolkit/schema/api/characterResourceRules'
import type {
  CompiledCharge,
  CompiledChargeUse,
  CompiledClassResource
} from '@artificer-toolkit/shared/compilers'
import { compileChargeUse } from '@artificer-toolkit/shared/compilers'
import { createCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import type {
  CharacterResourceUsage,
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import type {
  CharacterAuthored,
  CreatureAuthored
} from '@artificer-toolkit/shared/subjects/authored'

import { buildCharacterChargeRuleFact } from './characterChargeRuleFacts.js'
import { isCharacterSpellActionAccessCandidate } from './characterSpellRuleFacts.js'

type ResourceFacts = {
  resourcePoolCandidates: NonNullable<CharacterRulePolicyInput['resourcePoolCandidates']>
  resourceUsageFacts: NonNullable<CharacterRulePolicyInput['resourceUsageFacts']>
  chargeCalculations: CharacterRulePolicyInput['chargeCalculations']
}
type SpellAccessCandidate = CharacterRulePolicyInput['spellAccessCandidates'][number]

function ownedCharge(charge: CompiledChargeUse | undefined): CompiledCharge | undefined {
  return charge && charge.limitKind !== 'SOURCE_CHARGES' ? charge : undefined
}

function appendCharge(
  chargeCalculations: ResourceFacts['chargeCalculations'],
  charge: CompiledCharge,
  calculationId: string,
  sourceLevel: Parameters<typeof buildCharacterChargeRuleFact>[2]
): void {
  chargeCalculations.push(buildCharacterChargeRuleFact(charge, calculationId, sourceLevel))
}

function appendCandidate(
  candidates: ResourceFacts['resourcePoolCandidates'],
  chargeCalculations: ResourceFacts['chargeCalculations'],
  candidate: CharacterResourcePoolCandidate,
  charge: CompiledCharge,
  sourceLevel: Parameters<typeof buildCharacterChargeRuleFact>[2]
): void {
  candidates.push(candidate)
  appendCharge(chargeCalculations, charge, candidate.chargeCalculationId, sourceLevel)
}

function persistedResourceGrant(
  character: CharacterAuthored,
  resourceId: string,
  source: { kind: 'CLASS'; classId: string } | { kind: 'SUBCLASS'; subclassId: string }
): NonNullable<CharacterAuthored['intent']['resourceGrants']>[number] | undefined {
  return (character.intent.resourceGrants ?? []).find((grant) => {
    if (grant.resourceId !== resourceId) return false
    return source.kind === 'CLASS'
      ? grant.source.kind === 'CLASS' && grant.source.classId === source.classId
      : grant.source.kind === 'SUBCLASS' && grant.source.subclassId === source.subclassId
  })
}

function appendAuthoredResource(
  facts: ResourceFacts,
  character: CharacterAuthored,
  classId: string,
  activeSourceLevel: number,
  resource: CompiledClassResource,
  source: { kind: 'CLASS'; classId: string } | { kind: 'SUBCLASS'; subclassId: string }
): void {
  const persisted = persistedResourceGrant(character, resource.id, source)
  const resourceGrantId = persisted?.id ?? resource.id
  const poolId = createCharacterResourceOwnerKey({ kind: 'AUTHORED_GRANT', resourceGrantId })
  const candidate: CharacterResourcePoolCandidate = {
    sequence: facts.resourcePoolCandidates.length,
    poolId,
    ownerKind: 'AUTHORED_GRANT',
    resourceGrantId,
    chargeId: resource.charges.id,
    availableAtLevel: resource.availableAtLevel,
    activeSourceLevel,
    resourceDefinitionId: resource.id,
    chargeCalculationId: poolId,
    baseResetKind: resource.charges.resetKind
  }
  appendCandidate(
    facts.resourcePoolCandidates,
    facts.chargeCalculations,
    candidate,
    resource.charges,
    {
      sourceLevel: { kind: 'CLASS_LEVEL', classId }
    }
  )
}

function findSpellCharge(
  candidate: SpellAccessCandidate,
  registry: CharacterAssemblyRegistry
): CompiledCharge | undefined {
  const source =
    candidate.sourceKind === 'CLASS' || candidate.sourceKind === 'SUBCLASS'
      ? registry.classes[candidate.sourceId]
      : registry.races[candidate.sourceId]
  const feature = source?.features?.find((entry) => entry.id === candidate.sourceFeatureId)
  const grant = feature?.spells?.find((entry) => entry.id === candidate.grantId)
  return ownedCharge(grant?.charges)
}

export function buildCharacterResourceRuleFacts(params: {
  character: CharacterAuthored
  snapshot: CharacterBuildSnapshot
  registry: CharacterAssemblyRegistry
  spellAccessCandidates: CharacterRulePolicyInput['spellAccessCandidates']
  grantFoldFacts: CharacterGrantFoldInput
  creaturesById: ReadonlyMap<string, CreatureAuthored>
  resourceUsage?: readonly CharacterResourceUsage[]
}): ResourceFacts {
  const {
    character,
    snapshot,
    registry,
    spellAccessCandidates,
    grantFoldFacts,
    creaturesById,
    resourceUsage = []
  } = params
  const facts: ResourceFacts = {
    resourcePoolCandidates: [],
    resourceUsageFacts: [],
    chargeCalculations: []
  }

  for (const classEntry of snapshot.classes) {
    const baseClass = registry.classes[classEntry.classId]
    if (baseClass?.resources) {
      appendAuthoredResource(
        facts,
        character,
        classEntry.classId,
        classEntry.level,
        baseClass.resources,
        { kind: 'CLASS', classId: classEntry.classId }
      )
    }

    const subclass = classEntry.subclassId ? registry.classes[classEntry.subclassId] : undefined
    if (
      subclass?.category === 'SUBCLASS' &&
      subclass.parentClassId === classEntry.classId &&
      subclass.resources
    ) {
      appendAuthoredResource(
        facts,
        character,
        classEntry.classId,
        classEntry.level,
        subclass.resources,
        { kind: 'SUBCLASS', subclassId: subclass.id }
      )
    }
  }

  for (const [index, feature] of snapshot.features.entries()) {
    const definition = registry.features[feature.featureId]
    const foldedFeature = grantFoldFacts.features[index]
    const sourceLevel = {
      sourceLevel:
        feature.timing.kind === 'CLASS_LEVEL'
          ? ({ kind: 'CLASS_LEVEL', classId: feature.timing.classId } as const)
          : ({ kind: 'CHARACTER_LEVEL' } as const)
    }
    const appendSourcePool = (
      charge: CompiledCharge | undefined,
      source: typeof foldedFeature.definition
    ) => {
      if (!charge || !source) return
      const poolId = createCharacterResourceOwnerKey({
        kind: 'AUTHORED_SOURCE',
        sourceId: source.sourceId,
        chargeId: charge.id
      })
      appendCandidate(
        facts.resourcePoolCandidates,
        facts.chargeCalculations,
        {
          sequence: facts.resourcePoolCandidates.length,
          poolId,
          ownerKind: 'AUTHORED_SOURCE',
          sourceId: source.sourceId,
          source: source.mechanicSource,
          chargeId: charge.id,
          resourceDefinitionId: charge.id,
          chargeCalculationId: poolId,
          baseResetKind: charge.resetKind
        },
        charge,
        sourceLevel
      )
    }
    appendSourcePool(ownedCharge(definition?.charges), foldedFeature?.definition ?? null)
    if (feature.source.kind === 'FEAT') {
      appendSourcePool(
        ownedCharge(registry.feats[feature.source.featId]?.charges),
        foldedFeature?.featDefinition ?? null
      )
    }
    for (const option of definition?.options ?? []) {
      appendSourcePool(
        ownedCharge(option.charges),
        foldedFeature?.selectedOptions.find(
          (source) =>
            source.mechanicSource.kind === 'AUTHORED' &&
            source.mechanicSource.definitionId === option.id
        ) ?? null
      )
    }
  }

  for (const [itemIndex, item] of snapshot.equipmentItems.entries()) {
    const charge = ownedCharge(item.compiledItem.charges)
    if (charge) {
      const poolId = createCharacterResourceOwnerKey({
        kind: 'ITEM_INSTANCE',
        itemInstanceId: item.instanceId,
        chargeId: charge.id
      })
      appendCandidate(
        facts.resourcePoolCandidates,
        facts.chargeCalculations,
        {
          sequence: facts.resourcePoolCandidates.length,
          poolId,
          ownerKind: 'ITEM_INSTANCE',
          itemInstanceId: item.instanceId,
          sourceId: null,
          chargeId: charge.id,
          resourceDefinitionId: charge.id,
          chargeCalculationId: poolId,
          baseResetKind: charge.resetKind
        },
        charge,
        { sourceLevel: { kind: 'CHARACTER_LEVEL' } }
      )
    }
    for (const [featureIndex, feature] of (item.compiledItem.features ?? []).entries()) {
      const featureCharge = ownedCharge(feature.charges)
      const sourceId =
        grantFoldFacts.equipmentItems[itemIndex]?.features[featureIndex]?.source.sourceId
      if (!featureCharge || !sourceId) continue
      const featurePoolId = createCharacterResourceOwnerKey({
        kind: 'ITEM_INSTANCE',
        itemInstanceId: item.instanceId,
        chargeId: featureCharge.id
      })
      appendCandidate(
        facts.resourcePoolCandidates,
        facts.chargeCalculations,
        {
          sequence: facts.resourcePoolCandidates.length,
          poolId: featurePoolId,
          ownerKind: 'ITEM_INSTANCE',
          itemInstanceId: item.instanceId,
          sourceId,
          chargeId: featureCharge.id,
          resourceDefinitionId: featureCharge.id,
          chargeCalculationId: featurePoolId,
          baseResetKind: featureCharge.resetKind
        },
        featureCharge,
        { sourceLevel: { kind: 'CHARACTER_LEVEL' } }
      )
    }
  }

  for (const companion of character.state.creatures ?? []) {
    const creature = creaturesById.get(companion.creatureId)
    for (const feature of creature?.features ?? []) {
      const charge = ownedCharge(feature.charges ? compileChargeUse(feature.charges) : undefined)
      if (!charge) continue
      const poolId = createCharacterResourceOwnerKey({
        kind: 'COMPANION_FEATURE',
        companionInstanceId: companion.id,
        featureId: feature.id,
        chargeId: charge.id
      })
      appendCandidate(
        facts.resourcePoolCandidates,
        facts.chargeCalculations,
        {
          sequence: facts.resourcePoolCandidates.length,
          poolId,
          ownerKind: 'COMPANION_FEATURE',
          companionInstanceId: companion.id,
          featureId: feature.id,
          chargeId: charge.id,
          resourceDefinitionId: charge.id,
          chargeCalculationId: poolId,
          baseResetKind: charge.resetKind
        },
        charge,
        { sourceLevel: { kind: 'CHARACTER_LEVEL' } }
      )
    }
  }

  const spellPoolIds = new Set<string>()
  for (const candidate of spellAccessCandidates) {
    if (!isCharacterSpellActionAccessCandidate(candidate)) continue
    const charge = findSpellCharge(candidate, registry)
    if (!charge) continue
    const poolId = createCharacterResourceOwnerKey({
      kind: 'SPELL_SOURCE',
      resourceGrantId: candidate.accessId,
      spellId: candidate.spellId,
      sourceKind: 'FEATURE',
      sourceInstanceId: candidate.sourceInstanceId
    })
    if (spellPoolIds.has(poolId)) continue
    spellPoolIds.add(poolId)
    appendCandidate(
      facts.resourcePoolCandidates,
      facts.chargeCalculations,
      {
        sequence: facts.resourcePoolCandidates.length,
        poolId,
        ownerKind: 'SPELL_SOURCE',
        accessId: candidate.accessId,
        sourceInstanceId: candidate.sourceInstanceId,
        spellId: candidate.spellId,
        chargeId: charge.id,
        resourceDefinitionId: charge.id,
        chargeCalculationId: poolId,
        baseResetKind: charge.resetKind
      },
      charge,
      {
        sourceLevel: candidate.owningClassId
          ? { kind: 'CLASS_LEVEL', classId: candidate.owningClassId }
          : { kind: 'CHARACTER_LEVEL' },
        spellCastLevel: candidate.castAtLevel
      }
    )
  }

  const usageByPoolId = new Map<string, number>()
  for (const usage of resourceUsage) {
    const poolId = createCharacterResourceOwnerKey(usage.owner)
    if (usageByPoolId.has(poolId)) {
      throw new Error(`Duplicate persisted resource usage for pool: ${poolId}`)
    }
    usageByPoolId.set(poolId, usage.used)
  }
  facts.resourceUsageFacts = facts.resourcePoolCandidates.flatMap((candidate) => {
    const rawUsed = usageByPoolId.get(candidate.poolId)
    return rawUsed === undefined ? [] : [{ poolId: candidate.poolId, rawUsed }]
  })

  return facts
}
