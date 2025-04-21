// lib/dnd5e2014/race/functions/utils/util.ts
var metaData = {
  categories: [],
  playable: [],
  lineages: [],
  features: []
};
var itemsToMeta = (items) => {
  items.map((item) => {
    if (item.playable) {
      addToMeta(metaData.playable, item.playable, item.id);
    }
    if (item.category) {
      addToMeta(metaData.categories, item.category, item.id);
    }
    if (item.lineages?.length) {
      item.lineages.forEach((lineage) => {
        addToMeta(metaData.lineages, lineage, item.id);
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
var addToMeta = (metaArray, keyId, raceId, additionalFields) => {
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    );
    if (exactMatch) {
      exactMatch.raceIds.push(raceId);
    } else {
      metaArray.push({
        id: keyId,
        raceIds: [raceId],
        ...additionalFields
      });
    }
  } else {
    const existing = metaArray.find((m) => m.id === keyId);
    if (!existing) {
      metaArray.push({ id: keyId, raceIds: [raceId] });
    } else {
      existing.raceIds.push(raceId);
    }
  }
};

// lib/dnd5e2014/race/functions/listRacesMasterMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vcmFjZS9mdW5jdGlvbnMvdXRpbHMvdXRpbC50cyIsICIuLi9yYWNlL2Z1bmN0aW9ucy9saXN0UmFjZXNNYXN0ZXJNYXBwaW5nLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQWVPLElBQU0sV0FBcUI7QUFBQSxFQUNoQyxZQUFZLENBQUM7QUFBQSxFQUNiLFVBQVUsQ0FBQztBQUFBLEVBQ1gsVUFBVSxDQUFDO0FBQUEsRUFDWCxVQUFVLENBQUM7QUFDYjtBQUVPLElBQU0sY0FBYyxDQUFDLFVBQWtCO0FBQzVDLFFBQU0sSUFBSSxDQUFDLFNBQVM7QUFDbEIsUUFBSSxLQUFLLFVBQVU7QUFDakIsZ0JBQVUsU0FBUyxVQUFVLEtBQUssVUFBVSxLQUFLLEVBQUU7QUFBQSxJQUNyRDtBQUNBLFFBQUksS0FBSyxVQUFVO0FBQ2pCLGdCQUFVLFNBQVMsWUFBWSxLQUFLLFVBQVUsS0FBSyxFQUFFO0FBQUEsSUFDdkQ7QUFDQSxRQUFJLEtBQUssVUFBVSxRQUFRO0FBQ3pCLFdBQUssU0FBUyxRQUFRLENBQUMsWUFBWTtBQUNqQyxrQkFBVSxTQUFTLFVBQVUsU0FBUyxLQUFLLEVBQUU7QUFBQSxNQUMvQyxDQUFDO0FBQUEsSUFDSDtBQUNBLFFBQUksS0FBSyxZQUFZLEtBQUssU0FBUyxRQUFRO0FBQ3pDLFdBQUssU0FBUyxRQUFRLENBQUMsWUFBWTtBQUNqQyxrQkFBVSxTQUFTLFVBQVUsUUFBUSxJQUFJLEtBQUssSUFBSTtBQUFBLFVBQ2hELE9BQU8sUUFBUTtBQUFBLFFBQ2pCLENBQUM7QUFBQSxNQUNILENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRixDQUFDO0FBQ0g7QUFFTyxJQUFNLFlBQVksQ0FDdkIsV0FDQSxPQUNBLFFBQ0EscUJBQ0c7QUFFSCxNQUFJLGtCQUFrQjtBQUNwQixVQUFNLGFBQWEsVUFBVTtBQUFBLE1BQzNCLENBQUMsTUFBTSxFQUFFLE9BQU8sU0FBUyxPQUFPLFFBQVEsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUMsS0FBSyxLQUFLLE1BQU0sRUFBRSxHQUFHLE1BQU0sS0FBSztBQUFBLElBQ3BHO0FBRUEsUUFBSSxZQUFZO0FBRWQsaUJBQVcsUUFBUSxLQUFLLE1BQU07QUFBQSxJQUNoQyxPQUFPO0FBRUwsZ0JBQVUsS0FBSztBQUFBLFFBQ2IsSUFBSTtBQUFBLFFBQ0osU0FBUyxDQUFDLE1BQU07QUFBQSxRQUNoQixHQUFHO0FBQUEsTUFDTCxDQUFtQjtBQUFBLElBQ3JCO0FBQUEsRUFDRixPQUFPO0FBRUwsVUFBTSxXQUFXLFVBQVUsS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPLEtBQUs7QUFDckQsUUFBSSxDQUFDLFVBQVU7QUFDYixnQkFBVSxLQUFLLEVBQUUsSUFBSSxPQUFPLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBbUI7QUFBQSxJQUNuRSxPQUFPO0FBQ0wsZUFBUyxRQUFRLEtBQUssTUFBTTtBQUFBLElBQzlCO0FBQUEsRUFDRjtBQUNGOzs7QUMxRU8sU0FBUyxRQUFRLEtBQWM7QUFDcEMsUUFBTSxFQUFFLFFBQVEsS0FBTSxVQUFVLElBQUksSUFBSTtBQUV4QyxTQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWDtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBQ0Y7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUNyQyxRQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3pCLGNBQVksS0FBSztBQUNqQixTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxJQUNBLFdBQVcsSUFBSSxPQUFPO0FBQUEsRUFDeEI7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
