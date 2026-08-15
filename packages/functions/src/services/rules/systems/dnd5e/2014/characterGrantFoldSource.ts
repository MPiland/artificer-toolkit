import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'
import {
  type CharacterGrantFoldInput,
  type CharacterGrantFoldOutput
} from '@artificer-toolkit/schema/api/characterGrantFoldRules'

export const DND5E2014_CHARACTER_GRANT_FOLD_SOURCE = String.raw`/** @type {Handler} */
export const handler = async (input) => {
  const sourceOrder = [
    'RACE',
    'SUBRACE',
    'ANCESTRY',
    'BACKGROUND',
    'CLASS',
    'SUBCLASS',
    'FEAT',
    'FEATURE',
    'OPTION',
    'EQUIPMENT',
    'MANUAL'
  ];
  const proficiencyRank = { HALF: 0, FULL: 1, DOUBLE: 2 };
  const acc = {
    proficiencies: [],
    senses: [],
    modifiers: [],
    unlockedFeatIds: [],
    unlockedSpellIds: [],
    activeSourceIds: [],
    activeEquipmentInstanceIds: [],
    equipmentFeatureChargeUses: [],
    modifierGroups: []
  };
  const modifierGroups = new Map();
  const activeSourceIds = new Set();
  const scheduled = [];
  let position = 0;

  const someSelected = (required, actual) =>
    required.length === 0 || required.some((value) => actual.includes(value));
  const inRange = (value, minimum, maximum) =>
    (minimum == null || value >= minimum) && (maximum == null || value <= maximum);
  const abilityValue = (abilityId) => {
    const aliases = {
      STRENGTH: ['STRENGTH', 'STR'],
      DEXTERITY: ['DEXTERITY', 'DEX'],
      CONSTITUTION: ['CONSTITUTION', 'CON'],
      INTELLIGENCE: ['INTELLIGENCE', 'INT'],
      WISDOM: ['WISDOM', 'WIS'],
      CHARISMA: ['CHARISMA', 'CHA']
    };
    for (const key of aliases[abilityId] || [abilityId]) {
      if (input.base.abilities[key] !== undefined) return input.base.abilities[key];
    }
    return 0;
  };
  const meetsProficiency = (condition) => {
    const candidates = acc.proficiencies.filter(
      (proficiency) =>
        proficiency.kind === condition.proficiencyKind &&
        (condition.category == null || proficiency.category === condition.category) &&
        (condition.minimumRank == null ||
          proficiencyRank[proficiency.scaling] >= proficiencyRank[condition.minimumRank])
    );
    if (condition.mode === 'ALL') return candidates.length > 0;
    return condition.requiredIds.some((requiredId) =>
      candidates.some(
        (proficiency) =>
          proficiency.subjectId === requiredId ||
          proficiency.matchId === requiredId ||
          proficiency.subjectId === '*'
      )
    );
  };
  const equipmentMatches = (condition) =>
    input.base.equipment.some(
      (item) =>
        item.equipped &&
        (condition.mode === 'ALL' || condition.requiredIds.includes(item.equipmentId)) &&
        (condition.category == null || item.category === condition.category) &&
        condition.requiredProperties.every((property) => item.properties.includes(property))
    );
  const conditionMatches = (condition, sourceState) => {
    switch (condition.kind) {
      case 'ABILITY_SCORE':
        return inRange(abilityValue(condition.abilityId), condition.min, condition.max);
      case 'HERITAGE':
        return condition.mode === 'ALL'
          ? true
          : someSelected(condition.requiredIds, input.base.heritageIds);
      case 'CHARACTER_LEVEL':
        return inRange(
          input.base.classes.reduce((sum, entry) => sum + entry.level, 0),
          condition.min,
          condition.max
        );
      case 'CLASS_LEVEL':
        return input.base.classes.some(
          (entry) =>
            condition.classIds.includes(entry.classId) &&
            inRange(entry.level, condition.min, condition.max)
        );
      case 'FEAT_OBTAINED':
        return someSelected(condition.requiredIds, [
          ...input.base.featIds,
          ...acc.unlockedFeatIds
        ]);
      case 'FEATURE_OBTAINED':
        return someSelected(condition.requiredIds, input.base.featureIds);
      case 'OPTION_OBTAINED':
        return (
          someSelected(condition.requiredIds, input.base.featureIds) &&
          someSelected(condition.secondaryRequiredIds, input.base.optionIds)
        );
      case 'SPELL_OBTAINED':
        return someSelected(condition.requiredIds, [
          ...input.upstreamSpellIds,
          ...acc.unlockedSpellIds
        ]);
      case 'CAN_CAST_SPELL':
        return (
          input.base.classes.some((entry) => entry.spellcasting) ||
          input.upstreamSpellIds.length > 0 ||
          acc.unlockedSpellIds.length > 0
        );
      case 'PROFICIENCY':
        return meetsProficiency(condition);
      case 'EQUIPMENT_EQUIPPED':
        return equipmentMatches(condition);
      case 'SOURCE_STATE':
        return condition.sourceState === 'CARRIED'
          ? sourceState != null && sourceState.carried
          : condition.sourceState === 'EQUIPPED'
            ? sourceState != null && sourceState.equipped
            : sourceState != null && sourceState.attuned;
      case 'UNAVAILABLE':
        return false;
      case 'UNSUPPORTED':
        return false;
    }
    return false;
  };
  const conditionPasses = (condition, sourceState) => {
    if (condition.kind === 'UNSUPPORTED') return false;
    const matches = conditionMatches(condition, sourceState);
    return condition.constraint === 'INCLUDE' ? matches : !matches;
  };
  const facetPasses = (groups, sourceState) =>
    groups.length === 0 ||
    groups.some((group) =>
      group.conditions.every((condition) => conditionPasses(condition, sourceState))
    );
  const buildDomainKey = (modifier) => {
    const keys = Object.keys(modifier.domain)
      .filter((key) => {
        const value = modifier.domain[key];
        return value != null && value !== '';
      })
      .sort((left, right) => left.localeCompare(right));
    if (keys.length === 0) return modifier.valueDomainCode + ':' + modifier.modifierKind;
    return (
      modifier.valueDomainCode +
      ':' +
      modifier.modifierKind +
      '|' +
      keys.map((key) => key + '=' + String(modifier.domain[key])).join('|')
    );
  };
  const applyScalingTargets = (operation, activeLevel, output) => {
    if (operation.scalingKind === 'PER_LEVEL') {
      for (const level of operation.levels) {
        if (level.level <= activeLevel) output.push(...level.targetIds);
      }
      return;
    }
    output.push(...operation.targetIds);
  };
  const applyModifiers = (modifiers, sourceId, mechanicSource, sourceState) => {
    for (const modifier of modifiers) {
      if (!facetPasses(modifier.restrictions, sourceState)) continue;
      const domainKey = buildDomainKey(modifier);
      const acceptedModifierIndex = acc.modifiers.length;
      const accepted = {
        domainKey,
        modifierKind: modifier.modifierKind,
        grant: modifier.grant,
        source: mechanicSource
      };
      if (modifier.scopeSpellIds.length > 0) {
        accepted.scopeSpellIds = modifier.scopeSpellIds;
      }
      acc.modifiers.push(accepted);
      let group = modifierGroups.get(domainKey);
      if (group === undefined) {
        group = {
          domainKey,
          valueDomainCode: modifier.valueDomainCode,
          modifierKind: modifier.modifierKind,
          contributions: []
        };
        modifierGroups.set(domainKey, group);
        acc.modifierGroups.push(group);
      }
      group.contributions.push({
        acceptedModifierIndex,
        sourceId,
        grantId: modifier.grantId,
        grant: modifier.grant
      });
    }
  };
  const applySource = (source, proficiencyOverride, activeLevel) => {
    if (!facetPasses(source.restrictions, source.sourceState)) return false;
    if (!activeSourceIds.has(source.sourceId)) {
      activeSourceIds.add(source.sourceId);
      acc.activeSourceIds.push(source.sourceId);
    }

    for (const operation of proficiencyOverride || source.proficiencies) {
      for (let targetIndex = 0; targetIndex < operation.targetIds.length; targetIndex++) {
        const subjectId = operation.targetIds[targetIndex];
        const proficiency = {
          acceptedProficiencyIndex: acc.proficiencies.length,
          kind: operation.proficiencyKind,
          subjectId,
          matchId: operation.matchIds[targetIndex],
          scaling: operation.scaling,
          source: source.mechanicSource,
          grantId: operation.grantId
        };
        if (operation.category != null) proficiency.category = operation.category;
        acc.proficiencies.push(proficiency);
      }
    }

    const senseLevel =
      activeLevel == null
        ? input.base.classes.reduce((sum, entry) => sum + entry.level, 0)
        : activeLevel;
    for (const operation of source.senses) {
      const senseIds = [];
      applyScalingTargets(operation, senseLevel, senseIds);
      for (const senseCode of senseIds) {
        const sense = { acceptedSenseIndex: acc.senses.length, senseCode, grantId: operation.grantId, source: source.mechanicSource };
        if (operation.range != null) sense.range = operation.range;
        acc.senses.push(sense);
      }
    }

    applyModifiers(source.modifiers, source.sourceId, source.mechanicSource, undefined);

    const grantLevel = activeLevel == null ? 0 : activeLevel;
    for (const operation of source.feats) {
      applyScalingTargets(operation, grantLevel, acc.unlockedFeatIds);
    }
    for (const operation of source.spells) {
      applyScalingTargets(operation, grantLevel, acc.unlockedSpellIds);
    }
    return true;
  };
  const schedule = (sourceKind, apply) => {
    const rank = sourceOrder.indexOf(sourceKind);
    if (rank < 0) throw new Error('Unsupported Character grant source kind: ' + sourceKind);
    scheduled.push({ rank, position: position++, apply });
  };

  input.classes.forEach((record, classIndex) => {
    schedule('CLASS', () => {
      if (record.base != null) {
        applySource(
          record.base.source,
          classIndex > 0 && record.base.category === 'BASE'
            ? record.base.multiclassProficiencies
            : record.base.source.proficiencies,
          record.level
        );
      }
      if (
        record.subclass != null &&
        record.subclass.category === 'SUBCLASS' &&
        record.subclass.parentClassId === record.classId
      ) {
        applySource(record.subclass.source, undefined, record.level);
      }
    });
  });
  if (input.background != null) schedule('BACKGROUND', () => applySource(input.background));
  for (const feature of input.features) {
    schedule(feature.sourceKind, () => {
      const activeLevel =
        feature.sourceClassLevel ??
        feature.timingLevel ??
        Math.max(
          input.base.classes.reduce((sum, entry) => sum + entry.level, 0),
          1
        );
      if (feature.definition != null) applySource(feature.definition, undefined, activeLevel);
      for (const option of feature.selectedOptions) applySource(option, undefined, activeLevel);
      if (feature.sourceKind === 'FEAT' && feature.featDefinition != null) {
        applySource(feature.featDefinition, undefined, activeLevel);
      }
    });
  }
  if (input.equipmentItems.length > 0) {
    schedule('EQUIPMENT', () => {
      const activeLevel = Math.max(input.base.totalLevel, 1);
      const activeItems = [];
      for (const item of input.equipmentItems) {
        if (item.requiresAttunement && !item.attuned) continue;
        const sourceState = { carried: true, equipped: item.equipped, attuned: item.attuned };
        if (!facetPasses(item.restrictions, sourceState)) continue;
        acc.activeEquipmentInstanceIds.push(item.instanceId);
        activeItems.push({ item, sourceState });
        for (const feature of item.features) {
          const eligible = applySource(feature.source, undefined, activeLevel);
          if (
            eligible &&
            feature.sourceChargeUse != null &&
            feature.sourceChargeUse.limitKind === 'SOURCE_CHARGES' &&
            item.chargeId != null &&
            feature.sourceChargeUse.cost > 0
          ) {
            acc.equipmentFeatureChargeUses.push({
              featureId: feature.sourceChargeUse.featureId,
              equipmentId: item.equipmentId,
              itemInstanceId: item.instanceId,
              chargeId: item.chargeId,
              cost: feature.sourceChargeUse.cost
            });
          }
        }
      }
      for (const { item, sourceState } of activeItems) {
        applyModifiers(
          item.rootModifiers,
          item.rootSourceId,
          { kind: 'EQUIPMENT_INSTANCE', equipmentId: item.equipmentId, itemInstanceId: item.instanceId },
          sourceState
        );
      }
    });
  }

  scheduled.sort((left, right) => left.rank - right.rank || left.position - right.position);
  for (const source of scheduled) source.apply();
  return acc;
};`

