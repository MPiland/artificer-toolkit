// lib/schemas/race/functions/listRacesMapping.ts
import { util } from "@aws-appsync/utils";

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

// lib/schemas/race/functions/listRacesMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9yYWNlL2Z1bmN0aW9ucy9saXN0UmFjZXNNYXBwaW5nLnRzIiwgIi4uLy4uL3NjaGVtYXMvcmFjZS9mdW5jdGlvbnMvdXRpbHMvdXRpbC50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxTQUEwQyxZQUFZOzs7QUNXL0MsSUFBTSxXQUFxQjtBQUFBLEVBQ2hDLFlBQVksQ0FBQztBQUFBLEVBQ2IsVUFBVSxDQUFDO0FBQUEsRUFDWCxVQUFVLENBQUM7QUFBQSxFQUNYLFVBQVUsQ0FBQztBQUNiO0FBRU8sSUFBTSxjQUFjLENBQUMsVUFBa0I7QUFDNUMsUUFBTSxJQUFJLENBQUMsU0FBUztBQUNsQixRQUFJLEtBQUssVUFBVTtBQUNqQixnQkFBVSxTQUFTLFVBQVUsS0FBSyxVQUFVLEtBQUssRUFBRTtBQUFBLElBQ3JEO0FBQ0EsUUFBSSxLQUFLLFVBQVU7QUFDakIsZ0JBQVUsU0FBUyxZQUFZLEtBQUssVUFBVSxLQUFLLEVBQUU7QUFBQSxJQUN2RDtBQUNBLFFBQUksS0FBSyxVQUFVLFFBQVE7QUFDekIsV0FBSyxTQUFTLFFBQVEsQ0FBQyxZQUFZO0FBQ2pDLGtCQUFVLFNBQVMsVUFBVSxTQUFTLEtBQUssRUFBRTtBQUFBLE1BQy9DLENBQUM7QUFBQSxJQUNIO0FBQ0EsUUFBSSxLQUFLLFlBQVksS0FBSyxTQUFTLFFBQVE7QUFDekMsV0FBSyxTQUFTLFFBQVEsQ0FBQyxZQUFZO0FBQ2pDLGtCQUFVLFNBQVMsVUFBVSxTQUFTLEtBQUssRUFBRTtBQUFBLE1BQy9DLENBQUM7QUFBQSxJQUNIO0FBQ0EsUUFBSSxLQUFLLFVBQVUsU0FBUyxRQUFRO0FBQ2xDLFdBQUssU0FBUyxRQUFRLFFBQVEsQ0FBQyxXQUFXO0FBQ3hDLFlBQUksT0FBTyxVQUFVLFFBQVE7QUFDM0IsaUJBQU8sU0FBUyxRQUFRLENBQUMsWUFBWTtBQUNuQyxzQkFBVSxTQUFTLFVBQVUsU0FBUyxPQUFPLEVBQUU7QUFBQSxVQUNqRCxDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGLENBQUM7QUFDSDtBQUVPLElBQU0sWUFBWSxDQUN2QixXQUNBLE9BQ0EsUUFDQSxxQkFDRztBQUVILE1BQUksa0JBQWtCO0FBQ3BCLFVBQU0sYUFBYSxVQUFVO0FBQUEsTUFDM0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxTQUFTLE9BQU8sUUFBUSxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLEtBQUssTUFBTSxFQUFFLEdBQUcsTUFBTSxLQUFLO0FBQUEsSUFDcEc7QUFFQSxRQUFJLFlBQVk7QUFFZCxpQkFBVyxRQUFRLEtBQUssTUFBTTtBQUFBLElBQ2hDLE9BQU87QUFFTCxnQkFBVSxLQUFLO0FBQUEsUUFDYixJQUFJO0FBQUEsUUFDSixTQUFTLENBQUMsTUFBTTtBQUFBLFFBQ2hCLEdBQUc7QUFBQSxNQUNMLENBQW1CO0FBQUEsSUFDckI7QUFBQSxFQUNGLE9BQU87QUFFTCxVQUFNLFdBQVcsVUFBVSxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU8sS0FBSztBQUNyRCxRQUFJLENBQUMsVUFBVTtBQUNiLGdCQUFVLEtBQUssRUFBRSxJQUFJLE9BQU8sU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFtQjtBQUFBLElBQ25FLE9BQU87QUFDTCxlQUFTLFFBQVEsS0FBSyxNQUFNO0FBQUEsSUFDOUI7QUFBQSxFQUNGO0FBQ0Y7OztBRDVFTyxTQUFTLFFBQVEsS0FBcUQ7QUFDM0UsUUFBTSxFQUFFLFVBQVUsUUFBUSxLQUFNLFVBQVUsSUFBOEQsSUFBSTtBQUc1RyxRQUFNLFVBQVUsSUFBSSxTQUFTO0FBRTdCLFFBQU0sWUFBa0M7QUFBQSxJQUN0QyxXQUFXO0FBQUEsSUFDWCxPQUFPO0FBQUEsTUFDTCxZQUFZO0FBQUEsTUFDWixrQkFBa0IsS0FBSyxTQUFTLFlBQVksRUFBRSxZQUFZLFFBQVEsQ0FBQztBQUFBLElBQ3JFO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixZQUFZO0FBQUEsTUFDWixrQkFBa0IsS0FBSyxTQUFTLFlBQVk7QUFBQSxRQUMxQyxhQUFhO0FBQUEsTUFDZixDQUFDO0FBQUEsSUFDSDtBQUFBLElBQ0EsT0FBTztBQUFBLElBQ1A7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUVBLFNBQU87QUFDVDtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsY0FBWSxLQUFLO0FBQ2pCLFNBQU87QUFBQSxJQUNMO0FBQUEsSUFDQTtBQUFBLElBQ0EsV0FBVyxJQUFJLE9BQU87QUFBQSxFQUN4QjtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
