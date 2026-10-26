import {
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_PROPERTY_CODE,
  HAND_CONFLICT_MESSAGE,
  isHandSlot,
  isHeldEquipmentCategory,
  resolveHandOccupancy,
  type CreatureAuthored,
  type EquipmentAuthored
} from '@artificer-toolkit/shared'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { srdBaselineContent } from './index.js'
import { SRD_SENSE_DEFINITIONS } from './senses.js'
import {
  SRD_BLINDSIGHT_SENSE_ID,
  SRD_DARKVISION_SENSE_ID,
  SRD_DEVILS_SIGHT_SENSE_ID,
  SRD_SEE_INVISIBILITY_SENSE_ID,
  SRD_SYSTEM_ID,
  SRD_TREMORSENSE_SENSE_ID,
  SRD_TRUESIGHT_SENSE_ID
} from './vocabulary.js'

interface SrdSourceAuditIssue {
  domain: string
  id: string
  label: string
  issue: string
  paths?: string[]
}

export function auditSrdSourceSemantics(): SrdSourceAuditIssue[] {
  const issues: SrdSourceAuditIssue[] = []
  const expectedSenseDefinitionIds = [
    SRD_DARKVISION_SENSE_ID,
    SRD_BLINDSIGHT_SENSE_ID,
    SRD_TREMORSENSE_SENSE_ID,
    SRD_TRUESIGHT_SENSE_ID,
    SRD_SEE_INVISIBILITY_SENSE_ID,
    SRD_DEVILS_SIGHT_SENSE_ID
  ]
  const actualSenseDefinitionIds = SRD_SENSE_DEFINITIONS.map((definition) => definition.id)
  if (
    actualSenseDefinitionIds.length !== expectedSenseDefinitionIds.length ||
    actualSenseDefinitionIds.some((id, index) => id !== expectedSenseDefinitionIds[index])
  ) {
    issues.push({
      domain: 'senses',
      id: '<sense-definition-roots>',
      label: 'SRD sense definitions',
      issue: 'canonical sense definition roots do not exactly match the vocabulary UUID set'
    })
  }
  for (const definition of SRD_SENSE_DEFINITIONS) {
    if (
      definition.document.id !== definition.id ||
      definition.document.gameSystemId !== SRD_SYSTEM_ID ||
      definition.checksum !== checksumRuleDocument(definition.document)
    ) {
      issues.push({
        domain: 'senses',
        id: definition.id,
        label: definition.label,
        issue: 'sense definition identity, System, or checksum is not canonical'
      })
    }
  }
  const classes = srdBaselineContent.subjects.classes
  const baseClasses = classes.filter((record) => record.category === 'BASE')
  const subclasses = classes.filter((record) => record.category === 'SUBCLASS')
  const equipment = srdBaselineContent.subjects.equipment
  const equipmentIds = new Set(equipment.map((record) => record.id))

  if (baseClasses.length !== 12) {
    issues.push({
      domain: 'classes',
      id: '<base-class-count>',
      label: 'Base classes',
      issue: `expected 12 base classes but found ${baseClasses.length}`
    })
  }

  for (const baseClass of baseClasses) {
    if (baseClass.startingEquipment.sets.length === 0) {
      issues.push({
        domain: 'classes',
        id: baseClass.id,
        label: baseClass.label,
        issue: 'base class has no starting equipment set'
      })
    }

    if (
      subclasses.some((record) => record.parentClassId === baseClass.id) &&
      baseClass.subclassSelectionLevel === undefined
    ) {
      issues.push({
        domain: 'classes',
        id: baseClass.id,
        label: baseClass.label,
        issue: 'base class has subclasses but no subclass selection level'
      })
    }

    for (const set of baseClass.startingEquipment.sets) {
      for (const group of set.groups) {
        if (group.options.length === 0) {
          issues.push({
            domain: 'classes',
            id: baseClass.id,
            label: baseClass.label,
            issue: `starting equipment group ${group.id} has no options`
          })
        }

        for (const option of group.options) {
          for (const item of option.items) {
            if (item.startingEquipmentKind !== 'EQUIPMENT') continue
            if (!('authoringModeKind' in item)) continue

            if (item.authoringModeKind === 'SELECTED') {
              const missingEquipmentIds = item.equipmentIds.filter((id) => !equipmentIds.has(id))
              if (missingEquipmentIds.length > 0) {
                issues.push({
                  domain: 'classes',
                  id: baseClass.id,
                  label: baseClass.label,
                  issue: `starting equipment item ${item.id} references missing equipment`,
                  paths: missingEquipmentIds
                })
              }
              continue
            }

            const hasCandidate = equipment.some(
              (candidate) =>
                (!item.category || candidate.category === item.category) &&
                (!item.properties?.length ||
                  item.properties.every((property) => candidate.properties?.includes(property)))
            )
            if (!hasCandidate) {
              issues.push({
                domain: 'classes',
                id: baseClass.id,
                label: baseClass.label,
                issue: `starting equipment item ${item.id} has no matching equipment candidate`
              })
            }
          }
        }
      }
    }
  }

  const wizard = baseClasses.find((record) => record.label === 'Wizard')
  const wizardLevel20 = wizard?.spellcasting?.spellLimits.find((limit) => limit.classLevel === 20)
  if (wizardLevel20?.learnedSpellsLimit !== 44) {
    issues.push({
      domain: 'classes',
      id: wizard?.id ?? '<wizard>',
      label: 'Wizard',
      issue: `expected level-20 learned spell limit 44 but found ${wizardLevel20?.learnedSpellsLimit ?? 'none'}`
    })
  }

  const cleric = baseClasses.find((record) => record.label === 'Cleric')
  const clericEligibilityPredicates =
    cleric?.startingEquipment.sets.flatMap((set) =>
      set.groups.flatMap((group) =>
        group.options.flatMap(
          (option) =>
            option.eligibility?.groups.flatMap((facetGroup) =>
              facetGroup.contexts.flatMap((context) =>
                (context.conditions ?? []).flatMap((condition) =>
                  condition.kind === 'PREDICATE' ? [condition.predicateCode] : []
                )
              )
            ) ?? []
        )
      )
    ) ?? []
  if (
    !clericEligibilityPredicates.includes('EQUIPMENT_PROFICIENCY') ||
    !clericEligibilityPredicates.includes('EQUIPMENT_PROPERTY_PROFICIENCY')
  ) {
    issues.push({
      domain: 'classes',
      id: cleric?.id ?? '<cleric>',
      label: 'Cleric',
      issue: 'conditional starting equipment is missing exact or property proficiency eligibility'
    })
  }

  // A Legendary Action option authored "Costs N Actions" spends N from the pool.
  for (const creature of srdBaselineContent.subjects.creatures) {
    for (const option of creature.features.flatMap((feature) => feature.options ?? [])) {
      const cost = Number(/\(Costs (\d+) Actions\)/.exec(option.label)?.[1] ?? 1)
      const mismatched = (option.effects ?? []).filter(
        (effect) =>
          effect.invocation.kind === 'ACTION' &&
          effect.invocation.resourceUse !== undefined &&
          effect.invocation.resourceUse.cost !== cost
      )
      if (mismatched.length > 0) {
        issues.push({
          domain: 'creatures',
          id: creature.id,
          label: creature.label,
          issue: `Legendary Action option "${option.label}" does not spend ${cost}`,
          paths: mismatched.map((effect) => effect.id)
        })
      }
    }
  }

  issues.push(...auditCreatureEquipmentLoadouts(srdBaselineContent.subjects.creatures, equipment))

  return issues
}

