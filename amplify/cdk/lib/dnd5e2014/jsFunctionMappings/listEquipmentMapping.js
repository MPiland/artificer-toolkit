// lib/dnd5e2014/equipment/functions/listEquipmentMapping.ts
import { util } from "@aws-appsync/utils";

// lib/dnd5e2014/equipment/functions/utils/util.ts
var metaData = {
  primaryDamages: [],
  secondaryDamages: [],
  versatileDamages: [],
  armorClasses: [],
  properties: [],
  categories: [],
  cost: [],
  weight: [],
  features: []
};
var itemsToMeta = (items) => {
  items.map((item) => {
    if (item.damage?.primary?.id) {
      addToMeta(metaData.primaryDamages, item.damage.primary.id, item.id);
    }
    if (item.damage?.secondary?.id) {
      addToMeta(metaData.secondaryDamages, item.damage.secondary.id, item.id);
    }
    if (item.damage?.versatile?.id) {
      addToMeta(metaData.versatileDamages, item.damage.versatile.id, item.id);
    }
    if (item.properties?.length) {
      item.properties.forEach((property) => {
        addToMeta(metaData.properties, property, item.id);
      });
    }
    if (item.armorClass) {
      addToMeta(metaData.armorClasses, item.armorClass, item.id);
    }
    if (item.category) {
      addToMeta(metaData.categories, item.category, item.id);
    }
    if (item.cost) {
      addToMeta(metaData.cost, item.cost.currency, item.id, {
        amount: item.cost.amount
      });
    }
    if (item.weight) {
      addToMeta(metaData.weight, item.weight.unit, item.id, {
        amount: item.weight.amount
      });
    }
    if (item.features && item.features.length) {
      item.features.forEach((feature) => {
        addToMeta(metaData.features, feature.id, item.id, {
          label: feature.label
        });
      });
    }
  });
};
var addToMeta = (metaArray, keyId, equipmentId, additionalFields) => {
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    );
    if (exactMatch) {
      exactMatch.equipmentIds.push(equipmentId);
    } else {
      metaArray.push({
        id: keyId,
        equipmentIds: [equipmentId],
        ...additionalFields
      });
    }
  } else {
    const existing = metaArray.find((m) => m.id === keyId);
    if (!existing) {
      metaArray.push({ id: keyId, equipmentIds: [equipmentId] });
    } else {
      existing.equipmentIds.push(equipmentId);
    }
  }
};

// lib/dnd5e2014/equipment/functions/listEquipmentMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZXF1aXBtZW50L2Z1bmN0aW9ucy9saXN0RXF1aXBtZW50TWFwcGluZy50cyIsICIuLi9lcXVpcG1lbnQvZnVuY3Rpb25zL3V0aWxzL3V0aWwudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsU0FBMEMsWUFBWTs7O0FDNEIvQyxJQUFNLFdBQXFCO0FBQUEsRUFDaEMsZ0JBQWdCLENBQUM7QUFBQSxFQUNqQixrQkFBa0IsQ0FBQztBQUFBLEVBQ25CLGtCQUFrQixDQUFDO0FBQUEsRUFDbkIsY0FBYyxDQUFDO0FBQUEsRUFDZixZQUFZLENBQUM7QUFBQSxFQUNiLFlBQVksQ0FBQztBQUFBLEVBQ2IsTUFBTSxDQUFDO0FBQUEsRUFDUCxRQUFRLENBQUM7QUFBQSxFQUNULFVBQVUsQ0FBQztBQUNiO0FBRU8sSUFBTSxjQUFjLENBQUMsVUFBdUI7QUFDakQsUUFBTSxJQUFJLENBQUMsU0FBUztBQUNsQixRQUFJLEtBQUssUUFBUSxTQUFTLElBQUk7QUFDNUIsZ0JBQVUsU0FBUyxnQkFBZ0IsS0FBSyxPQUFPLFFBQVEsSUFBSSxLQUFLLEVBQUU7QUFBQSxJQUNwRTtBQUNBLFFBQUksS0FBSyxRQUFRLFdBQVcsSUFBSTtBQUM5QixnQkFBVSxTQUFTLGtCQUFrQixLQUFLLE9BQU8sVUFBVSxJQUFJLEtBQUssRUFBRTtBQUFBLElBQ3hFO0FBQ0EsUUFBSSxLQUFLLFFBQVEsV0FBVyxJQUFJO0FBQzlCLGdCQUFVLFNBQVMsa0JBQWtCLEtBQUssT0FBTyxVQUFVLElBQUksS0FBSyxFQUFFO0FBQUEsSUFDeEU7QUFDQSxRQUFJLEtBQUssWUFBWSxRQUFRO0FBQzNCLFdBQUssV0FBVyxRQUFRLENBQUMsYUFBcUI7QUFDNUMsa0JBQVUsU0FBUyxZQUFZLFVBQVUsS0FBSyxFQUFFO0FBQUEsTUFDbEQsQ0FBQztBQUFBLElBQ0g7QUFDQSxRQUFJLEtBQUssWUFBWTtBQUNuQixnQkFBVSxTQUFTLGNBQWMsS0FBSyxZQUFZLEtBQUssRUFBRTtBQUFBLElBQzNE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
