import type { CompiledClass } from '../../subjects/compilers/class.js'
import type { CompiledProficiencyGrant } from '../../grants/compilers/proficiency.js'
import {
  getCharacterProvenanceIdentityKey,
  type CharacterProvenance
} from '../../subjects/authored/character/intent.js'
import type { RulesSystem } from '../contracts/rulesSystem.js'
import type { CharacterAssemblyRegistry } from '../registry.js'
import type { CharacterBuildSnapshot } from '../snapshot.js'
import { evaluateCharacterFacet } from '../prerequisiteEval.js'
import {
  applyGrantBearingSource,
  createAuthoredMechanicSource,
  createCharacterEligibilityContext,
  createEngineAccumulatedState,
  type EngineAccumulatedState
} from './grantApplication.js'
import { getFeatureActiveLevel, getSelectedFeatureOptions } from './featureSelection.js'

export type { EngineAccumulatedState } from './grantApplication.js'
export { createCharacterEligibilityContext }

/**
 * Applies snapshot grants in RulesSystem feature-source order while preserving
 * snapshot order for sources with the same rank.
 */
export function applyGrants(
  snapshot: CharacterBuildSnapshot,
  registry: CharacterAssemblyRegistry,
  rules: RulesSystem,
  spellAccess: readonly { spellId: string }[]
): EngineAccumulatedState {
  const acc = createEngineAccumulatedState()
  const sourceOrder = new Map(rules.featureSourceOrder.map((kind, index) => [kind, index]))
  const scheduled: Array<{ rank: number; position: number; apply(): void }> = []
  let position = 0

  const schedule = (sourceKind: string, apply: () => void): void => {
    const rank = sourceOrder.get(sourceKind)
    if (rank === undefined) {
      throw new Error(
        `RulesSystem.featureSourceOrder is missing active source kind "${sourceKind}".`
      )
    }
    scheduled.push({ rank, position: position++, apply })
  }

  for (const [classIndex, classRecord] of snapshot.classes.entries()) {
    const compiledClass = registry.classes[classRecord.classId]
    const compiledSubclass = classRecord.subclassId
      ? registry.classes[classRecord.subclassId]
      : undefined
    const validSubclass =
      compiledSubclass?.category === 'SUBCLASS' &&
      compiledSubclass.parentClassId === classRecord.classId

    schedule('CLASS', () => {
      if (compiledClass) {
        const proficiencies =
          classIndex > 0 && compiledClass.category === 'BASE'
            ? compiledClass.multiclass.proficiencies
            : compiledClass.proficiencies
        applyClassGrants(
          compiledClass,
          { kind: 'CLASS', classId: classRecord.classId },
          snapshot,
          spellAccess,
          acc,
          rules,
          registry,
          classRecord.level,
          proficiencies
        )
      }
      if (validSubclass) {
        applyClassGrants(
          compiledSubclass,
          { kind: 'SUBCLASS', subclassId: compiledSubclass.id },
          snapshot,
          spellAccess,
          acc,
          rules,
          registry,
          classRecord.level
        )
      }
    })
    if (validSubclass) {
      const classRank = sourceOrder.get('CLASS')
      const subclassRank = sourceOrder.get('SUBCLASS')
      if (subclassRank === undefined) {
        throw new Error('RulesSystem.featureSourceOrder is missing active source kind "SUBCLASS".')
      }
      if (classRank === undefined || subclassRank !== classRank + 1) {
        throw new Error(
          'RulesSystem.featureSourceOrder must place "SUBCLASS" immediately after "CLASS" for paired class progression.'
        )
      }
    }
  }

  const backgroundId = snapshot.backgroundId
  if (backgroundId) {
    const background = registry.backgrounds?.[backgroundId]
    schedule('BACKGROUND', () => {
      if (!background) return
      const source = { kind: 'BACKGROUND', backgroundId } as const
      applyGrantBearingSource(
        background,
        source,
        createAuthoredMechanicSource(snapshot, source, backgroundId),
        snapshot,
        spellAccess,
        acc,
        rules,
        registry
      )
    })
  }

  for (const feature of snapshot.features) {
    schedule(feature.source.kind, () => {
      const registryFeature = registry.features[feature.featureId]
      const grantContext = { activeLevel: getFeatureActiveLevel(snapshot, feature) }
      if (registryFeature) {
        applyGrantBearingSource(
          registryFeature,
          feature.source,
          createAuthoredMechanicSource(
            snapshot,
            feature.source,
            feature.featureId,
            feature.acquisitionId ??
              `${getCharacterProvenanceIdentityKey(feature.source)}:${feature.featureId}`
          ),
          snapshot,
          spellAccess,
          acc,
          rules,
          registry,
          grantContext
        )
        for (const selected of getSelectedFeatureOptions(feature, registryFeature)) {
          applyGrantBearingSource(
            selected.option,
            selected.source,
            createAuthoredMechanicSource(snapshot, selected.source, selected.option.id),
            snapshot,
            spellAccess,
            acc,
            rules,
            registry,
            grantContext
          )
        }
      }
      if (feature.source.kind !== 'FEAT' || typeof feature.source.featId !== 'string') return
      const compiledFeat = registry.feats[feature.source.featId]
      if (!compiledFeat) return
      applyGrantBearingSource(
        compiledFeat,
        feature.source,
        createAuthoredMechanicSource(
          snapshot,
          feature.source,
          feature.source.featId,
          feature.acquisitionId ??
            `${getCharacterProvenanceIdentityKey(feature.source)}:${feature.source.featId}`
        ),
        snapshot,
        spellAccess,
        acc,
        rules,
        registry,
        grantContext
      )
    })
  }

  if (snapshot.equipmentItems.length > 0) {
    schedule('EQUIPMENT', () => applyEquipmentGrants(snapshot, spellAccess, acc, rules, registry))
  }

  scheduled.sort((left, right) => left.rank - right.rank || left.position - right.position)
  for (const source of scheduled) source.apply()
  return acc
}

