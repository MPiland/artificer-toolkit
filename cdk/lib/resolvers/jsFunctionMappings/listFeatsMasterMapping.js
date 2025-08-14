// lib/schemas/feat/functions/util.ts
var metaData = {
  features: []
};
var itemsToMeta = (items) => {
  items.map((item) => {
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
var addToMeta = (metaArray, keyId, featId, additionalFields) => {
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    );
    if (exactMatch) {
      exactMatch.featIds.push(featId);
    } else {
      metaArray.push({
        id: keyId,
        featIds: [featId],
        ...additionalFields
      });
    }
  } else {
    const existing = metaArray.find((m) => m.id === keyId);
    if (!existing) {
      metaArray.push({ id: keyId, featIds: [featId] });
    } else {
      existing.featIds.push(featId);
    }
  }
};

// lib/schemas/feat/functions/listFeatsMasterMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9mZWF0L2Z1bmN0aW9ucy91dGlsLnRzIiwgIi4uLy4uL3NjaGVtYXMvZmVhdC9mdW5jdGlvbnMvbGlzdEZlYXRzTWFzdGVyTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFRTyxJQUFNLFdBQXFCO0FBQUEsRUFDaEMsVUFBVSxDQUFDO0FBQ2I7QUFFTyxJQUFNLGNBQWMsQ0FBQyxVQUFrQjtBQUM1QyxRQUFNLElBQUksQ0FBQyxTQUFTO0FBQ2xCLFFBQUksS0FBSyxZQUFZLEtBQUssU0FBUyxRQUFRO0FBQ3pDLFdBQUssU0FBUyxRQUFRLENBQUMsWUFBWTtBQUNqQyxZQUFJLE9BQU8sWUFBWSxVQUFVO0FBQy9CLG9CQUFVLFNBQVMsVUFBVSxRQUFRLElBQUksS0FBSyxFQUFFO0FBQUEsUUFDbEQsT0FBTztBQUNMLG9CQUFVLFNBQVMsVUFBVSxTQUFTLEtBQUssRUFBRTtBQUFBLFFBQy9DO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0YsQ0FBQztBQUNIO0FBRU8sSUFBTSxZQUFZLENBQ3ZCLFdBQ0EsT0FDQSxRQUNBLHFCQUNHO0FBRUgsTUFBSSxrQkFBa0I7QUFDcEIsVUFBTSxhQUFhLFVBQVU7QUFBQSxNQUMzQixDQUFDLE1BQU0sRUFBRSxPQUFPLFNBQVMsT0FBTyxRQUFRLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDLEtBQUssS0FBSyxNQUFNLEVBQUUsR0FBRyxNQUFNLEtBQUs7QUFBQSxJQUNwRztBQUVBLFFBQUksWUFBWTtBQUVkLGlCQUFXLFFBQVEsS0FBSyxNQUFNO0FBQUEsSUFDaEMsT0FBTztBQUVMLGdCQUFVLEtBQUs7QUFBQSxRQUNiLElBQUk7QUFBQSxRQUNKLFNBQVMsQ0FBQyxNQUFNO0FBQUEsUUFDaEIsR0FBRztBQUFBLE1BQ0wsQ0FBbUI7QUFBQSxJQUNyQjtBQUFBLEVBQ0YsT0FBTztBQUVMLFVBQU0sV0FBVyxVQUFVLEtBQUssQ0FBQyxNQUFNLEVBQUUsT0FBTyxLQUFLO0FBQ3JELFFBQUksQ0FBQyxVQUFVO0FBQ2IsZ0JBQVUsS0FBSyxFQUFFLElBQUksT0FBTyxTQUFTLENBQUMsTUFBTSxFQUFFLENBQW1CO0FBQUEsSUFDbkUsT0FBTztBQUNMLGVBQVMsUUFBUSxLQUFLLE1BQU07QUFBQSxJQUM5QjtBQUFBLEVBQ0Y7QUFDRjs7O0FDdkRPLFNBQVMsUUFBUSxLQUFjO0FBQ3BDLFFBQU0sRUFBRSxRQUFRLEtBQU0sVUFBVSxJQUFJLElBQUk7QUFFeEMsU0FBTztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1g7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUNGO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsUUFBTSxRQUFRLElBQUksT0FBTztBQUN6QixjQUFZLEtBQUs7QUFDakIsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBO0FBQUEsSUFDQSxXQUFXLElBQUksT0FBTztBQUFBLEVBQ3hCO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
