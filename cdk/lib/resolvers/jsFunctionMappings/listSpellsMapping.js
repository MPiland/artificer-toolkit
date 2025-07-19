// lib/schemas/spell/functions/listSpellsMapping.ts
import { util } from "@aws-appsync/utils";

// lib/schemas/spell/functions/utils/util.ts
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
      addToMeta(metaData.primaryActions, item.actions.primary.id, item.id, {
        amount: item.actions.primary.amount || null
      });
    }
    if (item.actions?.secondary?.id) {
      addToMeta(metaData.secondaryActions, item.actions.secondary.id, item.id, {
        amount: item.actions.secondary.amount || null
      });
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

// lib/schemas/spell/functions/listSpellsMapping.ts
function request(ctx) {
  const { systemId, limit = 1e3, nextToken } = ctx.args;
  const ownerId = ctx.identity.sub;
  const baseQuery = {
    operation: "Query",
    query: {
      expression: "ownerId = :ownerId",
      expressionValues: util.dynamodb.toMapValues({ ":ownerId": ownerId })
    },
    filter: {
      expression: "systemId = :systemId",
      expressionValues: util.dynamodb.toMapValues({
        ":systemId": systemId
      })
    },
    index: "ownerIndex",
    limit,
    nextToken
  };
  return baseQuery;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9zcGVsbC9mdW5jdGlvbnMvbGlzdFNwZWxsc01hcHBpbmcudHMiLCAiLi4vLi4vc2NoZW1hcy9zcGVsbC9mdW5jdGlvbnMvdXRpbHMvdXRpbC50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxTQUEwQyxZQUFZOzs7QUN5Qy9DLElBQU0sV0FBcUI7QUFBQSxFQUNoQyxZQUFZLENBQUM7QUFBQSxFQUNiLGdCQUFnQixDQUFDO0FBQUEsRUFDakIsa0JBQWtCLENBQUM7QUFBQSxFQUNuQixnQkFBZ0IsQ0FBQztBQUFBLEVBQ2pCLGtCQUFrQixDQUFDO0FBQUEsRUFDbkIsWUFBWSxDQUFDO0FBQUEsRUFDYixTQUFTLENBQUM7QUFBQSxFQUNWLFdBQVcsQ0FBQztBQUFBLEVBQ1osUUFBUSxDQUFDO0FBQUEsRUFDVCxRQUFRLENBQUM7QUFBQSxFQUNULFNBQVMsQ0FBQztBQUFBLEVBQ1YsUUFBUSxDQUFDO0FBQUEsRUFDVCxlQUFlLENBQUM7QUFBQSxFQUNoQixjQUFjLENBQUM7QUFDakI7QUFFTyxJQUFNLGNBQWMsQ0FBQyxVQUFtQjtBQUM3QyxRQUFNLElBQUksQ0FBQyxTQUFTO0FBQ2xCLFFBQUksS0FBSyxZQUFZLFFBQVE7QUFDM0IsV0FBSyxXQUFXLFFBQVEsQ0FBQyxjQUFjO0FBQ3JDLGtCQUFVLFNBQVMsWUFBWSxXQUFXLEtBQUssRUFBRTtBQUFBLE1BQ25ELENBQUM7QUFBQSxJQUNIO0FBQ0EsUUFBSSxLQUFLLFFBQVEsU0FBUyxJQUFJO0FBQzVCLGdCQUFVLFNBQVMsZ0JBQWdCLEtBQUssT0FBTyxRQUFRLElBQUksS0FBSyxFQUFFO0FBQUEsSUFDcEU7QUFDQSxRQUFJLEtBQUssUUFBUSxXQUFXLElBQUk7QUFDOUIsZ0JBQVUsU0FBUyxrQkFBa0IsS0FBSyxPQUFPLFVBQVUsSUFBSSxLQUFLLEVBQUU7QUFBQSxJQUN4RTtBQUNBLFFBQUksS0FBSyxTQUFTLFNBQVMsSUFBSTtBQUM3QixnQkFBVSxTQUFTLGdCQUFn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
