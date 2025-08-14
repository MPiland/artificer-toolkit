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

// lib/schemas/equipment/functions/listEquipmentMasterMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9lcXVpcG1lbnQvZnVuY3Rpb25zL3V0aWwudHMiLCAiLi4vLi4vc2NoZW1hcy9lcXVpcG1lbnQvZnVuY3Rpb25zL2xpc3RFcXVpcG1lbnRNYXN0ZXJNYXBwaW5nLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQXdCTyxJQUFNLFdBQXFCO0FBQUEsRUFDaEMsZ0JBQWdCLENBQUM7QUFBQSxFQUNqQixrQkFBa0IsQ0FBQztBQUFBLEVBQ25CLGtCQUFrQixDQUFDO0FBQUEsRUFDbkIsY0FBYyxDQUFDO0FBQUEsRUFDZixZQUFZLENBQUM7QUFBQSxFQUNiLFlBQVksQ0FBQztBQUFBLEVBQ2IsTUFBTSxDQUFDO0FBQUEsRUFDUCxRQUFRLENBQUM7QUFBQSxFQUNULFVBQVUsQ0FBQztBQUNiO0FBRU8sSUFBTSxjQUFjLENBQUMsVUFBdUI7QUFDakQsUUFBTSxJQUFJLENBQUMsU0FBUztBQUNsQixRQUFJLEtBQUssUUFBUSxTQUFTLElBQUk7QUFDNUIsZ0JBQVUsU0FBUyxnQkFBZ0IsS0FBSyxPQUFPLFFBQVEsSUFBSSxLQUFLLEVBQUU7QUFBQSxJQUNwRTtBQUNBLFFBQUksS0FBSyxRQUFRLFdBQVcsSUFBSTtBQUM5QixnQkFBVSxTQUFTLGtCQUFrQixLQUFLLE9BQU8sVUFBVSxJQUFJLEtBQUssRUFBRTtBQUFBLElBQ3hFO0FBQ0EsUUFBSSxLQUFLLFFBQVEsV0FBVyxJQUFJO0FBQzlCLGdCQUFVLFNBQVMsa0JBQWtCLEtBQUssT0FBTyxVQUFVLElBQUksS0FBSyxFQUFFO0FBQUEsSUFDeEU7QUFDQSxRQUFJLEtBQUssWUFBWSxRQUFRO0FBQzNCLFdBQUssV0FBVyxRQUFRLENBQUMsYUFBcUI7QUFDNUMsa0JBQVUsU0FBUyxZQUFZLFVBQVUsS0FBSyxFQUFFO0FBQUEsTUFDbEQsQ0FBQztBQUFBLElBQ0g7QUFDQSxRQUFJLEtBQUssWUFBWTtBQUNuQixnQkFBVSxTQUFTLGNBQWMsS0FBSyxZQUFZLEtBQUssRUFBRTtBQUFBLElBQzNEO0FBQ0EsUUFBSSxLQUFLLFVBQVU7QUFDakIsZ0JBQVUsU0FBUyxZQUFZLEtBQUssVUFBVSxLQUFLLEVBQUU7QUFBQSxJQUN2RDtBQUNBLFFBQUksS0FBSyxNQUFNO0FBQ2IsZ0JBQVUsU0FBUyxNQUFNLEtBQUssS0FBSyxVQUFVLEtBQUssSUFBSTtBQUFBLFFBQ3BELFFBQVEsS0FBSyxLQUFLO0FBQUEsTUFDcEIsQ0FBQztBQUFBLElBQ0g7QUFDQSxRQUFJLEtBQUssUUFBUTtBQUNmLGdCQUFVLFNBQVMsUUFBUSxLQUFLLE9BQU8sTUFBTSxLQUFLLElBQUk7QUFBQSxRQUNwRCxRQUFRLEtBQUssT0FBTztBQUFBLE1BQ3RCLENBQUM7QUFBQSxJQUNIO0FBQ0EsUUFBSSxLQUFLLFlBQVksS0FBSyxTQUFTLFFBQVE7QUFDekMsV0FBSyxTQUFTLFFBQVEsQ0FBQyxZQUFZO0FBQ2pDLFlBQUksT0FBTyxZQUFZLFVBQVU7QUFDL0Isb0JBQVUsU0FBUyxVQUFVLFFBQVEsSUFBSSxLQUFLLEVBQUU7QUFBQSxRQUNsRCxPQUFPO0FBQ0wsb0JBQVUsU0FBUyxVQUFVLFNBQVMsS0FBSyxFQUFFO0FBQUEsUUFDL0M7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRixDQUFDO0FBQ0g7QUFFTyxJQUFNLFlBQVksQ0FDdkIsV0FDQSxPQUNBLGFBQ0EscUJBQ0c7QUFFSCxNQUFJLGtCQUFrQjtBQUNwQixVQUFNLGFBQWEsVUFBVTtBQUFBLE1BQzNCLENBQUMsTUFBTSxFQUFFLE9BQU8sU0FBUyxPQUFPLFFBQVEsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUMsS0FBSyxLQUFLLE1BQU0sRUFBRSxHQUFHLE1BQU0sS0FBSztBQUFBLElBQ3BHO0FBRUEsUUFBSSxZQUFZO0FBRWQsaUJBQVcsYUFBYSxLQUFLLFdBQVc7QUFBQSxJQUMxQyxPQUFPO0FBRUwsZ0JBQVUsS0FBSztBQUFBLFFBQ2IsSUFBSTtBQUFBLFFBQ0osY0FBYyxDQUFDLFdBQVc7QUFBQSxRQUMxQixHQUFHO0FBQUEsTUFDTCxDQUFtQjtBQUFBLElBQ3JCO0FBQUEsRUFDRixPQUFPO0FBRUwsVUFBTSxXQUFXLFVBQVUsS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPLEtBQUs7QUFDckQsUUFBSSxDQUFDLFVBQVU7QUFDYixnQkFBVSxLQUFLLEVBQUUsSUFBSSxPQUFPLGNBQWMsQ0FBQyxXQUFXLEVBQUUsQ0FBbUI7QUFBQSxJQUM3RSxPQUFPO0FBQ0wsZUFBUyxhQUFhLEtBQUssV0FBVztBQUFBLElBQ3hDO0FBQUEsRUFDRjtBQUNGOzs7QUM3R08sU0FBUyxRQUFRLEtBQWM7QUFDcEMsUUFBTSxFQUFFLFFBQVEsS0FBTSxVQUFVLElBQUksSUFBSTtBQUV4QyxTQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWDtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQ0Y7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUNyQyxRQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3pCLGNBQVksS0FBSztBQUNqQixTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxJQUNBLFdBQVcsSUFBSSxPQUFPO0FBQUEsRUFDeEI7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
