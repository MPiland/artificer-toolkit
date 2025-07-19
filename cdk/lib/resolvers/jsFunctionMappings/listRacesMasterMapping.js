// lib/schemas/race/functions/utils/util.ts
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
        addToMeta(metaData.features, feature, item.id);
      });
    }
    if (item.ancestry?.options?.length) {
      item.ancestry.options.forEach((option) => {
        if (option.features?.length) {
          option.features.forEach((feature) => {
            addToMeta(metaData.features, feature, option.id);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9yYWNlL2Z1bmN0aW9ucy91dGlscy91dGlsLnRzIiwgIi4uLy4uL3NjaGVtYXMvcmFjZS9mdW5jdGlvbnMvbGlzdFJhY2VzTWFzdGVyTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFXTyxJQUFNLFdBQXFCO0FBQUEsRUFDaEMsWUFBWSxDQUFDO0FBQUEsRUFDYixVQUFVLENBQUM7QUFBQSxFQUNYLFVBQVUsQ0FBQztBQUFBLEVBQ1gsVUFBVSxDQUFDO0FBQ2I7QUFFTyxJQUFNLGNBQWMsQ0FBQyxVQUFrQjtBQUM1QyxRQUFNLElBQUksQ0FBQyxTQUFTO0FBQ2xCLFFBQUksS0FBSyxVQUFVO0FBQ2pCLGdCQUFVLFNBQVMsVUFBVSxLQUFLLFVBQVUsS0FBSyxFQUFFO0FBQUEsSUFDckQ7QUFDQSxRQUFJLEtBQUssVUFBVTtBQUNqQixnQkFBVSxTQUFTLFlBQVksS0FBSyxVQUFVLEtBQUssRUFBRTtBQUFBLElBQ3ZEO0FBQ0EsUUFBSSxLQUFLLFVBQVUsUUFBUTtBQUN6QixXQUFLLFNBQVMsUUFBUSxDQUFDLFlBQVk7QUFDakMsa0JBQVUsU0FBUyxVQUFVLFNBQVMsS0FBSyxFQUFFO0FBQUEsTUFDL0MsQ0FBQztBQUFBLElBQ0g7QUFDQSxRQUFJLEtBQUssWUFBWSxLQUFLLFNBQVMsUUFBUTtBQUN6QyxXQUFLLFNBQVMsUUFBUSxDQUFDLFlBQVk7QUFDakMsa0JBQVUsU0FBUyxVQUFVLFNBQVMsS0FBSyxFQUFFO0FBQUEsTUFDL0MsQ0FBQztBQUFBLElBQ0g7QUFDQSxRQUFJLEtBQUssVUFBVSxTQUFTLFFBQVE7QUFDbEMsV0FBSyxTQUFTLFFBQVEsUUFBUSxDQUFDLFdBQVc7QUFDeEMsWUFBSSxPQUFPLFVBQVUsUUFBUTtBQUMzQixpQkFBTyxTQUFTLFFBQVEsQ0FBQyxZQUFZO0FBQ25DLHNCQUFVLFNBQVMsVUFBVSxTQUFTLE9BQU8sRUFBRTtBQUFBLFVBQ2pELENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0YsQ0FBQztBQUNIO0FBRU8sSUFBTSxZQUFZLENBQ3ZCLFdBQ0EsT0FDQSxRQUNBLHFCQUNHO0FBRUgsTUFBSSxrQkFBa0I7QUFDcEIsVUFBTSxhQUFhLFVBQVU7QUFBQSxNQUMzQixDQUFDLE1BQU0sRUFBRSxPQUFPLFNBQVMsT0FBTyxRQUFRLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDLEtBQUssS0FBSyxNQUFNLEVBQUUsR0FBRyxNQUFNLEtBQUs7QUFBQSxJQUNwRztBQUVBLFFBQUksWUFBWTtBQUVkLGlCQUFXLFFBQVEsS0FBSyxNQUFNO0FBQUEsSUFDaEMsT0FBTztBQUVMLGdCQUFVLEtBQUs7QUFBQSxRQUNiLElBQUk7QUFBQSxRQUNKLFNBQVMsQ0FBQyxNQUFNO0FBQUEsUUFDaEIsR0FBRztBQUFBLE1BQ0wsQ0FBbUI7QUFBQSxJQUNyQjtBQUFBLEVBQ0YsT0FBTztBQUVMLFVBQU0sV0FBVyxVQUFVLEtBQUssQ0FBQyxNQUFNLEVBQUUsT0FBTyxLQUFLO0FBQ3JELFFBQUksQ0FBQyxVQUFVO0FBQ2IsZ0JBQVUsS0FBSyxFQUFFLElBQUksT0FBTyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQW1CO0FBQUEsSUFDbkUsT0FBTztBQUNMLGVBQVMsUUFBUSxLQUFLLE1BQU07QUFBQSxJQUM5QjtBQUFBLEVBQ0Y7QUFDRjs7O0FDN0VPLFNBQVMsUUFBUSxLQUFjO0FBQ3BDLFFBQU0sRUFBRSxRQUFRLEtBQU0sVUFBVSxJQUFJLElBQUk7QUFFeEMsU0FBTztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1g7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUNGO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsUUFBTSxRQUFRLElBQUksT0FBTztBQUN6QixjQUFZLEtBQUs7QUFDakIsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBO0FBQUEsSUFDQSxXQUFXLElBQUksT0FBTztBQUFBLEVBQ3hCO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
