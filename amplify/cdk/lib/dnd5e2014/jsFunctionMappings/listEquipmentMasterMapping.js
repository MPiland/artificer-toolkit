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

// lib/dnd5e2014/equipment/functions/listEquipmentMasterMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZXF1aXBtZW50L2Z1bmN0aW9ucy91dGlscy91dGlsLnRzIiwgIi4uL2VxdWlwbWVudC9mdW5jdGlvbnMvbGlzdEVxdWlwbWVudE1hc3Rlck1hcHBpbmcudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBNEJPLElBQU0sV0FBcUI7QUFBQSxFQUNoQyxnQkFBZ0IsQ0FBQztBQUFBLEVBQ2pCLGtCQUFrQixDQUFDO0FBQUEsRUFDbkIsa0JBQWtCLENBQUM7QUFBQSxFQUNuQixjQUFjLENBQUM7QUFBQSxFQUNmLFlBQVksQ0FBQztBQUFBLEVBQ2IsWUFBWSxDQUFDO0FBQUEsRUFDYixNQUFNLENBQUM7QUFBQSxFQUNQLFFBQVEsQ0FBQztBQUFBLEVBQ1QsVUFBVSxDQUFDO0FBQ2I7QUFFTyxJQUFNLGNBQWMsQ0FBQyxVQUF1QjtBQUNqRCxRQUFNLElBQUksQ0FBQyxTQUFTO0FBQ2xCLFFBQUksS0FBSyxRQUFRLFNBQVMsSUFBSTtBQUM1QixnQkFBVSxTQUFTLGdCQUFnQixLQUFLLE9BQU8sUUFBUSxJQUFJLEtBQUssRUFBRTtBQUFBLElBQ3BFO0FBQ0EsUUFBSSxLQUFLLFFBQVEsV0FBVyxJQUFJO0FBQzlCLGdCQUFVLFNBQVMsa0JBQWtCLEtBQUssT0FBTyxVQUFVLElBQUksS0FBSyxFQUFFO0FBQUEsSUFDeEU7QUFDQSxRQUFJLEtBQUssUUFBUSxXQUFXLElBQUk7QUFDOUIsZ0JBQVUsU0FBUyxrQkFBa0IsS0FBSyxPQUFPLFVBQVUsSUFBSSxLQUFLLEVBQUU7QUFBQSxJQUN4RTtBQUNBLFFBQUksS0FBSyxZQUFZLFFBQVE7QUFDM0IsV0FBSyxXQUFXLFFBQVEsQ0FBQyxhQUFxQjtBQUM1QyxrQkFBVSxTQUFTLFlBQVksVUFBVSxLQUFLLEVBQUU7QUFBQSxNQUNsRCxDQUFDO0FBQUEsSUFDSDtBQUNBLFFBQUksS0FBSyxZQUFZO0FBQ25CLGdCQUFVLFNBQVMsY0FBYyxLQUFLLFlBQVksS0FBSyxFQUFFO0FBQUEsSUFDM0Q7QUFDQSxRQUFJLEtBQUssVUFBVTtBQUNqQixnQkFBVSxTQUFTLFlBQVksS0FBSyxVQUFVLEtBQUssRUFBRTtBQUFBLElBQ3ZEO0FBQ0EsUUFBSSxLQUFLLE1BQU07QUFDYixnQkFBVSxTQUFTLE1BQU0sS0FBSyxLQUFLLFVBQVUsS0FBSyxJQUFJO0FBQUEsUUFDcEQsUUFBUSxLQUFLLEtBQUs7QUFBQSxNQUNwQixDQUFDO0FBQUEsSUFDSDtBQUNBLFFBQUksS0FBSyxRQUFRO0FBQ2YsZ0JBQVUsU0FBUyxRQUFRLEtBQUssT0FBTyxNQUFNLEtBQUssSUFBSTtBQUFBLFFBQ3BELFFBQVEsS0FBSyxPQUFPO0FBQUEsTUFDdEIsQ0FBQztBQUFBLElBQ0g7QUFDQSxRQUFJLEtBQUssWUFBWSxLQUFLLFNBQVMsUUFBUTtBQUN6QyxXQUFLLFNBQVMsUUFBUSxDQUFDLFlBQVk7QUFDakMsa0JBQVUsU0FBUyxVQUFVLFFBQVEsSUFBSSxLQUFLLElBQUk7QUFBQSxVQUNoRCxPQUFPLFFBQVE7QUFBQSxRQUNqQixDQUFDO0FBQUEsTUFDSCxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0YsQ0FBQztBQUNIO0FBRU8sSUFBTSxZQUFZLENBQ3ZCLFdBQ0EsT0FDQSxhQUNBLHFCQUNHO0FBRUgsTUFBSSxrQkFBa0I7QUFDcEIsVUFBTSxhQUFhLFVBQVU7QUFBQSxNQUMzQixDQUFDLE1BQU0sRUFBRSxPQUFPLFNBQVMsT0FBTyxRQUFRLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDLEtBQUssS0FBSyxNQUFNLEVBQUUsR0FBRyxNQUFNLEtBQUs7QUFBQSxJQUNwRztBQUVBLFFBQUksWUFBWTtBQUVkLGlCQUFXLGFBQWEsS0FBSyxXQUFXO0FBQUEsSUFDMUMsT0FBTztBQUVMLGdCQUFVLEtBQUs7QUFBQSxRQUNiLElBQUk7QUFBQSxRQUNKLGNBQWMsQ0FBQyxXQUFXO0FBQUEsUUFDMUIsR0FBRztBQUFBLE1BQ0wsQ0FBbUI7QUFBQSxJQUNyQjtBQUFBLEVBQ0YsT0FBTztBQUVMLFVBQU0sV0FBVyxVQUFVLEtBQUssQ0FBQyxNQUFNLEVBQUUsT0FBTyxLQUFLO0FBQ3JELFFBQUksQ0FBQyxVQUFVO0FBQ2IsZ0JBQVUsS0FBSyxFQUFFLElBQUksT0FBTyxjQUFjLENBQUMsV0FBVyxFQUFFLENBQW1CO0FBQUEsSUFDN0UsT0FBTztBQUNMLGVBQVMsYUFBYSxLQUFLLFdBQVc7QUFBQSxJQUN4QztBQUFBLEVBQ0Y7QUFDRjs7O0FDL0dPLFNBQVMsUUFBUSxLQUFjO0FBQ3BDLFFBQU0sRUFBRSxRQUFRLEtBQU0sVUFBVSxJQUFJLElBQUk7QUFFeEMsU0FBTztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1g7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUNGO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsUUFBTSxRQUFRLElBQUksT0FBTztBQUN6QixjQUFZLEtBQUs7QUFDakIsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBO0FBQUEsSUFDQSxXQUFXLElBQUksT0FBTztBQUFBLEVBQ3hCO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
