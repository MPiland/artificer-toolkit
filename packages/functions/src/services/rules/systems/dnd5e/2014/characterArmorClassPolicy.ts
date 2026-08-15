const armorClassGroups =
  'filter($.resolvedModifierGroups as group, group.valueDomainCode == "ARMOR_CLASS")'
const armorClassContributions =
  'flatten(map(filter($.armorClassModifierGroups, #.modifierKind != "SET_VALUE") as group, group.contributions))'

export const dnd5e2014CharacterArmorClassPolicyExpressions = [
  {
    id: 'active-armor-equipment',
    key: 'activeArmorEquipment',
    value:
      'armorClassFacts == null ? [] : filter(armorClassFacts.equipment as item, some(grantFold.activeEquipmentInstanceIds, # == item.itemInstanceId))'
  },
  {
    id: 'active-armor-records',
    key: 'activeArmorRecords',
    value: 'filter($.activeArmorEquipment, #.category == "ARMOR")'
  },
  {
    id: 'active-shield-records',
    key: 'activeShieldRecords',
    value: 'filter($.activeArmorEquipment, #.category == "SHIELD")'
  },
  {
    id: 'armor-authored-dexterity-modifier',
    key: 'armorAuthoredDexterityModifier',
    value:
      'armorClassFacts == null or armorClassFacts.dexterityAbilityIndex == null or armorClassFacts.dexterityAbilityIndex >= len($.resolvedAbilityRecords) ? 0 : floor((derivedBaseFacts.abilities[armorClassFacts.dexterityAbilityIndex].baseScore + sum(map(filter($.resolvedAbilityRecords[armorClassFacts.dexterityAbilityIndex].resolvedBonuses as bonus, bonus.source.kind != "MANUAL_ADJUSTMENT" and bonus.state == "APPLIED"), #.value)) - 10) / 2)'
  },
  {
    id: 'armor-effective-dexterity-modifier',
    key: 'armorEffectiveDexterityModifier',
    value:
      'armorClassFacts == null or armorClassFacts.dexterityAbilityIndex == null or armorClassFacts.dexterityAbilityIndex >= len($.resolvedDerivedAbilities) ? 0 : $.resolvedDerivedAbilities[armorClassFacts.dexterityAbilityIndex].modifier.effective'
  },
  {
    id: 'armor-base',
    key: 'armorClassBase',
    value:
      'len($.activeArmorRecords) == 0 ? 10 + $.armorAuthoredDexterityModifier + ($.armorEffectiveDexterityModifier - $.armorAuthoredDexterityModifier) : ($.activeArmorRecords[len($.activeArmorRecords) - 1].armorClass == null ? 10 : $.activeArmorRecords[len($.activeArmorRecords) - 1].armorClass)'
  },
  {
    id: 'shield-bonus',
    key: 'shieldArmorClassBonus',
    value:
      'len($.activeShieldRecords) == 0 ? 0 : ($.activeShieldRecords[len($.activeShieldRecords) - 1].armorClass == null ? 2 : $.activeShieldRecords[len($.activeShieldRecords) - 1].armorClass)'
  },
  {
    id: 'armor-class-modifier-groups',
    key: 'armorClassModifierGroups',
    value: armorClassGroups
  },
  {
    id: 'armor-class-calculation',
    key: 'armorClassCalculation',
    value: `{ base: $.armorClassBase + $.shieldArmorClassBonus, effective: $.armorClassBase + $.shieldArmorClassBonus + sum(map($.armorClassModifierGroups, #.effective)), contributions: map(${armorClassContributions} as contribution, { sourceId: contribution.sourceId, source: contribution.source, value: contribution.value, state: contribution.state, reasonCode: contribution.reasonCode }), override: null }`
  }
]

export const dnd5e2014CharacterArmorClassPolicyOutputExpression = {
  id: 'armor-class',
  key: 'armorClass',
  value: 'armorClassCalculation'
}
