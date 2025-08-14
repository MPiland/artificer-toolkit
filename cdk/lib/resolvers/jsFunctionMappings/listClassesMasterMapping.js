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

// lib/schemas/class/functions/listClassesMasterMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9jbGFzcy9mdW5jdGlvbnMvdXRpbC50cyIsICIuLi8uLi9zY2hlbWFzL2NsYXNzL2Z1bmN0aW9ucy9saXN0Q2xhc3Nlc01hc3Rlck1hcHBpbmcudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBaUJPLElBQU0sV0FBcUI7QUFBQSxFQUNoQyxZQUFZLENBQUM7QUFBQSxFQUNiLGVBQWUsQ0FBQztBQUFBLEVBQ2hCLGtCQUFrQixDQUFDO0FBQUEsRUFDbkIsb0JBQW9CLENBQUM7QUFBQSxFQUNyQixtQkFBbUIsQ0FBQztBQUFBLEVBQ3BCLFVBQVUsQ0FBQztBQUNiO0FBRU8sSUFBTSxjQUFjLENBQUMsVUFDMUIsTUFBTSxJQUFJLENBQUMsU0FBUztBQUNsQixNQUFJLEtBQUssVUFBVTtBQUNqQixjQUFVLFNBQVMsWUFBWSxLQUFLLFVBQVUsS0FBSyxFQUFFO0FBQUEsRUFDdkQ7QUFDQSxNQUFJLEtBQUssYUFBYTtBQUNwQixjQUFVLFNBQVMsZUFBZSxLQUFLLGFBQWEsS0FBSyxFQUFFO0FBQUEsRUFDN0Q7QUFDQSxNQUFJLEtBQUssWUFBWSxrQkFBa0IsS0FBSyxZQUFZLGdCQUFnQixJQUFJO0FBQzFFLGNBQVUsU0FBUyxrQkFBa0IsS0FBSyxZQUFZLGdCQUFnQixJQUFJLEtBQUssSUFBSTtBQUFBLE1BQ2pGLFFBQVEsS0FBSyxZQUFZLGdCQUFnQjtBQUFBLElBQzNDLENBQUM7QUFBQSxFQUNIO0FBQ0EsTUFBSSxLQUFLLFlBQVksb0JBQW9CLEtBQUssWUFBWSxrQkFBa0IsSUFBSTtBQUM5RSxjQUFVLFNBQVMsb0JBQW9CLEtBQUssWUFBWSxrQkFBa0IsSUFBSSxLQUFLLElBQUk7QUFBQSxNQUNyRixRQUFRLEtBQUssWUFBWSxrQkFBa0I7QUFBQSxJQUM3QyxDQUFDO0FBQUEsRUFDSDtBQUNBLE1BQUksS0FBSyxZQUFZLG1CQUFtQixLQUFLLFlBQVksaUJBQWlCLElBQUk7QUFDNUUsY0FBVSxTQUFTLG1CQUFtQixLQUFLLFlBQVksaUJBQWlCLElBQUksS0FBSyxJQUFJO0FBQUEsTUFDbkYsUUFBUSxLQUFLLFlBQVksaUJBQWlCO0FBQUEsSUFDNUMsQ0FBQztBQUFBLEVBQ0g7QUFDQSxNQUFJLEtBQUssWUFBWSxLQUFLLFNBQVMsUUFBUTtBQUN6QyxTQUFLLFNBQVMsUUFBUSxDQUFDLFlBQVk7QUFDakMsVUFBSSxPQUFPLFlBQVksVUFBVTtBQUMvQixrQkFBVSxTQUFTLFVBQVUsUUFBUSxJQUFJLEtBQUssRUFBRTtBQUFBLE1BQ2xELE9BQU87QUFDTCxrQkFBVSxTQUFTLFVBQVUsU0FBUyxLQUFLLEVBQUU7QUFBQSxNQUMvQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFDRixDQUFDO0FBRUksSUFBTSxZQUFZLENBQ3ZCLFdBQ0EsT0FDQSxTQUNBLHFCQUNHO0FBRUgsTUFBSSxrQkFBa0I7QUFDcEIsVUFBTSxhQUFhLFVBQVU7QUFBQSxNQUMzQixDQUFDLE1BQU0sRUFBRSxPQUFPLFNBQVMsT0FBTyxRQUFRLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxDQUFDLEtBQUssS0FBSyxNQUFNLEVBQUUsR0FBRyxNQUFNLEtBQUs7QUFBQSxJQUNwRztBQUVBLFFBQUksWUFBWTtBQUVkLGlCQUFXLFNBQVMsS0FBSyxPQUFPO0FBQUEsSUFDbEMsT0FBTztBQUVMLGdCQUFVLEtBQUs7QUFBQSxRQUNiLElBQUk7QUFBQSxRQUNKLFVBQVUsQ0FBQyxPQUFPO0FBQUEsUUFDbEIsR0FBRztBQUFBLE1BQ0wsQ0FBbUI7QUFBQSxJQUNyQjtBQUFBLEVBQ0YsT0FBTztBQUVMLFVBQU0sV0FBVyxVQUFVLEtBQUssQ0FBQyxNQUFNLEVBQUUsT0FBTyxLQUFLO0FBQ3JELFFBQUksQ0FBQyxVQUFVO0FBQ2IsZ0JBQVUsS0FBSyxFQUFFLElBQUksT0FBTyxVQUFVLENBQUMsT0FBTyxFQUFFLENBQW1CO0FBQUEsSUFDckUsT0FBTztBQUNMLGVBQVMsU0FBUyxLQUFLLE9BQU87QUFBQSxJQUNoQztBQUFBLEVBQ0Y7QUFDRjs7O0FDekZPLFNBQVMsUUFBUSxLQUFjO0FBQ3BDLFFBQU0sRUFBRSxRQUFRLEtBQU0sVUFBVSxJQUFJLElBQUk7QUFFeEMsU0FBTztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1g7QUFBQSxJQUNBO0FBQUEsRUFDRjtBQUNGO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsUUFBTSxRQUFRLElBQUksT0FBTztBQUN6QixjQUFZLEtBQUs7QUFDakIsU0FBTztBQUFBLElBQ0w7QUFBQSxJQUNBO0FBQUEsSUFDQSxXQUFXLElBQUksT0FBTztBQUFBLEVBQ3hCO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
