// lib/dnd5e2014/background/functions/utils/util.ts
var metaData = {
  features: []
};
var itemsToMeta = (items) => {
  items.map((item) => {
    if (item.features && item.features.length) {
      item.features.forEach((feature) => {
        addToMeta(metaData.features, feature.id, item.id, {
          label: feature.label
        });
      });
    }
  });
};
var addToMeta = (metaArray, keyId, backgroundId, additionalFields) => {
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    );
    if (exactMatch) {
      exactMatch.backgroundIds.push(backgroundId);
    } else {
      metaArray.push({
        id: keyId,
        backgroundIds: [backgroundId],
        ...additionalFields
      });
    }
  } else {
    const existing = metaArray.find((m) => m.id === keyId);
    if (!existing) {
      metaArray.push({ id: keyId, backgroundIds: [backgroundId] });
    } else {
      existing.backgroundIds.push(backgroundId);
    }
  }
};

// lib/dnd5e2014/background/functions/listBackgroundsMasterMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vYmFja2dyb3VuZC9mdW5jdGlvbnMvdXRpbHMvdXRpbC50cyIsICIuLi9iYWNrZ3JvdW5kL2Z1bmN0aW9ucy9saXN0QmFja2dyb3VuZHNNYXN0ZXJNYXBwaW5nLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQVlPLElBQU0sV0FBcUI7QUFBQSxFQUNoQyxVQUFVLENBQUM7QUFDYjtBQUVPLElBQU0sY0FBYyxDQUFDLFVBQXdCO0FBQ2xELFFBQU0sSUFBSSxDQUFDLFNBQVM7QUFDbEIsUUFBSSxLQUFLLFlBQVksS0FBSyxTQUFTLFFBQVE7QUFDekMsV0FBSyxTQUFTLFFBQVEsQ0FBQyxZQUFZO0FBQ2pDLGtCQUFVLFNBQVMsVUFBVSxRQUFRLElBQUksS0FBSyxJQUFJO0FBQUEsVUFDaEQsT0FBTyxRQUFRO0FBQUEsUUFDakIsQ0FBQztBQUFBLE1BQ0gsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGLENBQUM7QUFDSDtBQUVPLElBQU0sWUFBWSxDQUN2QixXQUNBLE9BQ0EsY0FDQSxxQkFDRztBQUVILE1BQUksa0JBQWtCO0FBQ3BCLFVBQU0sYUFBYSxVQUFVO0FBQUEsTUFDM0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxTQUFTLE9BQU8sUUFBUSxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLEtBQUssTUFBTSxFQUFFLEdBQUcsTUFBTSxLQUFLO0FBQUEsSUFDcEc7QUFFQSxRQUFJLFlBQVk7QUFFZCxpQkFBVyxjQUFjLEtBQUssWUFBWTtBQUFBLElBQzVDLE9BQU87QUFFTCxnQkFBVSxLQUFLO0FBQUEsUUFDYixJQUFJO0FBQUEsUUFDSixlQUFlLENBQUMsWUFBWTtBQUFBLFFBQzVCLEdBQUc7QUFBQSxNQUNMLENBQW1CO0FBQUEsSUFDckI7QUFBQSxFQUNGLE9BQU87QUFFTCxVQUFNLFdBQVcsVUFBVSxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU8sS0FBSztBQUNyRCxRQUFJLENBQUMsVUFBVTtBQUNiLGdCQUFVLEtBQUssRUFBRSxJQUFJLE9BQU8sZUFBZSxDQUFDLFlBQVksRUFBRSxDQUFtQjtBQUFBLElBQy9FLE9BQU87QUFDTCxlQUFTLGNBQWMsS0FBSyxZQUFZO0FBQUEsSUFDMUM7QUFBQSxFQUNGO0FBQ0Y7OztBQ3pETyxTQUFTLFFBQVEsS0FBYztBQUNwQyxRQUFNLEVBQUUsUUFBUSxLQUFNLFVBQVUsSUFBSSxJQUFJO0FBRXhDLFNBQU87QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDRjtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsY0FBWSxLQUFLO0FBQ2pCLFNBQU87QUFBQSxJQUNMO0FBQUEsSUFDQTtBQUFBLElBQ0EsV0FBVyxJQUFJLE9BQU87QUFBQSxFQUN4QjtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
