export const dnd5e2014CharacterActionPolicyInputExpression = {
  id: 'action-policy-input',
  key: 'resolvedActionInput',
  value:
    '{ candidates: actionCandidates == null ? [] : actionCandidates, spellCandidates: spellCastCandidates, spellSlots: merge([map(spellSlots.maxByLevel as slot, { slotKey: slot.spellLevel == 1 ? "STANDARD:1" : slot.spellLevel == 2 ? "STANDARD:2" : slot.spellLevel == 3 ? "STANDARD:3" : slot.spellLevel == 4 ? "STANDARD:4" : slot.spellLevel == 5 ? "STANDARD:5" : slot.spellLevel == 6 ? "STANDARD:6" : slot.spellLevel == 7 ? "STANDARD:7" : slot.spellLevel == 8 ? "STANDARD:8" : "STANDARD:9", label: slot.spellLevel == 1 ? "STANDARD:1" : slot.spellLevel == 2 ? "STANDARD:2" : slot.spellLevel == 3 ? "STANDARD:3" : slot.spellLevel == 4 ? "STANDARD:4" : slot.spellLevel == 5 ? "STANDARD:5" : slot.spellLevel == 6 ? "STANDARD:6" : slot.spellLevel == 7 ? "STANDARD:7" : slot.spellLevel == 8 ? "STANDARD:8" : "STANDARD:9", level: slot.spellLevel, max: slot.slotCount, remaining: slot.remaining }), spellSlots.pactMagic == null ? [] : [{ slotKey: "PACT", label: "PACT", level: spellSlots.pactMagic.level, max: spellSlots.pactMagic.slots, remaining: spellSlots.pactMagic.remaining }]]), spellEffects: spellActionFacts == null ? [] : spellActionFacts, spellMechanics: map(spellMechanics as mechanics, { source: mechanics.source, attackBonus: mechanics.attackBonus == null ? null : mechanics.attackBonus.effective, saveDc: mechanics.saveDC == null ? null : mechanics.saveDC.effective, damageBonus: mechanics.damageBonus.effective }), activeSourceIds: grantFold.activeSourceIds, activeEquipmentInstanceIds: grantFold.activeEquipmentInstanceIds, resources: resolvedResourcePools, totalLevel: totalLevel, classLevels: map(grantFoldFacts.base.classes as entry, { classId: entry.classId, level: entry.level }), proficiencyBonus: derivedProficiencyBonusCalculation.effective, abilities: map(resolvedDerivedAbilities as ability, { abilityId: ability.abilityId, modifier: ability.modifier.effective }), skills: map(resolvedDerivedSkills as skill, { skillId: skill.skillId, total: skill.total.effective }), spellcasting: derivedSpellcasting == null ? null : { saveDc: derivedSpellcasting.saveDc.effective, attackBonus: derivedSpellcasting.attackBonus.effective }, attackRollModes: rollModes.attacks }'
}

export const dnd5e2014CharacterActionPolicyOutputExpression = {
  id: 'actions',
  key: 'actionDecisions',
  value: 'resolvedActionPolicy.actionDecisions'
}

export const dnd5e2014CharacterSpellActionPolicyOutputExpression = {
  id: 'spell-cast-mechanics',
  key: 'spellCastMechanics',
  value: 'resolvedActionPolicy.spellCastMechanics'
}

export const dnd5e2014CharacterSpellReferencePolicyOutputExpression = {
  id: 'spell-reference-mechanics',
  key: 'spellReferenceMechanics',
  value: 'resolvedActionPolicy.spellReferenceMechanics'
}

export const dnd5e2014CharacterSpellCastDecisionPolicyOutputExpression = {
  id: 'spell-cast-decisions',
  key: 'spellCastDecisions',
  value: 'resolvedActionPolicy.spellCastDecisions'
}
