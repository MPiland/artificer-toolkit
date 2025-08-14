// lib/schemas/race/functions/util.ts
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
        if (typeof feature !== "string") {
          addToMeta(metaData.features, feature.id, item.id);
        } else {
          addToMeta(metaData.features, feature, item.id);
        }
      });
    }
    if (item.ancestry?.options?.length) {
      item.ancestry.options.forEach((option) => {
        if (option.features?.length) {
          option.features.forEach((feature) => {
            if (typeof feature !== "string") {
              addToMeta(metaData.features, feature.id, option.id);
            } else {
              addToMeta(metaData.features, feature, option.id);
            }
          });
        }
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

// lib/schemas/race/functions/listRacesMasterMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9yYWNlL2Z1bmN0aW9ucy91dGlsLnRzIiwgIi4uLy4uL3NjaGVtYXMvcmFjZS9mdW5jdGlvbnMvbGlzdFJhY2VzTWFzdGVyTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFXTyxJQUFNLFdBQXFCO0FBQUEsRUFDaEMsWUFBWSxDQUFDO0FBQUEsRUFDYixVQUFVLENBQUM7QUFBQSxFQUNYLFVBQVUsQ0FBQztBQUFBLEVBQ1gsVUFBVSxDQUFDO0FBQ2I7QUFFTyxJQUFNLGNBQWMsQ0FBQyxVQUFrQjtBQUM1QyxRQUFNLElBQUksQ0FBQyxTQUFTO0FBQ2xCLFFBQUksS0FBSyxVQUFVO0FBQ2pCLGdCQUFVLFNBQVMsVUFBVSxLQUFLLFVBQVUsS0FBSyxFQUFFO0FBQUEsSUFDckQ7QUFDQSxRQUFJLEtBQUssVUFBVTtBQUNqQixnQkFBVSxTQUFTLFlBQVksS0FBSyxVQUFVLEtBQUssRUFBRTtBQUFBLElBQ3ZEO0FBQ0EsUUFBSSxLQUFLLFVBQVUsUUFBUTtBQUN6QixXQUFLLFNBQVMsUUFBUSxDQUFDLFlBQVk7QUFDakMsa0JBQVUsU0FBUyxVQUFVLFNBQVMsS0FBSyxFQUFFO0FBQUEsTUFDL0MsQ0FBQztBQUFBLElBQ0g7QUFDQSxRQUFJLEtBQUssWUFBWSxLQUFLLFNBQVMsUUFBUTtBQUN6QyxXQUFLLFNBQVMsUUFBUSxDQUFDLFlBQVk7QUFDakMsWUFBSSxPQUFPLFlBQVksVUFBVTtBQUMvQixvQkFBVSxTQUFTLFVBQVUsUUFBUSxJQUFJLEtBQUssRUFBRTtBQUFBLFFBQ2xELE9BQU87QUFDTCxvQkFBVSxTQUFTLFVBQVUsU0FBUyxLQUFLLEVBQUU7QUFBQSxRQUMvQztBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFDQSxRQUFJLEtBQUssVUFBVSxTQUFTLFFBQVE7QUFDbEMsV0FBSyxTQUFTLFFBQVEsUUFBUSxDQUFDLFdBQVc7QUFDeEMsWUFBSSxPQUFPLFVBQVUsUUFBUTtBQUMzQixpQkFBTyxTQUFTLFFBQVEsQ0FBQyxZQUFZO0FBQ25DLGdCQUFJLE9BQU8sWUFBWSxVQUFVO0FBQy9CLHdCQUFVLFNBQVMsVUFBVSxRQUFRLElBQUksT0FBTyxFQUFFO0FBQUEsWUFDcEQsT0FBTztBQUNMLHdCQUFVLFNBQVMsVUFBVSxTQUFTLE9BQU8sRUFBRTtBQUFBLFlBQ2pEO0FBQUEsVUFDRixDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGLENBQUM7QUFDSDtBQUVPLElBQU0sWUFBWSxDQUN2QixXQUNBLE9BQ0EsUUFDQSxxQkFDRztBQUVILE1BQUksa0JBQWtCO0FBQ3BCLFVBQU0sYUFBYSxVQUFVO0FBQUEsTUFDM0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxTQUFTLE9BQU8sUUFBUSxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLEtBQUssTUFBTSxFQUFFLEdBQUcsTUFBTSxLQUFLO0FBQUEsSUFDcEc7QUFFQSxRQUFJLFlBQVk7QUFFZCxpQkFBVyxRQUFRLEtBQUssTUFBTTtBQUFBLElBQ2hDLE9BQU87QUFFTCxnQkFBVSxLQUFLO0FBQUEsUUFDYixJQUFJO0FBQUEsUUFDSixTQUFTLENBQUMsTUFBTTtBQUFBLFFBQ2hCLEdBQUc7QUFBQSxNQUNMLENBQW1CO0FBQUEsSUFDckI7QUFBQSxFQUNGLE9BQU87QUFFTCxVQUFNLFdBQVcsVUFBVSxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU8sS0FBSztBQUNyRCxRQUFJLENBQUMsVUFBVTtBQUNiLGdCQUFVLEtBQUssRUFBRSxJQUFJLE9BQU8sU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFtQjtBQUFBLElBQ25FLE9BQU87QUFDTCxlQUFTLFFBQVEsS0FBSyxNQUFNO0FBQUEsSUFDOUI7QUFBQSxFQUNGO0FBQ0Y7OztBQ3JGTyxTQUFTLFFBQVEsS0FBYztBQUNwQyxRQUFNLEVBQUUsUUFBUSxLQUFNLFVBQVUsSUFBSSxJQUFJO0FBRXhDLFNBQU87QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDRjtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsY0FBWSxLQUFLO0FBQ2pCLFNBQU87QUFBQSxJQUNMO0FBQUEsSUFDQTtBQUFBLElBQ0EsV0FBVyxJQUFJLE9BQU87QUFBQSxFQUN4QjtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