function applyEquipmentGrants(
  snapshot: CharacterBuildSnapshot,
  spellAccess: readonly { spellId: string }[],
  acc: EngineAccumulatedState,
  rules: RulesSystem,
  registry: CharacterAssemblyRegistry
): void {
  const activeLevel = Math.max(snapshot.totalLevel, 1)
  for (const item of snapshot.equipmentItems) {
    if (item.compiledItem.requiresAttunement && !item.attuned) continue
    const sourceState = {
      carried: true,
      equipped: Boolean(item.equippedState),
      attuned: item.attuned
    }
    if (
      !evaluateCharacterFacet(
        item.compiledItem.restrictions,
        createCharacterEligibilityContext(snapshot, spellAccess, acc, sourceState),
        registry
      ).passed
    )
      continue
    acc.activeEquipmentInstanceIds.push(item.instanceId)
    for (const feature of item.compiledItem.features ?? []) {
      const featureIsEligible = applyGrantBearingSource(
        feature,
        { kind: 'FEATURE', featureId: feature.id },
        {
          kind: 'EQUIPMENT_INSTANCE',
          equipmentId: item.contentRef.definitionId,
          itemInstanceId: item.instanceId
        },
        snapshot,
        spellAccess,
        acc,
        rules,
        registry,
        { activeLevel, sourceState }
      )
      if (
        featureIsEligible &&
        feature.charges?.limitKind === 'SOURCE_CHARGES' &&
        item.compiledItem.charges &&
        feature.charges.cost > 0
      ) {
        acc.equipmentFeatureChargeUses.push({
          featureId: feature.id,
          equipmentId: item.contentRef.definitionId,
          itemInstanceId: item.instanceId,
          chargeId: item.compiledItem.charges.id,
          cost: feature.charges.cost
        })
      }
    }
  }
}

function applyClassGrants(
  compiledClass: CompiledClass,
  ownerSource: CharacterProvenance,
  snapshot: CharacterBuildSnapshot,
  spellAccess: readonly { spellId: string }[],
  acc: EngineAccumulatedState,
  rules: RulesSystem,
  registry: CharacterAssemblyRegistry,
  activeLevel: number,
  proficiencies: CompiledProficiencyGrant[] | undefined = compiledClass.proficiencies
): void {
  applyGrantBearingSource(
    { ...compiledClass, proficiencies },
    ownerSource,
    createAuthoredMechanicSource(snapshot, ownerSource, compiledClass.id),
    snapshot,
    spellAccess,
    acc,
    rules,
    registry,
    { activeLevel }
  )
}
