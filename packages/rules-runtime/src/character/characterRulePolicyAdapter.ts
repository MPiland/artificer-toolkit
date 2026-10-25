import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'
import type { CharacterCalculation } from '@artificer-toolkit/shared/character'
import type { CompiledChargeUse } from '@artificer-toolkit/shared/compilers'

import type {
  CharacterRuleSense,
  CharacterSheetRuleProjection
} from './characterSheetRuleProjection.js'
import { rollModeCapabilityRegistry } from '../platformPolicyModules.js'
import { findCompiledSpellGrant } from './characterSpellRuleFacts.js'

type Evaluation = Pick<CharacterRuleEvaluationResult, 'snapshot' | 'registry' | 'facts' | 'output'>
type NumericCalculation = Evaluation['output']['derivedStats']['proficiencyBonus']

function calculation(value: NumericCalculation): CharacterCalculation<number> {
  // A System override (an Encounter scalar reduction or a creature form's score) is already in
  // `effective`; only a manual adjustment is reported as an override.
  const override = value.override
  const adjustmentId =
    override?.source.kind === 'MANUAL_ADJUSTMENT' ? override.source.adjustmentId : null
  return {
    base: value.base,
    effective: value.effective,
    contributions: value.contributions.map((contribution) => ({
      id: contribution.sourceId,
      source: contribution.source,
      value: contribution.value,
      state: contribution.state
    })),
    ...(override && adjustmentId ? { override: { adjustmentId, value: override.value } } : {})
  }
}

function proficiencyCalculation(
  value: Evaluation['output']['derivedStats']['savingThrows'][number]['proficiency']
): CharacterCalculation<'NONE' | 'HALF' | 'FULL' | 'DOUBLE'> {
  // A System override (an Encounter scalar reduction or a creature form's score) is already in
  // `effective`; only a manual adjustment is reported as an override.
  const override = value.override
  const adjustmentId =
    override?.source.kind === 'MANUAL_ADJUSTMENT' ? override.source.adjustmentId : null
  return {
    base: value.base,
    effective: value.effective,
    contributions: value.contributions.map((contribution) => ({
      id: contribution.sourceId,
      source: contribution.source,
      value: contribution.value,
      state: contribution.state
    })),
    ...(override && adjustmentId ? { override: { adjustmentId, value: override.value } } : {})
  }
}

function selectionCalculation<T extends string>(value: {
  base: T
  effective: T
  override: {
    sourceId: string
    value: T
    source?: Evaluation['output']['defenses'][number]['source']
  } | null
}): CharacterCalculation<T> {
  return {
    base: value.base,
    effective: value.effective,
    contributions: [],
    ...(value.override &&
    (value.override.source?.kind ?? 'MANUAL_ADJUSTMENT') === 'MANUAL_ADJUSTMENT'
      ? {
          override: {
            adjustmentId:
              value.override.source?.kind === 'MANUAL_ADJUSTMENT'
                ? value.override.source.adjustmentId
                : value.override.sourceId,
            value: value.override.value
          }
        }
      : {})
  }
}

function exactSpellCharge(
  evaluation: Evaluation,
  access: Evaluation['output']['spellAccess'][number]
): CompiledChargeUse | undefined {
  if (access.charge === null) return undefined
  const charge = findCompiledSpellGrant(evaluation.registry, access)?.charges
  if (!charge || charge.id !== access.charge.id) {
    throw new Error(
      `Character rule policy spell charge is missing or mismatched: ${access.accessId}`
    )
  }
  return charge
}

function activeItems(
  evaluation: Evaluation
): CharacterSheetRuleProjection['activeItemContributions'] {
  const active = new Set(evaluation.output.grantFold.activeEquipmentInstanceIds)
  return evaluation.snapshot.equipmentItems.flatMap((item) => {
    if (!active.has(item.instanceId)) return []
    const applied = evaluation.output.grantFold.modifierGroups.flatMap((group) =>
      group.contributions.some((contribution) => {
        const modifier = evaluation.output.grantFold.modifiers[contribution.acceptedModifierIndex]
        return (
          modifier?.source.kind === 'EQUIPMENT_INSTANCE' &&
          modifier.source.itemInstanceId === item.instanceId
        )
      })
        ? [group.domainKey]
        : []
    )
    if (item.compiledItem.category === 'ARMOR' || item.compiledItem.category === 'SHIELD')
      applied.push('ARMOR_CLASS')
    return applied.length === 0
      ? []
      : [
          {
            instanceId: item.instanceId,
            contentRef: item.contentRef,
            modifiersApplied: [...new Set(applied)]
          }
        ]
  })
}

