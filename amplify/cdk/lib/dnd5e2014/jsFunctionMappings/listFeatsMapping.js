// lib/dnd5e2014/feat/functions/listFeatsMapping.ts
import { util } from "@aws-appsync/utils";

// lib/dnd5e2014/feat/functions/utils/util.ts
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

// lib/dnd5e2014/feat/functions/listFeatsMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZmVhdC9mdW5jdGlvbnMvbGlzdEZlYXRzTWFwcGluZy50cyIsICIuLi9mZWF0L2Z1bmN0aW9ucy91dGlscy91dGlsLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLFNBQTBDLFlBQVk7OztBQ1kvQyxJQUFNLFdBQXFCO0FBQUEsRUFDaEMsVUFBVSxDQUFDO0FBQ2I7QUFFTyxJQUFNLGNBQWMsQ0FBQyxVQUFrQjtBQUM1QyxRQUFNLElBQUksQ0FBQyxTQUFTO0FBQ2xCLFFBQUksS0FBSyxZQUFZLEtBQUssU0FBUyxRQUFRO0FBQ3pDLFdBQUssU0FBUyxRQUFRLENBQUMsWUFBWTtBQUNqQyxrQkFBVSxTQUFTLFVBQVUsUUFBUSxJQUFJLEtBQUssSUFBSTtBQUFBLFVBQ2hELE9BQU8sUUFBUTtBQUFBLFFBQ2pCLENBQUM7QUFBQSxNQUNILENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRixDQUFDO0FBQ0g7QUFFTyxJQUFNLFlBQVksQ0FDdkIsV0FDQSxPQUNBLFFBQ0EscUJBQ0c7QUFFSCxNQUFJLGtCQUFrQjtBQUNwQixVQUFNLGFBQWEsVUFBVTtBQUFBLE1BQzNCLENBQUMsTUFBTSxFQUFFLE9BQU8sU0FBUyxPQUFPLFFBQVEsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUMsS0FBSyxLQUFLLE1BQU0sRUFBRSxHQUFHLE1BQU0sS0FBSztBQUFBLElBQ3BHO0FBRUEsUUFBSSxZQUFZO0FBRWQsaUJBQVcsUUFBUSxLQUFLLE1BQU07QUFBQSxJQUNoQyxPQUFPO0FBRUwsZ0JBQVUsS0FBSztBQUFBLFFBQ2IsSUFBSTtBQUFBLFFBQ0osU0FBUyxDQUFDLE1BQU07QUFBQSxRQUNoQixHQUFHO0FBQUEsTUFDTCxDQUFtQjtBQUFBLElBQ3JCO0FBQUEsRUFDRixPQUFPO0FBRUwsVUFBTSxXQUFXLFVBQVUsS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPLEtBQUs7QUFDckQsUUFBSSxDQUFDLFVBQVU7QUFDYixnQkFBVSxLQUFLLEVBQUUsSUFBSSxPQUFPLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBbUI7QUFBQSxJQUNuRSxPQUFPO0FBQ0wsZUFBUyxRQUFRLEtBQUssTUFBTTtBQUFBLElBQzlCO0FBQUEsRUFDRjtBQUNGOzs7QUR4RE8sU0FBUyxRQUFRLEtBQXFEO0FBQzNFLFFBQU0sRUFBRSxVQUFVLFFBQVEsS0FBTSxVQUFVLElBQThELElBQUk7QUFHNUcsUUFBTSxVQUFVLElBQUksU0FBUztBQUU3QixRQUFNLFlBQWtDO0FBQUEsSUFDdEMsV0FBVztBQUFBLElBQ1gsT0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEtBQUssU0FBUyxZQUFZLEVBQUUsWUFBWSxRQUFRLENBQUM7QUFBQSxJQUNyRTtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEtBQUssU0FBUyxZQUFZO0FBQUEsUUFDMUMsYUFBYTtBQUFBLE1BQ2YsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUNBLE9BQU87QUFBQSxJQUNQO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUNyQyxRQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3pCLGNBQVksS0FBSztBQUNqQixTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxJQUNBLFdBQVcsSUFBSSxPQUFPO0FBQUEsRUFDeEI7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
