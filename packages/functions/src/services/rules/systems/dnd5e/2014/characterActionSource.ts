import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'

export const DND5E2014_CHARACTER_ACTION_SOURCE = String.raw`/** @type {Handler} */
export const handler = async (input) => {
  const abilityAliases = {
    STR: 'STRENGTH',
    STRENGTH: 'STRENGTH',
    DEX: 'DEXTERITY',
    DEXTERITY: 'DEXTERITY',
    CON: 'CONSTITUTION',
    CONSTITUTION: 'CONSTITUTION',
    INT: 'INTELLIGENCE',
    INTELLIGENCE: 'INTELLIGENCE',
    WIS: 'WISDOM',
    WISDOM: 'WISDOM',
    CHA: 'CHARISMA',
    CHARISMA: 'CHARISMA'
  };

  const clamp = (value, minimum, maximum) =>
    Math.min(Math.max(value, minimum == null ? Number.NEGATIVE_INFINITY : minimum), maximum == null ? Number.POSITIVE_INFINITY : maximum);
  const formatNumber = (value) => Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
  const titleCase = (value) => value.toLowerCase().split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  const formatExpression = (value, bonus) => {
    const base = typeof value === 'number' ? formatNumber(value) : value;
    if (bonus === 0) return base;
    return bonus > 0 ? base + ' + ' + formatNumber(bonus) : base + ' - ' + formatNumber(-bonus);
  };
  const applyDamageAmountMetadata = (expression, amountKind, multiplier) => {
    const multiplied = multiplier != null && multiplier !== 1 ? formatNumber(multiplier) + ' × ' + expression : expression;
    if (amountKind === 'HALF') return 'half of ' + multiplied;
    if (amountKind === 'DOUBLE') return 'double ' + multiplied;
    return multiplied;
  };
  const canonicalAbility = (value) => abilityAliases[value] || null;
  const abilityFromDefinitionId = (abilityDefinitionId) => {
    const matches = input.abilityDefinitions.filter((definition) => definition.id === abilityDefinitionId);
    if (matches.length !== 1) return null;
    return canonicalAbility(matches[0].code);
  };
  const abilityModifier = (value, spellcasting = input.spellcasting) => {
    if (value === 'SPELLCASTING') {
      if (spellcasting == null || spellcasting.attackBonus == null) return null;
      return spellcasting.attackBonus - input.proficiencyBonus;
    }
    const canonical = canonicalAbility(value);
    if (canonical == null) return null;
    const match = input.abilities.find((ability) => canonicalAbility(ability.abilityId) === canonical);
    return match == null ? null : match.modifier;
  };
  const skillTotal = (skillId) => {
    const match = input.skills.find((skill) => skill.skillId === skillId);
    return match == null ? null : match.total;
  };
  const proficiencyMultiplier = (scaling) => scaling === 'DOUBLE' ? 2 : scaling === 'FULL' ? 1 : 0.5;
  const attackProficiencyMultiplier = (candidate, attackDomain) => {
    if (attackDomain === 'UNARMED') return 1;
    if (candidate.equipment == null || candidate.equipment.equipmentId == null) return 0;
    const matching = input.proficiencies.filter((proficiency) =>
      (proficiency.kind === 'EQUIPMENT' && proficiency.subjectId === candidate.equipment.equipmentId) ||
      (proficiency.kind === 'EQUIPMENT_PROPERTY' &&
        (proficiency.category == null || proficiency.category === candidate.equipment.category) &&
        (candidate.equipment.properties || []).includes(proficiency.subjectId))
    );
    return matching.reduce((maximum, proficiency) => Math.max(maximum, proficiencyMultiplier(proficiency.scaling)), 0);
  };
  const sourceModifierValues = (candidate, attackDomain, modifierKinds) => {
    const domainKeys = modifierKinds.map((modifierKind) =>
      'ATTACK_ROLL:' + modifierKind + '|attackDomain=' + attackDomain
    );
    return input.modifierGroups
      .filter((group) => domainKeys.includes(group.domainKey))
      .flatMap((group) => group.contributions)
      .filter((contribution) => contribution.sourceId === candidate.sourceId && contribution.state === 'APPLIED')
      .map((contribution) => contribution.value);
  };
  const sourceModifierTotal = (candidate, attackDomain, modifierKinds) =>
    sourceModifierValues(candidate, attackDomain, modifierKinds).reduce((sum, value) => sum + value, 0);
  const itemAttackAdjustment = (candidate) => candidate.equipment == null
    ? null
    : input.itemAttackAdjustments.find((adjustment) => adjustment.itemInstanceId === candidate.equipment.itemInstanceId) || null;
  const resolveAttackBonus = (candidate, attackDomain, spellcasting) => {
    if (attackDomain == null) return null;
    if (attackDomain === 'SPELL') return spellcasting == null ? null : spellcasting.attackBonus;
    const abilityValues = sourceModifierValues(candidate, attackDomain, ['ABILITY_MODIFIER_BONUS', 'OPTIONAL_ABILITY_MODIFIER_BONUS']);
    if (abilityValues.length === 0) return null;
    const abilityBonus = abilityValues.reduce((sum, value) => sum + value, 0);
    const adjustment = itemAttackAdjustment(candidate);
    if (adjustment != null && adjustment.override != null) return adjustment.override;
    const proficiency = Math.floor(input.proficiencyBonus * attackProficiencyMultiplier(candidate, attackDomain));
    const sourceBonus = sourceModifierTotal(candidate, attackDomain, ['BONUS', 'PENALTY']);
    return abilityBonus + proficiency + sourceBonus + (adjustment == null ? 0 : adjustment.bonus);
  };
  const classLevel = (classId) => {
    const match = input.classLevels.find((entry) => entry.classId === classId);
    return match == null ? null : match.level;
  };
  const targetLevel = (source, classId, spellCastLevel) => {
    if (source === 'CHARACTER_LEVEL') return input.totalLevel;
    if (source === 'CLASS_LEVEL') return classId == null ? null : classLevel(classId);
    if (source === 'SPELL_CAST_LEVEL') return spellCastLevel;
    return null;
  };
  const selectValue = (values, level) => {
    if (values.length === 0) return null;
    const ordered = [...values].sort((left, right) => (left.level == null ? 0 : left.level) - (right.level == null ? 0 : right.level) || left.order - right.order);
    if (level == null) return ordered[0];
    const eligible = ordered.filter((entry) => entry.level != null && entry.level <= level);
    return eligible.length === 0 ? ordered[0] : eligible[eligible.length - 1];
  };
  const resolveDamageBonus = (bonus, spellcasting) => {
    let value = null;
    if (bonus.bonusKind === 'ABILITY_BONUS') value = abilityModifier(bonus.ability, spellcasting);
    if (bonus.bonusKind === 'SKILL_BONUS') value = skillTotal(bonus.skillId);
    if (bonus.bonusKind === 'PROFICIENCY_BONUS') value = input.proficiencyBonus;
    return value == null ? 0 : clamp(value * (bonus.multiplier == null ? 1 : bonus.multiplier), bonus.min, bonus.max);
  };
  const resolveDamageValue = (outcome, level) => {
    const selected = selectValue(outcome.values, level);
    if (selected == null) return null;
    if (outcome.valueKind === 'DICE') return selected.dice;
    if (outcome.valueKind === 'POOL' && outcome.scalingKind !== 'NONE' && level != null) {
      return clamp((selected.amount == null ? 0 : selected.amount) + level * (selected.multiplier == null ? 1 : selected.multiplier), selected.minimum, selected.maximum);
    }
    return selected.amount;
  };
  const resolveDamage = (outcome, context) => {
    const level = outcome.scalingKind === 'NONE' ? null : targetLevel(outcome.scalingSource, outcome.classId, context.spellCastLevel);
    const value = resolveDamageValue(outcome, level);
    if (value == null) return { kind: 'EFFECT', pathCode: outcome.pathCode, effectKind: 'DAMAGE', label: outcome.label };
    const bonus = outcome.bonuses.reduce((sum, entry) => sum + resolveDamageBonus(entry, context.spellcasting), context.spellDamageBonus);
    const expression = applyDamageAmountMetadata(formatExpression(value, bonus), outcome.amountKind, outcome.amountMultiplier);
    const scaling = outcome.scalingSource === 'SPELL_CAST_LEVEL' && context.spellCastLevel == null
      ? outcome.values.filter((entry) => entry.level != null).map((entry) => ({
          level: entry.level,
          expression: applyDamageAmountMetadata(formatExpression(resolveDamageValue(outcome, entry.level), bonus), outcome.amountKind, outcome.amountMultiplier)
        }))
      : [];
    return { kind: 'DAMAGE', pathCode: outcome.pathCode, expression, damageTypeId: outcome.damageTypeId, scaling };
  };
  const resolveHealBonus = (bonus, spellcasting) => {
    let value = null;
    if (bonus.bonusKind === 'ABILITY_BONUS') value = abilityModifier(bonus.ability, spellcasting);
    if (bonus.bonusKind === 'PROFICIENCY_BONUS') value = input.proficiencyBonus;
    if (bonus.bonusKind === 'CLASS_LEVEL') value = classLevel(bonus.classId);
    return value == null ? 0 : clamp(value * (bonus.multiplier == null ? 1 : bonus.multiplier), bonus.min, bonus.max);
  };
  const resolveHealValue = (outcome, level) => {
    const selected = selectValue(outcome.values, level);
    if (selected == null) return null;
    if (outcome.valueKind === 'DICE') return selected.dice;
    if (outcome.valueKind === 'POOL' && outcome.scalingKind !== 'NONE' && level != null) {
      return clamp((selected.amount == null ? 0 : selected.amount) + level * (selected.multiplier == null ? 1 : selected.multiplier), selected.minimum, selected.maximum);
    }
    return selected.amount;
  };
  const resolveHeal = (outcome, context) => {
    const level = outcome.scalingKind === 'NONE' ? null : targetLevel(outcome.scalingSource, outcome.classId, context.spellCastLevel);
    const value = resolveHealValue(outcome, level);
    if (value == null) return { kind: 'EFFECT', pathCode: outcome.pathCode, effectKind: 'HEAL', label: 'Healing effect' };
    const bonus = outcome.bonuses.reduce((sum, entry) => sum + resolveHealBonus(entry, context.spellcasting), 0);
    const scaling = outcome.scalingKind !== 'NONE' && outcome.scalingSource === 'SPELL_CAST_LEVEL' && context.spellCastLevel == null
      ? outcome.values.filter((entry) => entry.level != null).map((entry) => ({ level: entry.level, expression: formatExpression(resolveHealValue(outcome, entry.level), bonus) }))
      : [];
    return { kind: 'HEAL', pathCode: outcome.pathCode, expression: formatExpression(value, bonus), temporary: outcome.temporary, scaling };
  };
  const resolveSave = (savingThrow, spellcasting) => {
    if (savingThrow == null) return null;
    const ability = abilityFromDefinitionId(savingThrow.abilityDefinitionId);
    if (ability == null) return null;
    if (savingThrow.dcMethod === 'SOURCE_SAVE_DC') {
      return { ability, dc: spellcasting == null ? null : spellcasting.saveDc };
    }
    if (savingThrow.dcMethod === 'FIXED_DC') return { ability, dc: savingThrow.baseDc };
    const bonuses = savingThrow.bonuses.map((bonus) => {
      if (bonus.bonusKind === 'STATIC_BONUS') return bonus.amount;
      if (bonus.bonusKind === 'PROFICIENCY_BONUS') return input.proficiencyBonus;
      const bonusAbility = abilityFromDefinitionId(bonus.abilityDefinitionId);
      return bonusAbility == null ? null : abilityModifier(bonusAbility, spellcasting);
    });
    return bonuses.some((bonus) => bonus == null)
      ? { ability, dc: null }
      : { ability, dc: savingThrow.baseDc + bonuses.reduce((sum, bonus) => sum + bonus, 0) };
  };
  const rangeLabel = (range) => {
    if (range.rangeKind !== 'DISTANCE') return titleCase(range.rangeKind);
    if (range.amount == null || range.unit == null) return titleCase(range.rangeKind);
    const unit = range.unit === 'FEET' || range.unit === 'FOOT' ? 'ft' : range.unit === 'MILES' || range.unit === 'MILE' ? 'mi' : range.unit === 'METERS' || range.unit === 'METER' ? 'm' : titleCase(range.unit);
    return formatNumber(range.amount) + ' ' + unit;
  };
  const resolveMechanic = (candidate, context) => {
    const facts = candidate.mechanicFacts;
    const invocation = facts.invocation;
    const attackDomain = invocation.triggerCode === 'MELEE_WEAPON_ATTACK' ? 'MELEE' : invocation.triggerCode === 'RANGED_WEAPON_ATTACK' ? 'RANGED' : invocation.triggerCode === 'UNARMED_ATTACK' ? 'UNARMED' : invocation.triggerCode === 'SPELL_ATTACK' ? 'SPELL' : null;
    return {
      effectId: candidate.effectId,
      trigger: invocation.triggerCode,
      activation: invocation.activation != null && invocation.activation.amount != null && Number.isInteger(invocation.activation.amount) && invocation.activation.amount > 0 ? { kind: invocation.activation.code, amount: invocation.activation.amount } : null,
      rangeLabel: rangeLabel(invocation.range),
      attackBonus: resolveAttackBonus(candidate, attackDomain, context.spellcasting),
      attackRollMode: attackDomain == null ? null : input.attackRollModes[attackDomain],
      save: resolveSave(invocation.savingThrow, context.spellcasting),
      outcomes: facts.outcomes.map((outcome) => outcome.kind === 'DAMAGE' ? resolveDamage(outcome, context) : outcome.kind === 'HEAL' ? resolveHeal(outcome, context) : outcome.kind === 'CONDITION' ? outcome : outcome)
    };
  };

  const actionDecisions = input.candidates.map((candidate) => {
    const sourceAvailable = candidate.activationSourceKind === 'ACTIVE_EQUIPMENT'
      ? candidate.equipment != null && input.activeEquipmentInstanceIds.includes(candidate.equipment.itemInstanceId)
      : input.activeSourceIds.includes(candidate.sourceId);
    const resource = candidate.resourceUse == null || candidate.resourceUse.poolId == null
      ? null
      : input.resources.find((pool) => pool.poolId === candidate.resourceUse.poolId);
    const resourceAvailable = candidate.resourceUse == null || (resource != null && resource.state === 'RESOLVED' && resource.remaining >= candidate.resourceUse.cost);
    let reasonCode = null;
    if (!sourceAvailable) {
      reasonCode = candidate.equipment != null && candidate.equipment.requiresEquipped && !candidate.equipment.equipped
        ? 'SOURCE_NOT_EQUIPPED'
        : candidate.equipment != null && (candidate.equipment.requiresAttunement || candidate.equipment.requiresAttuned) && !candidate.equipment.attuned
          ? 'SOURCE_NOT_ATTUNED'
          : 'SOURCE_REQUIREMENTS_NOT_MET';
    } else if (candidate.resourceUse != null && (candidate.resourceUse.poolId == null || resource == null || resource.state !== 'RESOLVED')) {
      reasonCode = 'RESOURCE_MISSING';
    } else if (!resourceAvailable) {
      reasonCode = 'INSUFFICIENT_RESOURCE';
    }
    const boundResource = sourceAvailable && candidate.resourceUse != null && resource != null && resource.state === 'RESOLVED';
    return {
      sequence: candidate.sequence,
      actionId: candidate.actionId,
      effectId: candidate.effectId,
      sourceId: candidate.sourceId,
      source: candidate.source,
      mechanicsOwner: candidate.mechanicsOwner,
      status: reasonCode == null ? 'AVAILABLE' : 'UNAVAILABLE',
      reasonCode,
      resourcePoolId: boundResource ? resource.poolId : null,
      resourceCost: boundResource ? candidate.resourceUse.cost : null,
      mechanic: resolveMechanic(candidate, { spellcasting: input.spellcasting, spellCastLevel: null, spellDamageBonus: 0 })
    };
  });

  const spellCastMechanics = input.spellCandidates.map((candidate) => {
    const spell = input.spellEffects.find((entry) => entry.spellId === candidate.spellId);
    const sourceMechanics = input.spellMechanics.find((entry) =>
      entry.source.spellId === candidate.source.spellId &&
      entry.source.sourceKind === candidate.source.sourceKind &&
      entry.source.sourceInstanceId === candidate.source.sourceInstanceId
    );
    const spellcasting = sourceMechanics == null
      ? null
      : { attackBonus: sourceMechanics.attackBonus, saveDc: sourceMechanics.saveDc };
    return {
      sequence: candidate.sequence,
      candidateId: candidate.candidateId,
      spellId: candidate.spellId,
      source: candidate.source,
      castLevel: candidate.castLevel,
      mechanics: (spell == null ? [] : spell.effects).map((effect) => resolveMechanic(effect, {
        spellcasting,
        spellCastLevel: candidate.castLevel,
        spellDamageBonus: sourceMechanics == null ? 0 : sourceMechanics.damageBonus
      }))
    };
  });

  const spellReferenceMechanics = input.spellEffects.map((spell, sequence) => ({
    sequence,
    spellId: spell.spellId,
    mechanics: spell.effects.map((effect) => resolveMechanic(effect, {
      spellcasting: input.spellcasting,
      spellCastLevel: null,
      spellDamageBonus: 0
    }))
  }));

  const spellCastDecisions = input.spellCandidates.map((candidate) => {
    const eligibleSlots = input.spellSlots.filter((slot) =>
      slot.max > 0 && (candidate.baseEntry ? slot.level >= candidate.castLevel : slot.level === candidate.castLevel)
    );
    const availableSlots = eligibleSlots.filter((slot) => slot.remaining > 0);
    const selectedSlot = (availableSlots.length > 0 ? availableSlots : eligibleSlots)
      .reduce((selected, slot) => selected == null || slot.level < selected.level ? slot : selected, null);
    const resource = candidate.resourceOwnerKey == null
      ? null
      : input.resources.find((pool) => pool.poolId === candidate.resourceOwnerKey && pool.state === 'RESOLVED');
    const resourceRemaining = resource == null ? null : resource.remaining;
    let status = 'UNAVAILABLE';
    let reasonCode = 'NO_ELIGIBLE_SPELL_SLOT';
    if (candidate.spellLevel === 0) {
      status = 'AVAILABLE';
      reasonCode = 'CANTRIP';
    } else if (candidate.castMode === 'AT_WILL') {
      status = 'AVAILABLE';
      reasonCode = 'AT_WILL';
    } else if (candidate.castMode === 'RITUAL') {
      status = 'AVAILABLE';
      reasonCode = 'RITUAL';
    } else if (candidate.castMode === 'FIXED_LEVEL' && candidate.resourceOwnerKey == null) {
      status = 'AVAILABLE';
      reasonCode = 'FIXED_LEVEL_WITHOUT_RESOURCE';
    } else if (candidate.castMode === 'LIMITED_USE' && candidate.resourceOwnerKey == null) {
      reasonCode = 'RESOURCE_OWNER_MISSING';
    } else if (candidate.castMode === 'LIMITED_USE' || candidate.castMode === 'FIXED_LEVEL') {
      if (resourceRemaining != null && resourceRemaining > 0) {
        status = 'AVAILABLE';
        reasonCode = 'RESOURCE_REMAINING';
      } else {
        reasonCode = 'RESOURCE_EXHAUSTED';
      }
    } else if (selectedSlot == null) {
      reasonCode = 'NO_ELIGIBLE_SPELL_SLOT';
    } else if (selectedSlot.remaining > 0) {
      status = 'AVAILABLE';
      reasonCode = 'SPELL_SLOT_REMAINING';
    } else {
      reasonCode = 'SPELL_SLOT_EXHAUSTED';
    }
    return {
      candidateId: candidate.candidateId,
      status,
      reasonCode,
      slotKey: candidate.spellLevel > 0 && candidate.castMode === 'SPELL_SLOT' && selectedSlot != null
        ? selectedSlot.slotKey
        : null
    };
  });

  return { actionDecisions, spellCastMechanics, spellReferenceMechanics, spellCastDecisions };
};`

export const dnd5e2014CharacterActionModel: RulePackDocumentDto['models'][string] = {
  contentType: 'application/vnd.gorules.decision',
  nodes: [
    {
      id: 'input',
      type: 'inputNode',
      name: 'Character action facts',
      position: { x: 0, y: 0 },
      content: { schema: '' }
    },
    {
      id: 'character-action-function',
      type: 'functionNode',
      name: 'Character action resolution',
      position: { x: 180, y: 0 },
      content: { source: DND5E2014_CHARACTER_ACTION_SOURCE }
    },
    {
      id: 'output',
      type: 'outputNode',
      name: 'Resolved Character actions',
      position: { x: 360, y: 0 },
      content: { schema: '' }
    }
  ],
  edges: [
    {
      id: 'input-character-action-function',
      sourceId: 'input',
      targetId: 'character-action-function'
    },
    {
      id: 'character-action-function-output',
      sourceId: 'character-action-function',
      targetId: 'output'
    }
  ]
}