function accessSource(
  access: Evaluation['output']['spellAccess'][number]
): CharacterSheetRuleProjection['spellAccess'][number]['source'] {
  switch (access.sourceKind) {
    case 'CLASS':
      return { kind: 'CLASS', classId: access.sourceId }
    case 'SUBCLASS':
      return { kind: 'SUBCLASS', subclassId: access.sourceId }
    case 'RACE':
      return { kind: 'RACE', raceId: access.sourceId }
    case 'SUBRACE':
      return { kind: 'SUBRACE', subraceId: access.sourceId }
    case 'FEAT':
      return { kind: 'FEAT', featId: access.sourceId }
    case 'BACKGROUND':
      return { kind: 'BACKGROUND', backgroundId: access.sourceId }
    case 'OPTION':
      if (access.acquiredParentId === null)
        throw new Error(
          `Character rule policy option source is missing its acquisition: ${access.accessId}`
        )
      return {
        kind: 'OPTION',
        acquiredParentId: access.acquiredParentId,
        optionId: access.sourceId
      }
  }
}

export function projectCharacterSpellAccess(
  evaluation: Evaluation
): CharacterSheetRuleProjection['spellAccess'] {
  return evaluation.output.spellAccess.map((access) => {
    if (access.timingKind === 'CLASS_LEVEL' && !access.owningClassId)
      throw new Error(
        `Character rule policy class timing is missing an owning class: ${access.accessId}`
      )
    const charges = exactSpellCharge(evaluation, access)
    return {
      id: access.accessId,
      spellId: access.spellId,
      source: accessSource(access),
      timing:
        access.timingKind === 'CLASS_LEVEL'
          ? {
              kind: 'CLASS_LEVEL' as const,
              classId: access.owningClassId!,
              classLevel: access.timingLevel
            }
          : { kind: 'CHARACTER_LEVEL' as const, level: access.timingLevel },
      sourceFeatureId: access.sourceFeatureId,
      grantId: access.grantId,
      sourceInstanceId: access.sourceInstanceId,
      attributes: access.attributes,
      ...(access.castAtLevel ? { castAtLevel: access.castAtLevel } : {}),
      ...(access.castingAbility ? { castingAbility: access.castingAbility } : {}),
      ...(charges ? { charges } : {})
    }
  })
}

