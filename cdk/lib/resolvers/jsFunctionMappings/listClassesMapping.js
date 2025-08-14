// lib/schemas/class/functions/listClassesMapping.ts
import { util } from "@aws-appsync/utils";

// lib/schemas/class/functions/util.ts
var metaData = {
  categories: [],
  parentClasses: [],
  primaryAbilities: [],
  secondaryAbilities: [],
  optionalAbilities: [],
  features: []
};
var itemsToMeta = (items) => items.map((item) => {
  if (item.category) {
    addToMeta(metaData.categories, item.category, item.id);
  }
  if (item.parentClass) {
    addToMeta(metaData.parentClasses, item.parentClass, item.id);
  }
  if (item.multiclass?.primaryAbility && item.multiclass?.primaryAbility?.id) {
    addToMeta(metaData.primaryAbilities, item.multiclass?.primaryAbility?.id, item.id, {
      amount: item.multiclass?.primaryAbility?.minAmount
    });
  }
  if (item.multiclass?.secondaryAbility && item.multiclass?.secondaryAbility?.id) {
    addToMeta(metaData.secondaryAbilities, item.multiclass?.secondaryAbility?.id, item.id, {
      amount: item.multiclass?.secondaryAbility?.minAmount
    });
  }
  if (item.multiclass?.optionalAbility && item.multiclass?.optionalAbility?.id) {
    addToMeta(metaData.optionalAbilities, item.multiclass?.optionalAbility?.id, item.id, {
      amount: item.multiclass?.optionalAbility?.minAmount
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
});
var addToMeta = (metaArray, keyId, classId, additionalFields) => {
  if (additionalFields) {
    const exactMatch = metaArray.find(
      (m) => m.id === keyId && Object.entries(additionalFields).every(([key, value]) => m[key] === value)
    );
    if (exactMatch) {
      exactMatch.classIds.push(classId);
    } else {
      metaArray.push({
        id: keyId,
        classIds: [classId],
        ...additionalFields
      });
    }
  } else {
    const existing = metaArray.find((m) => m.id === keyId);
    if (!existing) {
      metaArray.push({ id: keyId, classIds: [classId] });
    } else {
      existing.classIds.push(classId);
    }
  }
};

// lib/schemas/class/functions/listClassesMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9jbGFzcy9mdW5jdGlvbnMvbGlzdENsYXNzZXNNYXBwaW5nLnRzIiwgIi4uLy4uL3NjaGVtYXMvY2xhc3MvZnVuY3Rpb25zL3V0aWwudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsU0FBMEMsWUFBWTs7O0FDaUIvQyxJQUFNLFdBQXFCO0FBQUEsRUFDaEMsWUFBWSxDQUFDO0FBQUEsRUFDYixlQUFlLENBQUM7QUFBQSxFQUNoQixrQkFBa0IsQ0FBQztBQUFBLEVBQ25CLG9CQUFvQixDQUFDO0FBQUEsRUFDckIsbUJBQW1CLENBQUM7QUFBQSxFQUNwQixVQUFVLENBQUM7QUFDYjtBQUVPLElBQU0sY0FBYyxDQUFDLFVBQzFCLE1BQU0sSUFBSSxDQUFDLFNBQVM7QUFDbEIsTUFBSSxLQUFLLFVBQVU7QUFDakIsY0FBVSxTQUFTLFlBQVksS0FBSyxVQUFVLEtBQUssRUFBRTtBQUFBLEVBQ3ZEO0FBQ0EsTUFBSSxLQUFLLGFBQWE7QUFDcEIsY0FBVSxTQUFTLGVBQWUsS0FBSyxhQUFhLEtBQUssRUFBRTtBQUFBLEVBQzdEO0FBQ0EsTUFBSSxLQUFLLFlBQVksa0JBQWtCLEtBQUssWUFBWSxnQkFBZ0IsSUFBSTtBQUMxRSxjQUFVLFNBQVMsa0JBQWtCLEtBQUssWUFBWSxnQkFBZ0IsSUFBSSxLQUFLLElBQUk7QUFBQSxNQUNqRixRQUFRLEtBQUssWUFBWSxnQkFBZ0I7QUFBQSxJQUMzQyxDQUFDO0FBQUEsRUFDSDtBQUNBLE1BQUksS0FBSyxZQUFZLG9CQUFvQixLQUFLLFlBQVksa0JBQWtCLElBQUk7QUFDOUUsY0FBVSxTQUFTLG9CQUFvQixLQUFLLFlBQVksa0JBQWtCLElBQUksS0FBSyxJQUFJO0FBQUEsTUFDckYsUUFBUSxLQUFLLFlBQVksa0JBQWtCO0FBQUEsSUFDN0MsQ0FBQztBQUFBLEVBQ0g7QUFDQSxNQUFJLEtBQUssWUFBWSxtQkFBbUIsS0FBSyxZQUFZLGlCQUFpQixJQUFJO0FBQzVFLGNBQVUsU0FBUyxtQkFBbUIsS0FBSyxZQUFZLGlCQUFpQixJQUFJLEtBQUssSUFBSTtBQUFBLE1BQ25GLFFBQVEsS0FBSyxZQUFZLGlCQUFpQjtBQUFBLElBQzVDLENBQUM7QUFBQSxFQUNIO0FBQ0EsTUFBSSxLQUFLLFlBQVksS0FBSyxTQUFTLFFBQVE7QUFDekMsU0FBSyxTQUFTLFFBQVEsQ0FBQyxZQUFZO0FBQ2pDLFVBQUksT0FBTyxZQUFZLFVBQVU7QUFDL0Isa0JBQVUsU0FBUyxVQUFVLFFBQVEsSUFBSSxLQUFLLEVBQUU7QUFBQSxNQUNsRCxPQUFPO0FBQ0wsa0JBQVUsU0FBUyxVQUFVLFNBQVMsS0FBSyxFQUFFO0FBQUEsTUFDL0M7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNIO0FBQ0YsQ0FBQztBQUVJLElBQU0sWUFBWSxDQUN2QixXQUNBLE9BQ0EsU0FDQSxxQkFDRztBQUVILE1BQUksa0JBQWtCO0FBQ3BCLFVBQU0sYUFBYSxVQUFVO0FBQUEsTUFDM0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxTQUFTLE9BQU8sUUFBUSxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLEtBQUssTUFBTSxFQUFFLEdBQUcsTUFBTSxLQUFLO0FBQUEsSUFDcEc7QUFFQSxRQUFJLFlBQVk7QUFFZCxpQkFBVyxTQUFTLEtBQUssT0FBTztBQUFBLElBQ2xDLE9BQU87QUFFTCxnQkFBVSxLQUFLO0FBQUEsUUFDYixJQUFJO0FBQUEsUUFDSixVQUFVLENBQUMsT0FBTztBQUFBLFFBQ2xCLEdBQUc7QUFBQSxNQUNMLENBQW1CO0FBQUEsSUFDckI7QUFBQSxFQUNGLE9BQU87QUFFTCxVQUFNLFdBQVcsVUFBVSxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU8sS0FBSztBQUNyRCxRQUFJLENBQUMsVUFBVTtBQUNiLGdCQUFVLEtBQUssRUFBRSxJQUFJLE9BQU8sVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFtQjtBQUFBLElBQ3JFLE9BQU87QUFDTCxlQUFTLFNBQVMsS0FBSyxPQUFPO0FBQUEsSUFDaEM7QUFBQSxFQUNGO0FBQ0Y7OztBRHhGTyxTQUFTLFFBQVEsS0FBcUQ7QUFDM0UsUUFBTSxFQUFFLFVBQVUsUUFBUSxLQUFNLFVBQVUsSUFBOEQsSUFBSTtBQUc1RyxRQUFNLFVBQVUsSUFBSSxTQUFTO0FBRTdCLFFBQU0sWUFBa0M7QUFBQSxJQUN0QyxXQUFXO0FBQUEsSUFDWCxPQUFPO0FBQUEsTUFDTCxZQUFZO0FBQUEsTUFDWixrQkFBa0IsS0FBSyxTQUFTLFlBQVksRUFBRSxZQUFZLFFBQVEsQ0FBQztBQUFBLElBQ3JFO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixZQUFZO0FBQUEsTUFDWixrQkFBa0IsS0FBSyxTQUFTLFlBQVk7QUFBQSxRQUMxQyxhQUFhO0FBQUEsTUFDZixDQUFDO0FBQUEsSUFDSDtBQUFBLElBQ0EsT0FBTztBQUFBLElBQ1A7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUVBLFNBQU87QUFDVDtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsY0FBWSxLQUFLO0FBQ2pCLFNBQU87QUFBQSxJQUNMO0FBQUEsSUFDQTtBQUFBLElBQ0EsV0FBVyxJQUFJLE9BQU87QUFBQSxFQUN4QjtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