/**
 * The loadout checks the Creature schema cannot make because it does not resolve Equipment (D107):
 * every entry binds existing Equipment; hands hold no conflict once two-handed weapons are known;
 * hands hold only weapons and shields and nothing held is worn; worn armor binds no action Feature;
 * and a Creature wears at most one armor.
 */
export function auditCreatureEquipmentLoadouts(
  creatures: readonly CreatureAuthored[],
  equipment: readonly EquipmentAuthored[]
): SrdSourceAuditIssue[] {
  const equipmentById = new Map(equipment.map((record) => [record.id, record]))
  return creatures.flatMap((creature) => {
    const loadout = creature.equipmentLoadout ?? []
    const issue = (text: string, paths: string[]): SrdSourceAuditIssue => ({
      domain: 'creature-equipment',
      id: creature.id,
      label: creature.label,
      issue: text,
      paths
    })
    const missing = loadout.filter((entry) => !equipmentById.has(entry.equipmentId))
    const resolved = loadout.flatMap((entry) => {
      const item = equipmentById.get(entry.equipmentId)
      return item ? [{ entry, item }] : []
    })
    const conflicts = resolveHandOccupancy(
      resolved.map(({ entry, item }) => ({
        id: entry.id,
        slot: entry.useState,
        twoHanded: item.properties?.includes(EQUIPMENT_PROPERTY_CODE.TWO_HANDED) === true
      }))
    ).conflicts
    const misplaced = resolved.filter(
      ({ entry, item }) =>
        (isHandSlot(entry.useState) || entry.useState === 'WORN') &&
        isHandSlot(entry.useState) !== isHeldEquipmentCategory(item.category)
    )
    const armor = resolved.filter(({ item }) => item.category === EQUIPMENT_CATEGORY_CODE.ARMOR)
    const armorWithActions = armor.filter(({ entry }) => entry.actionFeatureIds.length > 0)
    const wornArmor = armor.filter(({ entry }) => entry.useState === 'WORN')

    return [
      ...(missing.length > 0
        ? [
            issue(
              'loadout binds missing Equipment',
              missing.map((entry) => entry.id)
            )
          ]
        : []),
      ...conflicts.map((conflict) =>
        issue(`loadout hand conflict: ${HAND_CONFLICT_MESSAGE[conflict.code]}`, [conflict.itemId])
      ),
      ...(misplaced.length > 0
        ? [
            issue(
              'loadout holds an item that is not a weapon or shield, or wears one that is',
              misplaced.map(({ entry }) => entry.id)
            )
          ]
        : []),
      ...(armorWithActions.length > 0
        ? [
            issue(
              'loadout armor binds an action Feature',
              armorWithActions.map(({ entry }) => entry.id)
            )
          ]
        : []),
      ...(wornArmor.length > 1
        ? [
            issue(
              'loadout wears more than one armor',
              wornArmor.map(({ entry }) => entry.id)
            )
          ]
        : [])
    ]
  })
}
