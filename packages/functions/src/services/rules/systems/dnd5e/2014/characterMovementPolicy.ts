const movementModifier =
  '(group.valueDomainCode == "SPEED" and (group.modifierKind == "BONUS" or group.modifierKind == "PENALTY") and grantFold.modifiers[group.contributions[0].acceptedModifierIndex].grant.domain.speedId == speed.speedId)'

export const dnd5e2014CharacterMovementPolicyExpressions = [
  {
    id: 'movement-records',
    key: 'movementRecords',
    value: `movementFacts == null ? [] : map(movementFacts.speeds as speed, { speedId: speed.speedId, code: speed.code, amount: speed.override == null ? speed.baseAmount + sum(map(filter($.resolvedModifierGroups as group, ${movementModifier}), #.effective)) : speed.override.value, unit: speed.unit, calculation: { base: speed.baseAmount, effective: speed.override == null ? speed.baseAmount + sum(map(filter($.resolvedModifierGroups as group, ${movementModifier}), #.effective)) : speed.override.value, contributions: flatten(map(filter($.resolvedModifierGroups as group, ${movementModifier}) as group, map(group.contributions as contribution, { sourceId: contribution.sourceId, source: contribution.source, value: contribution.value, state: speed.override == null ? contribution.state : "SUPPRESSED", reasonCode: speed.override == null ? contribution.reasonCode : "SUPPRESSED_BY_OVERRIDE" }))), override: speed.override == null ? null : { sourceId: speed.override.sourceId, source: { kind: "MANUAL_ADJUSTMENT", adjustmentId: speed.override.sourceId }, value: speed.override.value } } })`
  },
  {
    id: 'primary-movement-speed',
    key: 'primaryMovementSpeedId',
    value:
      'movementFacts == null ? null : movementFacts.preference.mode == "EXPLICIT" and some($.movementRecords, #.speedId == movementFacts.preference.speedId) ? movementFacts.preference.speedId : (len(filter($.movementRecords as speed, speed.code == "WALK")) == 0 ? (len($.movementRecords) == 0 ? null : $.movementRecords[0].speedId) : filter($.movementRecords as speed, speed.code == "WALK")[0].speedId)'
  }
]

export const dnd5e2014CharacterMovementPolicyOutputExpression = {
  id: 'movement',
  key: 'movement',
  value:
    '{ speeds: movementRecords == null ? [] : map(movementRecords as speed, { speedId: speed.speedId, amount: speed.amount, unit: speed.unit, calculation: speed.calculation }), primaryMovementSpeedId: primaryMovementSpeedId }'
}