export const dnd5e2014CharacterGrantFoldModel: RulePackDocumentDto['models'][string] = {
  contentType: 'application/vnd.gorules.decision',
  nodes: [
    {
      id: 'input',
      type: 'inputNode',
      name: 'Character grant facts',
      position: { x: 0, y: 0 },
      content: { schema: '' }
    },
    {
      id: 'character-grant-fold-function',
      type: 'functionNode',
      name: 'Character grant fold',
      position: { x: 180, y: 0 },
      content: { source: DND5E2014_CHARACTER_GRANT_FOLD_SOURCE }
    },
    {
      id: 'output',
      type: 'outputNode',
      name: 'Folded grants',
      position: { x: 360, y: 0 },
      content: { schema: '' }
    }
  ],
  edges: [
    {
      id: 'input-character-grant-fold-function',
      sourceId: 'input',
      targetId: 'character-grant-fold-function'
    },
    {
      id: 'character-grant-fold-function-output',
      sourceId: 'character-grant-fold-function',
      targetId: 'output'
    }
  ]
}

export const dnd5e2014CharacterGrantFoldEmptyInput: CharacterGrantFoldInput = {
  contractVersion: 1,
  base: {
    systemId: 'dnd5e',
    totalLevel: 0,
    raceId: null,
    subraceId: null,
    abilities: {},
    heritageIds: [],
    featureIds: [],
    optionIds: [],
    featIds: [],
    classes: [],
    equipment: []
  },
  upstreamSpellIds: [],
  classes: [],
  background: null,
  features: [],
  equipmentItems: []
}

export const dnd5e2014CharacterGrantFoldEmptyOutput: CharacterGrantFoldOutput = {
  proficiencies: [],
  senses: [],
  modifiers: [],
  unlockedFeatIds: [],
  unlockedSpellIds: [],
  activeSourceIds: [],
  activeEquipmentInstanceIds: [],
  equipmentFeatureChargeUses: [],
  modifierGroups: []
}
