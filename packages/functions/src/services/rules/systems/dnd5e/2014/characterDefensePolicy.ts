const sameDefense = (left: string, right: string) =>
  `${left}.kind == ${right}.kind and ${left}.damageTypeId == ${right}.damageTypeId`

const validDefenseModifier =
  '(candidate.modifier.modifierKind == "ADD_OPTION" or candidate.modifier.modifierKind == "REMOVE_OPTION") and candidate.modifier.grant.payload.damageTypeId != null and type(candidate.modifier.grant.payload.damageTypeId) == "string" and trim(candidate.modifier.grant.payload.damageTypeId) != "" and (candidate.modifier.grant.valueDomainCode == "DAMAGE_RESISTANCE" or candidate.modifier.grant.valueDomainCode == "DAMAGE_IMMUNITY" or candidate.modifier.grant.valueDomainCode == "DAMAGE_VULNERABILITY")'

const defenseKind =
  'candidate.modifier.grant.valueDomainCode == "DAMAGE_RESISTANCE" ? "RESISTANCE" : candidate.modifier.grant.valueDomainCode == "DAMAGE_IMMUNITY" ? "IMMUNITY" : "VULNERABILITY"'

const selectedAuthoredDefense = (operation: string) =>
  `(filter($.defenseModifierOperations as candidate, ${sameDefense('candidate', operation)} and candidate.operation == "ADD_OPTION" and candidate.acceptedModifierIndex >= ${operation}.acceptedModifierIndex)[len(filter($.defenseModifierOperations as candidate, ${sameDefense('candidate', operation)} and candidate.operation == "ADD_OPTION" and candidate.acceptedModifierIndex >= ${operation}.acceptedModifierIndex)) - 1])`

export const dnd5e2014CharacterDefensePolicyExpressions = [
  {
    id: 'defense-modifier-operations',
    key: 'defenseModifierOperations',
    value: `map(filter(map(keys(grantFold.modifiers) as acceptedModifierIndex, { acceptedModifierIndex: acceptedModifierIndex, modifier: grantFold.modifiers[acceptedModifierIndex] }) as candidate, ${validDefenseModifier}) as candidate, { acceptedModifierIndex: candidate.acceptedModifierIndex, operation: candidate.modifier.modifierKind, kind: ${defenseKind}, damageTypeId: candidate.modifier.grant.payload.damageTypeId, source: candidate.modifier.source })`
  },
  {
    id: 'resolved-authored-defenses',
    key: 'resolvedAuthoredDefenses',
    value: `map(filter($.defenseModifierOperations as operation, operation.operation == "ADD_OPTION" and !some($.defenseModifierOperations as laterRemoval, ${sameDefense('laterRemoval', 'operation')} and laterRemoval.operation == "REMOVE_OPTION" and laterRemoval.acceptedModifierIndex > operation.acceptedModifierIndex) and !some($.defenseModifierOperations as earlierAdd, ${sameDefense('earlierAdd', 'operation')} and earlierAdd.operation == "ADD_OPTION" and earlierAdd.acceptedModifierIndex < operation.acceptedModifierIndex and !some($.defenseModifierOperations as interveningRemoval, ${sameDefense('interveningRemoval', 'operation')} and interveningRemoval.operation == "REMOVE_OPTION" and interveningRemoval.acceptedModifierIndex > earlierAdd.acceptedModifierIndex and interveningRemoval.acceptedModifierIndex < operation.acceptedModifierIndex))) as operation, { kind: operation.kind, damageTypeId: operation.damageTypeId, source: ${selectedAuthoredDefense('operation')}.source })`
  },
  {
    id: 'defense-manual-additions',
    key: 'defenseManualAdditions',
    value:
      'defenseFacts == null ? [] : map(keys(defenseFacts.manualAdditions) as sequence, merge([defenseFacts.manualAdditions[sequence], { sequence: sequence }]))'
  },
  {
    id: 'defenses',
    key: 'defenses',
    value: `merge([map($.resolvedAuthoredDefenses as defense, { kind: defense.kind, damageTypeId: defense.damageTypeId, source: len(filter($.defenseManualAdditions as manual, ${sameDefense('manual', 'defense')})) == 0 ? defense.source : filter($.defenseManualAdditions as manual, ${sameDefense('manual', 'defense')})[len(filter($.defenseManualAdditions as manual, ${sameDefense('manual', 'defense')})) - 1].source }), map(filter($.defenseManualAdditions as manual, !some($.resolvedAuthoredDefenses as defense, ${sameDefense('defense', 'manual')}) and !some($.defenseManualAdditions as earlier, ${sameDefense('earlier', 'manual')} and earlier.sequence < manual.sequence)) as manual, { kind: manual.kind, damageTypeId: manual.damageTypeId, source: filter($.defenseManualAdditions as candidate, ${sameDefense('candidate', 'manual')})[len(filter($.defenseManualAdditions as candidate, ${sameDefense('candidate', 'manual')})) - 1].source })])`
  }
]

export const dnd5e2014CharacterDefensePolicyOutputExpression = {
  id: 'defenses',
  key: 'defenses',
  value: 'defenses'
}
