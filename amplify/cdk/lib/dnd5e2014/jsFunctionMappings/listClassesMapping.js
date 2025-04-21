// lib/dnd5e2014/class/functions/listClassesMapping.ts
import { util } from "@aws-appsync/utils";

// lib/dnd5e2014/class/functions/utils/util.ts
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
      addToMeta(metaData.features, feature.id, item.id, {
        label: feature.label
      });
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

// lib/dnd5e2014/class/functions/listClassesMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vY2xhc3MvZnVuY3Rpb25zL2xpc3RDbGFzc2VzTWFwcGluZy50cyIsICIuLi9jbGFzcy9mdW5jdGlvbnMvdXRpbHMvdXRpbC50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxTQUEwQyxZQUFZOzs7QUNxQi9DLElBQU0sV0FBcUI7QUFBQSxFQUNoQyxZQUFZLENBQUM7QUFBQSxFQUNiLGVBQWUsQ0FBQztBQUFBLEVBQ2hCLGtCQUFrQixDQUFDO0FBQUEsRUFDbkIsb0JBQW9CLENBQUM7QUFBQSxFQUNyQixtQkFBbUIsQ0FBQztBQUFBLEVBQ3BCLFVBQVUsQ0FBQztBQUNiO0FBRU8sSUFBTSxjQUFjLENBQUMsVUFDMUIsTUFBTSxJQUFJLENBQUMsU0FBUztBQUNsQixNQUFJLEtBQUssVUFBVTtBQUNqQixjQUFVLFNBQVMsWUFBWSxLQUFLLFVBQVUsS0FBSyxFQUFFO0FBQUEsRUFDdkQ7QUFDQSxNQUFJLEtBQUssYUFBYTtBQUNwQixjQUFVLFNBQVMsZUFBZSxLQUFLLGFBQWEsS0FBSyxFQUFFO0FBQUEsRUFDN0Q7QUFDQSxNQUFJLEtBQUssWUFBWSxrQkFBa0IsS0FBSyxZQUFZLGdCQUFnQixJQUFJO0FBQzFFLGNBQVUsU0FBUyxrQkFBa0IsS0FBSyxZQUFZLGdCQUFnQixJQUFJLEtBQUssSUFBSTtBQUFBLE1BQ2pGLFFBQVEsS0FBSyxZQUFZLGdCQUFnQjtBQUFBLElBQzNDLENBQUM7QUFBQSxFQUNIO0FBQ0EsTUFBSSxLQUFLLFlBQVksb0JBQW9CLEtBQUssWUFBWSxrQkFBa0IsSUFBSTtBQUM5RSxjQUFVLFNBQVMsb0JBQW9CLEtBQUssWUFBWSxrQkFBa0IsSUFBSSxLQUFLLElBQUk7QUFBQSxNQUNyRixRQUFRLEtBQUssWUFBWSxrQkFBa0I7QUFBQSxJQUM3QyxDQUFDO0FBQUEsRUFDSDtBQUNBLE1BQUksS0FBSyxZQUFZLG1CQUFtQixLQUFLLFlBQVksaUJBQWlCLElBQUk7QUFDNUUsY0FBVSxTQUFTLG1CQUFtQixLQUFLLFlBQVksaUJBQWlCLElBQUksS0FBSyxJQUFJO0FBQUEsTUFDbkYsUUFBUSxLQUFLLFlBQVksaUJBQWlCO0FBQUEsSUFDNUMsQ0FBQztBQUFBLEVBQ0g7QUFDQSxNQUFJLEtBQUssWUFBWSxLQUFLLFNBQVMsUUFBUTtBQUN6QyxTQUFLLFNBQVMsUUFBUSxDQUFDLFlBQVk7QUFDakMsZ0JBQVUsU0FBUyxVQUFVLFFBQVEsSUFBSSxLQUFLLElBQUk7QUFBQSxRQUNoRCxPQUFPLFFBQVE7QUFBQSxNQUNqQixDQUFDO0FBQUEsSUFDSCxDQUFDO0FBQUEsRUFDSDtBQUNGLENBQUM7QUFFSSxJQUFNLFlBQVksQ0FDdkIsV0FDQSxPQUNBLFNBQ0EscUJBQ0c7QUFFSCxNQUFJLGtCQUFrQjtBQUNwQixVQUFNLGFBQWEsVUFBVTtBQUFBLE1BQzNCLENBQUMsTUFBTSxFQUFFLE9BQU8sU0FBUyxPQUFPLFFBQVEsZ0JBQWdCLEVBQUUsTUFBTSxDQUFDLENBQUMsS0FBSyxLQUFLLE1BQU0sRUFBRSxHQUFHLE1BQU0sS0FBSztBQUFBLElBQ3BHO0FBRUEsUUFBSSxZQUFZO0FBRWQsaUJBQVcsU0FBUyxLQUFLLE9BQU87QUFBQSxJQUNsQyxPQUFPO0FBRUwsZ0JBQVUsS0FBSztBQUFBLFFBQ2IsSUFBSTtBQUFBLFFBQ0osVUFBVSxDQUFDLE9BQU87QUFBQSxRQUNsQixHQUFHO0FBQUEsTUFDTCxDQUFtQjtBQUFBLElBQ3JCO0FBQUEsRUFDRixPQUFPO0FBRUwsVUFBTSxXQUFXLFVBQVUsS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPLEtBQUs7QUFDckQsUUFBSSxDQUFDLFVBQVU7QUFDYixnQkFBVSxLQUFLLEVBQUUsSUFBSSxPQUFPLFVBQVUsQ0FBQyxPQUFPLEVBQUUsQ0FBbUI7QUFBQSxJQUNyRSxPQUFPO0FBQ0wsZUFBUyxTQUFTLEtBQUssT0FBTztBQUFBLElBQ2hDO0FBQUEsRUFDRjtBQUNGOzs7QUQxRk8sU0FBUyxRQUFRLEtBQXFEO0FBQzNFLFFBQU0sRUFBRSxVQUFVLFFBQVEsS0FBTSxVQUFVLElBQThELElBQUk7QUFHNUcsUUFBTSxVQUFVLElBQUksU0FBUztBQUU3QixRQUFNLFlBQWtDO0FBQUEsSUFDdEMsV0FBVztBQUFBLElBQ1gsT0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEtBQUssU0FBUyxZQUFZLEVBQUUsWUFBWSxRQUFRLENBQUM7QUFBQSxJQUNyRTtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEtBQUssU0FBUyxZQUFZO0FBQUEsUUFDMUMsYUFBYTtBQUFBLE1BQ2YsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUNBLE9BQU87QUFBQSxJQUNQO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUNyQyxRQUFNLFFBQVEsSUFBSSxPQUFPO0FBQ3pCLGNBQVksS0FBSztBQUNqQixTQUFPO0FBQUEsSUFDTDtBQUFBLElBQ0E7QUFBQSxJQUNBLFdBQVcsSUFBSSxPQUFPO0FBQUEsRUFDeEI7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
