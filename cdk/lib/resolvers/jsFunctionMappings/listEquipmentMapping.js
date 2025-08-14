// lib/schemas/equipment/functions/listEquipmentMapping.ts
import { util } from "@aws-appsync/utils";

// lib/schemas/equipment/functions/util.ts
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
        if (typeof feature !== "string") {
          addToMeta(metaData.features, feature.id, item.id);
        } else {
          addToMeta(metaData.features, feature, item.id);
        }
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

// lib/schemas/equipment/functions/listEquipmentMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9lcXVpcG1lbnQvZnVuY3Rpb25zL2xpc3RFcXVpcG1lbnRNYXBwaW5nLnRzIiwgIi4uLy4uL3NjaGVtYXMvZXF1aXBtZW50L2Z1bmN0aW9ucy91dGlsLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLFNBQTBDLFlBQVk7OztBQ3dCL0MsSUFBTSxXQUFxQjtBQUFBLEVBQ2hDLGdCQUFnQixDQUFDO0FBQUEsRUFDakIsa0JBQWtCLENBQUM7QUFBQSxFQUNuQixrQkFBa0IsQ0FBQztBQUFBLEVBQ25CLGNBQWMsQ0FBQztBQUFBLEVBQ2YsWUFBWSxDQUFDO0FBQUEsRUFDYixZQUFZLENBQUM7QUFBQSxFQUNiLE1BQU0sQ0FBQztBQUFBLEVBQ1AsUUFBUSxDQUFDO0FBQUEsRUFDVCxVQUFVLENBQUM7QUFDYjtBQUVPLElBQU0sY0FBYyxDQUFDLFVBQXVCO0FBQ2pELFFBQU0sSUFBSSxDQUFDLFNBQVM7QUFDbEIsUUFBSSxLQUFLLFFBQVEsU0FBUyxJQUFJO0FBQzVCLGdCQUFVLFNBQVMsZ0JBQWdCLEtBQUssT0FBTyxRQUFRLElBQUksS0FBSyxFQUFFO0FBQUEsSUFDcEU7QUFDQSxRQUFJLEtBQUssUUFBUSxXQUFXLElBQUk7QUFDOUIsZ0JBQVUsU0FBUyxrQkFBa0IsS0FBSyxPQUFPLFVBQVUsSUFBSSxLQUFLLEVBQUU7QUFBQSxJQUN4RTtBQUNBLFFBQUksS0FBSyxRQUFRLFdBQVcsSUFBSTtBQUM5QixnQkFBVSxTQUFTLGtCQUFrQixLQUFLLE9BQU8sVUFBVSxJQUFJLEtBQUssRUFBRTtBQUFBLElBQ3hFO0FBQ0EsUUFBSSxLQUFLLFlBQVksUUFBUTtBQUMzQixXQUFLLFdBQVcsUUFBUSxDQUFDLGFBQXFCO0FBQzVDLGtCQUFVLFNBQVMsWUFBWSxVQUFVLEtBQUssRUFBRTtBQUFBLE1BQ2xELENBQUM7QUFBQSxJQUNIO0FBQ0EsUUFBSSxLQUFLLFlBQVk7QUFDbkIsZ0JBQVUsU0FBUyxjQUFjLEtBQUssWUFBWSxLQUFL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
