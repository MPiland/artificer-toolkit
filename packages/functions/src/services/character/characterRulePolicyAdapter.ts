import type { CharacterRuleEvaluationResult } from './characterRuleEvaluation.js'
import type { CharacterCalculation } from '@artificer-toolkit/shared/character'
import type { CompiledChargeUse } from '@artificer-toolkit/shared/compilers'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'

import type { CharacterSheetRuleProjection } from './characterSheetRuleProjection.js'

type Evaluation = Pick<CharacterRuleEvaluationResult, 'snapshot' | 'registry' | 'facts' | 'output'>
type NumericCalculation = Evaluation['output']['derivedStats']['proficiencyBonus']

function calculation(value: NumericCalculation): CharacterCalculation<number> {
  const override = value.override
  if (override && override.source.kind !== 'MANUAL_ADJUSTMENT') {
    throw new Error(
      `Character rule policy override must be a manual adjustment: ${override.sourceId}`
    )
  }
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
  const override = value.override
  if (override && override.source.kind !== 'MANUAL_ADJUSTMENT') {
    throw new Error(
      `Character rule policy override must be a manual adjustment: ${override.sourceId}`
    )
  }
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
  if (value.override?.source && value.override.source.kind !== 'MANUAL_ADJUSTMENT') {
    throw new Error(
      `Character rule policy override must be a manual adjustment: ${value.override.sourceId}`
    )
  }
  return {
    base: value.base,
    effective: value.effective,
    contributions: [],
    ...(value.override
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
  const source =
    access.sourceKind === 'CLASS' || access.sourceKind === 'SUBCLASS'
      ? evaluation.registry.classes[access.sourceId]
      : evaluation.registry.races[access.sourceId]
  const charge = source?.features
    ?.find((feature) => feature.id === access.sourceFeatureId)
    ?.spells?.find((grant) => grant.id === access.grantId)?.charges
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
  const senses = output.senses.map((sense) => {
    const folded = output.grantFold.senses.find(
      (candidate) => candidate.senseCode === sense.senseCode
    )
    if (!sense.range && folded?.range) {
      const foldedRange = rangeDtoSchema.parse(folded.range)
      if (foldedRange.rangeKind !== 'DISTANCE')
        return { senseCode: sense.senseCode, range: foldedRange }
    }
    return sense.range
      ? {
          senseCode: sense.senseCode,
          range: {
            id: sense.range.id,
            rangeKind: 'DISTANCE' as const,
            amount: sense.range.amount,
            unit: sense.range.unit
          }
        }
      : { senseCode: sense.senseCode }
  })
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
          entry.range ? [[entry.senseCode, calculation(entry.range.calculation)] as const] : []
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
    ...(spellState.length > 0 ? { spellState } : {}),
    spellAccess: output.spellAccess.map((access) => {
      if (access.timingKind === 'CLASS_LEVEL' && !access.owningClassId)
        throw new Error(
          `Character rule policy class timing is missing an owning class: ${access.accessId}`
        )
      const charges = exactSpellCharge(evaluation, access)
      return {
        id: access.accessId,
        spellId: access.spellId,
        source:
          access.sourceKind === 'CLASS'
            ? { kind: 'CLASS' as const, classId: access.sourceId }
            : access.sourceKind === 'SUBCLASS'
              ? { kind: 'SUBCLASS' as const, subclassId: access.sourceId }
              : access.sourceKind === 'RACE'
                ? { kind: 'RACE' as const, raceId: access.sourceId }
                : { kind: 'SUBRACE' as const, subraceId: access.sourceId },
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
    }),
    spellSlots: {
      maxByLevel: Object.fromEntries(
        output.spellSlots.maxByLevel.map((entry) => [entry.spellLevel, entry.slotCount])
      ),
      ...(output.spellSlots.pactMagic
        ? {
            pactMagic: {
              slots: output.spellSlots.pactMagic.slots,
              level: output.spellSlots.pactMagic.level
            }
          }
        : {}),
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
