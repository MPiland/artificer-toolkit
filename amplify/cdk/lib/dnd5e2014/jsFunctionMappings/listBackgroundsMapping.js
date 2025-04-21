// lib/dnd5e2014/background/functions/listBackgroundsMapping.ts
import { util } from "@aws-appsync/utils";

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

// lib/dnd5e2014/background/functions/listBackgroundsMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vYmFja2dyb3VuZC9mdW5jdGlvbnMvbGlzdEJhY2tncm91bmRzTWFwcGluZy50cyIsICIuLi9iYWNrZ3JvdW5kL2Z1bmN0aW9ucy91dGlscy91dGlsLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLFNBQTBDLFlBQVk7OztBQ1kvQyxJQUFNLFdBQXFCO0FBQUEsRUFDaEMsVUFBVSxDQUFDO0FBQ2I7QUFFTyxJQUFNLGNBQWMsQ0FBQyxVQUF3QjtBQUNsRCxRQUFNLElBQUksQ0FBQyxTQUFTO0FBQ2xCLFFBQUksS0FBSyxZQUFZLEtBQUssU0FBUyxRQUFRO0FBQ3pDLFdBQUssU0FBUyxRQUFRLENBQUMsWUFBWTtBQUNqQyxrQkFBVSxTQUFTLFVBQVUsUUFBUSxJQUFJLEtBQUssSUFBSTtBQUFBLFVBQ2hELE9BQU8sUUFBUTtBQUFBLFFBQ2pCLENBQUM7QUFBQSxNQUNILENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRixDQUFDO0FBQ0g7QUFFTyxJQUFNLFlBQVksQ0FDdkIsV0FDQSxPQUNBLGNBQ0EscUJBQ0c7QUFFSCxNQUFJLGtCQUFrQjtBQUNwQixVQUFNLGFBQWEsVUFBVTtBQUFBLE1BQzNCLENBQUMsTUFBTSxFQUFFLE9BQU8sU0FBUyxPQUFPLFFBQVEsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUMsS0FBSyxLQUFLLE1BQU0sRUFBRSxHQUFHLE1BQU0sS0FBSztBQUFBLElBQ3BHO0FBRUEsUUFBSSxZQUFZO0FBRWQsaUJBQVcsY0FBYyxLQUFLLFlBQVk7QUFBQSxJQUM1QyxPQUFPO0FBRUwsZ0JBQVUsS0FBSztBQUFBLFFBQ2IsSUFBSTtBQUFBLFFBQ0osZUFBZSxDQUFDLFlBQVk7QUFBQSxRQUM1QixHQUFHO0FBQUEsTUFDTCxDQUFtQjtBQUFBLElBQ3JCO0FBQUEsRUFDRixPQUFPO0FBRUwsVUFBTSxXQUFXLFVBQVUsS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPLEtBQUs7QUFDckQsUUFBSSxDQUFDLFVBQVU7QUFDYixnQkFBVSxLQUFLLEVBQUUsSUFBSSxPQUFPLGVBQWUsQ0FBQyxZQUFZLEVBQUUsQ0FBbUI7QUFBQSxJQUMvRSxPQUFPO0FBQ0wsZUFBUyxjQUFjLEtBQUssWUFBWTtBQUFBLElBQzFDO0FBQUEsRUFDRjtBQUNGOzs7QUR4RE8sU0FBUyxRQUFRLEtBQXFEO0FBQzNFLFFBQU0sRUFBRSxVQUFVLFFBQVEsS0FBTSxVQUFVLElBQThELElBQUk7QUFHNUcsUUFBTSxVQUFVLElBQUksU0FBUztBQUU3QixRQUFNLFlBQWtDO0FBQUEsSUFDdEMsV0FBVztBQUFBLElBQ1gsT0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEtBQUssU0FBUyxZQUFZLEVBQUUsWUFBWSxRQUFRLENBQUM7QUFBQSxJQUNyRTtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEtBQUssU0FBUyxZQUFZO0FBQUEsUUFDMUMsYUFBYTtBQUFBLE1BQ2YsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUNBLE9BQU87QUFBQSxJQUNQO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUNyQyxRQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3pCLGNBQVksS0FBSztBQUNqQixTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxJQUNBLFdBQVcsSUFBSSxPQUFPO0FBQUEsRUFDeEI7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
