// lib/schemas/feat/functions/listFeatsMapping.ts
import { util } from "@aws-appsync/utils";

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

// lib/schemas/feat/functions/listFeatsMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9mZWF0L2Z1bmN0aW9ucy9saXN0RmVhdHNNYXBwaW5nLnRzIiwgIi4uLy4uL3NjaGVtYXMvZmVhdC9mdW5jdGlvbnMvdXRpbC50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxTQUEwQyxZQUFZOzs7QUNRL0MsSUFBTSxXQUFxQjtBQUFBLEVBQ2hDLFVBQVUsQ0FBQztBQUNiO0FBRU8sSUFBTSxjQUFjLENBQUMsVUFBa0I7QUFDNUMsUUFBTSxJQUFJLENBQUMsU0FBUztBQUNsQixRQUFJLEtBQUssWUFBWSxLQUFLLFNBQVMsUUFBUTtBQUN6QyxXQUFLLFNBQVMsUUFBUSxDQUFDLFlBQVk7QUFDakMsWUFBSSxPQUFPLFlBQVksVUFBVTtBQUMvQixvQkFBVSxTQUFTLFVBQVUsUUFBUSxJQUFJLEtBQUssRUFBRTtBQUFBLFFBQ2xELE9BQU87QUFDTCxvQkFBVSxTQUFTLFVBQVUsU0FBUyxLQUFLLEVBQUU7QUFBQSxRQUMvQztBQUFBLE1BQ0YsQ0FBQztBQUFBLElBQ0g7QUFBQSxFQUNGLENBQUM7QUFDSDtBQUVPLElBQU0sWUFBWSxDQUN2QixXQUNBLE9BQ0EsUUFDQSxxQkFDRztBQUVILE1BQUksa0JBQWtCO0FBQ3BCLFVBQU0sYUFBYSxVQUFVO0FBQUEsTUFDM0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxTQUFTLE9BQU8sUUFBUSxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLEtBQUssTUFBTSxFQUFFLEdBQUcsTUFBTSxLQUFLO0FBQUEsSUFDcEc7QUFFQSxRQUFJLFlBQVk7QUFFZCxpQkFBVyxRQUFRLEtBQUssTUFBTTtBQUFBLElBQ2hDLE9BQU87QUFFTCxnQkFBVSxLQUFLO0FBQUEsUUFDYixJQUFJO0FBQUEsUUFDSixTQUFTLENBQUMsTUFBTTtBQUFBLFFBQ2hCLEdBQUc7QUFBQSxNQUNMLENBQW1CO0FBQUEsSUFDckI7QUFBQSxFQUNGLE9BQU87QUFFTCxVQUFNLFdBQVcsVUFBVSxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU8sS0FBSztBQUNyRCxRQUFJLENBQUMsVUFBVTtBQUNiLGdCQUFVLEtBQUssRUFBRSxJQUFJLE9BQU8sU0FBUyxDQUFDLE1BQU0sRUFBRSxDQUFtQjtBQUFBLElBQ25FLE9BQU87QUFDTCxlQUFTLFFBQVEsS0FBSyxNQUFNO0FBQUEsSUFDOUI7QUFBQSxFQUNGO0FBQ0Y7OztBRHRETyxTQUFTLFFBQVEsS0FBcUQ7QUFDM0UsUUFBTSxFQUFFLFVBQVUsUUFBUSxLQUFNLFVBQVUsSUFBOEQsSUFBSTtBQUc1RyxRQUFNLFVBQVUsSUFBSSxTQUFTO0FBRTdCLFFBQU0sWUFBa0M7QUFBQSxJQUN0QyxXQUFXO0FBQUEsSUFDWCxPQUFPO0FBQUEsTUFDTCxZQUFZO0FBQUEsTUFDWixrQkFBa0IsS0FBSyxTQUFTLFlBQVksRUFBRSxZQUFZLFFBQVEsQ0FBQztBQUFBLElBQ3JFO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixZQUFZO0FBQUEsTUFDWixrQkFBa0IsS0FBSyxTQUFTLFlBQVk7QUFBQSxRQUMxQyxhQUFhO0FBQUEsTUFDZixDQUFDO0FBQUEsSUFDSDtBQUFBLElBQ0EsT0FBTztBQUFBLElBQ1A7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUVBLFNBQU87QUFDVDtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsY0FBWSxLQUFLO0FBQ2pCLFNBQU87QUFBQSxJQUNMO0FBQUEsSUFDQTtBQUFBLElBQ0EsV0FBVyxJQUFJLE9BQU87QUFBQSxFQUN4QjtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