export function projectCharacterRulePolicyToSheetProjection(
  evaluation: Evaluation
): CharacterSheetRuleProjection {
  const { output, snapshot } = evaluation
  const abilities = Object.fromEntries(
    output.derivedStats.abilities.map((entry) => [entry.abilityId, entry])
  )
  const savingThrows = Object.fromEntries(
    output.derivedStats.savingThrows.map((entry) => [entry.abilityId, entry])
  )
  const skills = Object.fromEntries(
    output.derivedStats.skills.map((entry) => [entry.skillId, entry])
  )
  const spellcasting = output.derivedStats.spellcasting
  const spellState = output.classSpellStates.flatMap((entry) => {
    if (entry.learnedSpellIds.length === 0 && entry.preparedSpellIds.length === 0) return []
    return [
      {
        classId: entry.classId,
        spells: {
          ...(entry.learnedSpellIds.length > 0 ? { learned: entry.learnedSpellIds } : {}),
          ...(entry.preparedSpellIds.length > 0 ? { prepared: entry.preparedSpellIds } : {})
        }
      }
    ]
  })
  const senses = output.senses.map(({ senseDefinitionId, range }): CharacterRuleSense => ({
    senseDefinitionId,
    range:
      range.rangeKind === 'DISTANCE'
        ? { id: range.id, rangeKind: range.rangeKind, amount: range.amount, unit: range.unit }
        : range
  }))
  const resources = snapshot.classes.flatMap((classEntry) => {
    const owners = [
      { id: classEntry.classId, record: evaluation.registry.classes[classEntry.classId] },
      ...(classEntry.subclassId
        ? [
            {
              id: classEntry.subclassId,
              record: evaluation.registry.classes[classEntry.subclassId]
            }
          ]
        : [])
    ]
    return owners.flatMap((owner) => {
      const definition = owner.record?.resources
      if (!definition) return []
      const candidates = evaluation.facts.resourcePoolCandidates.filter(
        (
          candidate
        ): candidate is Extract<
          Evaluation['facts']['resourcePoolCandidates'][number],
          { ownerKind: 'AUTHORED_GRANT' }
        > =>
          candidate.ownerKind === 'AUTHORED_GRANT' &&
          candidate.resourceDefinitionId === definition.id
      )
      if (candidates.length !== 1)
        throw new Error(
          `Character rule policy class resource ownership is ${candidates.length === 0 ? 'missing' : 'ambiguous'}: ${owner.id}`
        )
      if (candidates[0]!.activeSourceLevel < candidates[0]!.availableAtLevel) return []
      const resolved = output.resources.filter(
        (resource) => resource.poolId === candidates[0]!.poolId
      )
      if (resolved.length !== 1)
        throw new Error(
          `Character rule policy class resource is ${resolved.length === 0 ? 'missing' : 'ambiguous'}: ${candidates[0]!.poolId}`
        )
      const resource = resolved[0]!
      if (resource.state !== 'RESOLVED' || resource.maximum === null || resource.maximum <= 0)
        return []
      return [
        {
          resourceId: definition.id,
          label: definition.label,
          maxCount: resource.maximum,
          maxCountCalculation: {
            base: resource.maximum,
            effective: resource.maximum,
            contributions: []
          },
          rechargeOn: resource.resetKind,
          sourceFeatureId: owner.id
        }
      ]
    })
  })
  return {
    characterId: snapshot.characterId,
    systemId: snapshot.systemId,
    proficiencies: output.proficiencies,
    senses,
    defenses: output.defenses,
    derivedStats: {
      proficiencyBonus: output.derivedStats.proficiencyBonus.effective,
      abilityScores: Object.fromEntries(
        Object.entries(abilities).map(([key, entry]) => [key, entry.score.effective])
      ),
      abilityModifiers: Object.fromEntries(
        Object.entries(abilities).map(([key, entry]) => [key, entry.modifier.effective])
      ),
      savingThrows: Object.fromEntries(
        Object.entries(savingThrows).map(([key, entry]) => [key, entry.total.effective])
      ),
      skillBonuses: Object.fromEntries(
        Object.entries(skills).map(([key, entry]) => [key, entry.total.effective])
      ),
      skillGoverningAbilities: Object.fromEntries(
        Object.entries(skills).map(([key, entry]) => [key, entry.governingAbility.effective])
      ),
      passiveChecks: Object.fromEntries(
        Object.entries(skills).map(([key, entry]) => [key, entry.passive.effective])
      ),
      movementSpeeds: output.movement.speeds.map(({ speedId, amount, unit }) => ({
        speedId,
        amount,
        unit
      })),
      ...(output.movement.primaryMovementSpeedId
        ? { primaryMovementSpeedId: output.movement.primaryMovementSpeedId }
        : {}),
      initiative: output.derivedStats.initiative.effective,
      armorClass: output.derivedStats.armorClass.effective,
      maxHitPoints: output.derivedStats.maxHitPoints.effective,
      ...(spellcasting
        ? {
            spellSaveDC: spellcasting.saveDc.effective,
            spellAttackBonus: spellcasting.attackBonus.effective
          }
        : {})
    },
    calculations: {
      proficiencyBonus: calculation(output.derivedStats.proficiencyBonus),
      abilityScores: Object.fromEntries(
        Object.entries(abilities).map(([key, entry]) => [key, calculation(entry.score)])
      ),
      abilityModifiers: Object.fromEntries(
        Object.entries(abilities).map(([key, entry]) => [key, calculation(entry.modifier)])
      ),
      savingThrowProficiencyLevels: Object.fromEntries(
        Object.entries(savingThrows).map(([key, entry]) => [
          key,
          proficiencyCalculation(entry.proficiency)
        ])
      ),
      savingThrows: Object.fromEntries(
        Object.entries(savingThrows).map(([key, entry]) => [key, calculation(entry.total)])
      ),
      skillGoverningAbilities: Object.fromEntries(
        Object.entries(skills).map(([key, entry]) => [
          key,
          selectionCalculation(entry.governingAbility)
        ])
      ),
      skillProficiencyLevels: Object.fromEntries(
        Object.entries(skills).map(([key, entry]) => [
          key,
          proficiencyCalculation(entry.proficiency)
        ])
      ),
      skillBonuses: Object.fromEntries(
        Object.entries(skills).map(([key, entry]) => [key, calculation(entry.total)])
      ),
      passiveChecks: Object.fromEntries(
        Object.entries(skills).map(([key, entry]) => [key, calculation(entry.passive)])
      ),
      movementSpeeds: Object.fromEntries(
        output.movement.speeds.map((entry) => [entry.speedId, calculation(entry.calculation)])
      ),
      senseRanges: Object.fromEntries(
        output.senses.flatMap((entry) =>
          entry.range.rangeKind === 'DISTANCE'
            ? [[entry.senseDefinitionId, calculation(entry.range.calculation)] as const]
            : []
        )
      ),
      initiative: calculation(output.derivedStats.initiative),
      armorClass: calculation(output.derivedStats.armorClass),
      maxHitPoints: calculation(output.derivedStats.maxHitPoints),
      ...(spellcasting
        ? {
            spellSaveDC: calculation(spellcasting.saveDc),
            spellAttackBonus: calculation(spellcasting.attackBonus)
          }
        : {})
    },
    rollModes: output.rollModes,
    offeredRollModes: rollModeCapabilityRegistry.offeredRollModes(snapshot.systemId),
    ...(spellState.length > 0 ? { spellState } : {}),
    spellAccess: projectCharacterSpellAccess(evaluation),
    spellSlots: {
      maxByLevel: Object.fromEntries(
        output.spellSlots.maxByLevel.map((entry) => [entry.spellLevel, entry.slotCount])
      ),
      slotPools: output.spellSlots.slotPools.map(({ poolCode, slots, level }) => ({
        poolCode,
        slots,
        level
      })),
      fusionStrategy: output.spellSlots.fusionStrategy
    },
    resources,
    spellMechanics: output.spellMechanics.map((entry) => ({
      ...entry,
      calculations: {
        ...entry.calculations,
        attackBonus: entry.calculations.attackBonus && calculation(entry.calculations.attackBonus),
        saveDC: entry.calculations.saveDC && calculation(entry.calculations.saveDC),
        damageBonus: calculation(entry.calculations.damageBonus)
      }
    })),
    itemMechanics: output.itemMechanics.map((entry) => ({
      ...entry,
      calculations: {
        ...entry.calculations,
        attackBonus: calculation(entry.calculations.attackBonus),
        cost: entry.calculations.cost && calculation(entry.calculations.cost),
        damageBonus: calculation(entry.calculations.damageBonus),
        weight: entry.calculations.weight && calculation(entry.calculations.weight)
      }
    })),
    companions: output.companions.map((entry) => ({
      ...entry,
      calculations: {
        ...entry.calculations,
        armorClass: calculation(entry.calculations.armorClass),
        maxHitPoints: calculation(entry.calculations.maxHitPoints),
        size: entry.calculations.size && selectionCalculation(entry.calculations.size),
        alignmentId:
          entry.calculations.alignmentId && selectionCalculation(entry.calculations.alignmentId),
        creatureTypeId:
          entry.calculations.creatureTypeId &&
          selectionCalculation(entry.calculations.creatureTypeId)
      }
    })),
    activeItemContributions: activeItems(evaluation),
    equipmentFeatureChargeUses: output.grantFold.equipmentFeatureChargeUses
  }
}
