// lib/dnd5e2014/spell/functions/utils/util.ts
var metaData = {
  attributes: [],
  primaryDamages: [],
  secondaryDamages: [],
  primaryActions: [],
  secondaryActions: [],
  conditions: [],
  classes: [],
  durations: [],
  ranges: [],
  shapes: [],
  schools: [],
  levels: [],
  saveAbilities: [],
  requirements: []
};
var itemsToMeta = (items) => {
  items.map((item) => {
    if (item.attributes?.length) {
      item.attributes.forEach((attribute) => {
        addToMeta(metaData.attributes, attribute, item.id);
      });
    }
    if (item.damage?.primary?.id) {
      addToMeta(metaData.primaryDamages, item.damage.primary.id, item.id);
    }
    if (item.damage?.secondary?.id) {
      addToMeta(metaData.secondaryDamages, item.damage.secondary.id, item.id);
    }
    if (item.actions?.primary?.id) {
      addToMeta(metaData.primaryActions, item.actions.primary.id, item.id);
    }
    if (item.conditions?.length) {
      item.conditions.forEach((condition) => {
        addToMeta(metaData.conditions, condition, item.id);
      });
    }
    if (item.classes?.length) {
      item.classes.forEach((classId) => {
        addToMeta(metaData.classes, classId, item.id);
      });
    }
    if (item.range?.id) {
      addToMeta(metaData.ranges, item.range.id, item.id, {
        unit: item.range.unit,
        minRange: item.range.minRange,
        maxRange: item.range.maxRange,
        distance: item.range.distance
      });
    }
    if (item.shape?.id) {
      addToMeta(metaData.shapes, item.shape.id, item.id, {
        unit: item.shape.unit,
        size: item.shape.size
      });
    }
    if (item.duration?.id) {
      addToMeta(metaData.durations, item.duration.id, item.id, {
        amount: item.duration.amount
      });
    }
    if (item.school) {
      addToMeta(metaData.schools, item.school, item.id);
    }
    if (item.level) {
      addToMeta(metaData.levels, item.level, item.id);
    }
    if (item.saveAbility?.id) {
      addToMeta(metaData.saveAbilities, item.saveAbility.id, item.id);
    }
    if (item.requirements?.length) {
      item.requirements.forEach((requirement) => {
        addToMeta(metaData.requirements, requirement, item.id);
      });
    }
  });
};
var addToMeta = (metaArray, keyId, spellId, additionalFields) => {
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    );
    if (exactMatch) {
      exactMatch.spellIds.push(spellId);
    } else {
      metaArray.push({
        id: keyId,
        spellIds: [spellId],
        ...additionalFields
      });
    }
  } else {
    const existing = metaArray.find((m) => m.id === keyId);
    if (!existing) {
      metaArray.push({ id: keyId, spellIds: [spellId] });
    } else {
      existing.spellIds.push(spellId);
    }
  }
};

// lib/dnd5e2014/spell/functions/listSpellsMasterMapping.ts
function request(ctx) {
  const { limit = 1e3, nextToken } = ctx.args;
  return {
    operation: "Scan",
    limit,
    nextToken
  };
}
function response(ctx) {
  const items = ctx.result.items;
  itemsToMeta(items);
  return {
    items,
    metaData,
    nextToken: ctx.result.nextToken
  };
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3BlbGwvZnVuY3Rpb25zL3V0aWxzL3V0aWwudHMiLCAiLi4vc3BlbGwvZnVuY3Rpb25zL2xpc3RTcGVsbHNNYXN0ZXJNYXBwaW5nLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQXFDTyxJQUFNLFdBQXFCO0FBQUEsRUFDaEMsWUFBWSxDQUFDO0FBQUEsRUFDYixnQkFBZ0IsQ0FBQztBQUFBLEVBQ2pCLGtCQUFrQixDQUFDO0FBQUEsRUFDbkIsZ0JBQWdCLENBQUM7QUFBQSxFQUNqQixrQkFBa0IsQ0FBQztBQUFBLEVBQ25CLFlBQVksQ0FBQztBQUFBLEVBQ2IsU0FBUyxDQUFDO0FBQUEsRUFDVixXQUFXLENBQUM7QUFBQSxFQUNaLFFBQVEsQ0FBQztBQUFBLEVBQ1QsUUFBUSxDQUFDO0FBQUEsRUFDVCxTQUFTLENBQUM7QUFBQSxFQUNWLFFBQVEsQ0FBQztBQUFBLEVBQ1QsZUFBZSxDQUFDO0FBQUEsRUFDaEIsY0FBYyxDQUFDO0FBQ2pCO0FBRU8sSUFBTSxjQUFjLENBQUMsVUFBbUI7QUFDN0MsUUFBTSxJQUFJLENBQUMsU0FBUztBQUNsQixRQUFJLEtBQUssWUFBWSxRQUFRO0FBQzNCLFdBQUssV0FBVyxRQUFRLENBQUMsY0FBYztBQUNyQyxrQkFBVSxTQUFTLFlBQVksV0FBVyxLQUFLLEVBQUU7QUFBQSxNQUNuRCxDQUFDO0FBQUEsSUFDSDtBQUNBLFFBQUksS0FBSyxRQUFRLFNBQVMsSUFBSTtBQUM1QixnQkFBVSxTQUFTLGdCQUFnQixLQUFLLE9BQU8sUUFBUSxJQUFJLEtBQUssRUFBRTtBQUFBLElBQ3BFO0FBQ0EsUUFBSSxLQUFLLFFBQVEsV0FBVyxJQUFJO0FBQzlCLGdCQUFVLFNBQVMsa0JBQWtCLEtBQUssT0FBTyxVQUFVLElBQUksS0FBSyxFQUFFO0FBQUEsSUFDeEU7QUFDQSxRQUFJLEtBQUssU0FBUyxTQUFTLElBQUk7QUFDN0IsZ0JBQVUsU0FBUyxnQkFBZ0IsS0FBSyxRQUFRLFFBQVEsSUFBSSxLQUFLLEVBQUU7QUFB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
