// lib/schemas/race/functions/listRacesMapping.ts
import { util } from "@aws-appsync/utils";

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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9yYWNlL2Z1bmN0aW9ucy9saXN0UmFjZXNNYXBwaW5nLnRzIiwgIi4uLy4uL3NjaGVtYXMvcmFjZS9mdW5jdGlvbnMvdXRpbC50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxTQUEwQyxZQUFZOzs7QUNXL0MsSUFBTSxXQUFxQjtBQUFBLEVBQ2hDLFlBQVksQ0FBQztBQUFBLEVBQ2IsVUFBVSxDQUFDO0FBQUEsRUFDWCxVQUFVLENBQUM7QUFBQSxFQUNYLFVBQVUsQ0FBQztBQUNiO0FBRU8sSUFBTSxjQUFjLENBQUMsVUFBa0I7QUFDNUMsUUFBTSxJQUFJLENBQUMsU0FBUztBQUNsQixRQUFJLEtBQUssVUFBVTtBQUNqQixnQkFBVSxTQUFTLFVBQVUsS0FBSyxVQUFVLEtBQUssRUFBRTtBQUFBLElBQ3JEO0FBQ0EsUUFBSSxLQUFLLFVBQVU7QUFDakIsZ0JBQVUsU0FBUyxZQUFZLEtBQUssVUFBVSxLQUFLLEVBQUU7QUFBQSxJQUN2RDtBQUNBLFFBQUksS0FBSyxVQUFVLFFBQVE7QUFDekIsV0FBSyxTQUFTLFFBQVEsQ0FBQyxZQUFZO0FBQ2pDLGtCQUFVLFNBQVMsVUFBVSxTQUFTLEtBQUssRUFBRTtBQUFBLE1BQy9DLENBQUM7QUFBQSxJQUNIO0FBQ0EsUUFBSSxLQUFLLFlBQVksS0FBSyxTQUFTLFFBQVE7QUFDekMsV0FBSyxTQUFTLFFBQVEsQ0FBQyxZQUFZO0FBQ2pDLFlBQUksT0FBTyxZQUFZLFVBQVU7QUFDL0Isb0JBQVUsU0FBUyxVQUFVLFFBQVEsSUFBSSxLQUFLLEVBQUU7QUFBQSxRQUNsRCxPQUFPO0FBQ0wsb0JBQVUsU0FBUyxVQUFVLFNBQVMsS0FBSyxFQUFFO0FBQUEsUUFDL0M7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQ0EsUUFBSSxLQUFLLFVBQVUsU0FBUyxRQUFRO0FBQ2xDLFdBQUssU0FBUyxRQUFRLFFBQVEsQ0FBQyxXQUFXO0FBQ3hDLFlBQUksT0FBTyxVQUFVLFFBQVE7QUFDM0IsaUJBQU8sU0FBUyxRQUFRLENBQUMsWUFBWTtBQUNuQyxnQkFBSSxPQUFPLFlBQVksVUFBVTtBQUMvQix3QkFBVSxTQUFTLFVBQVUsUUFBUSxJQUFJLE9BQU8sRUFBRTtBQUFBLFlBQ3BELE9BQU87QUFDTCx3QkFBVSxTQUFTLFVBQVUsU0FBUyxPQUFPLEVBQUU7QUFBQSxZQUNqRDtBQUFBLFVBQ0YsQ0FBQztBQUFBLFFBQ0g7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRixDQUFDO0FBQ0g7QUFFTyxJQUFNLFlBQVksQ0FDdkIsV0FDQSxPQUNBLFFBQ0EscUJBQ0c7QUFFSCxNQUFJLGtCQUFrQjtBQUNwQixVQUFNLGFBQWEsVUFBVTtBQUFBLE1BQzNCLENBQUMsTUFBTSxFQUFFLE9BQU8sU0FBUyxPQUFPLFFBQVEsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUMsS0FBSyxLQUFLLE1BQU0sRUFBRSxHQUFHLE1BQU0sS0FBSztBQUFBLElBQ3BHO0FBRUEsUUFBSSxZQUFZO0FBRWQsaUJBQVcsUUFBUSxLQUFLLE1BQU07QUFBQSxJQUNoQyxPQUFPO0FBRUwsZ0JBQVUsS0FBSztBQUFBLFFBQ2IsSUFBSTtBQUFBLFFBQ0osU0FBUyxDQUFDLE1BQU07QUFBQSxRQUNoQixHQUFHO0FBQUEsTUFDTCxDQUFtQjtBQUFBLElBQ3JCO0FBQUEsRUFDRixPQUFPO0FBRUwsVUFBTSxXQUFXLFVBQVUsS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPLEtBQUs7QUFDckQsUUFBSSxDQUFDLFVBQVU7QUFDYixnQkFBVSxLQUFLLEVBQUUsSUFBSSxPQUFPLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBbUI7QUFBQSxJQUNuRSxPQUFPO0FBQ0wsZUFBUyxRQUFRLEtBQUssTUFBTTtBQUFBLElBQzlCO0FBQUEsRUFDRjtBQUNGOzs7QURwRk8sU0FBUyxRQUFRLEtBQXFEO0FBQzNFLFFBQU0sRUFBRSxVQUFVLFFBQVEsS0FBTSxVQUFVLElBQThELElBQUk7QUFHNUcsUUFBTSxVQUFVLElBQUksU0FBUztBQUU3QixRQUFNLFlBQWtDO0FBQUEsSUFDdEMsV0FBVztBQUFBLElBQ1gsT0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEtBQUssU0FBUyxZQUFZLEVBQUUsWUFBWSxRQUFRLENBQUM7QUFBQSxJQUNyRTtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEtBQUssU0FBUyxZQUFZO0FBQUEsUUFDMUMsYUFBYTtBQUFBLE1BQ2YsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUNBLE9BQU87QUFBQSxJQUNQO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUNyQyxRQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3pCLGNBQVksS0FBSztBQUNqQixTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxJQUNBLFdBQVcsSUFBSSxPQUFPO0FBQUEsRUFDeEI7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
