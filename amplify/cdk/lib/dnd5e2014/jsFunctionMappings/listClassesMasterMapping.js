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

// lib/dnd5e2014/class/functions/listClassesMasterMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vY2xhc3MvZnVuY3Rpb25zL3V0aWxzL3V0aWwudHMiLCAiLi4vY2xhc3MvZnVuY3Rpb25zL2xpc3RDbGFzc2VzTWFzdGVyTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFxQk8sSUFBTSxXQUFxQjtBQUFBLEVBQ2hDLFlBQVksQ0FBQztBQUFBLEVBQ2IsZUFBZSxDQUFDO0FBQUEsRUFDaEIsa0JBQWtCLENBQUM7QUFBQSxFQUNuQixvQkFBb0IsQ0FBQztBQUFBLEVBQ3JCLG1CQUFtQixDQUFDO0FBQUEsRUFDcEIsVUFBVSxDQUFDO0FBQ2I7QUFFTyxJQUFNLGNBQWMsQ0FBQyxVQUMxQixNQUFNLElBQUksQ0FBQyxTQUFTO0FBQ2xCLE1BQUksS0FBSyxVQUFVO0FBQ2pCLGNBQVUsU0FBUyxZQUFZLEtBQUssVUFBVSxLQUFLLEVBQUU7QUFBQSxFQUN2RDtBQUNBLE1BQUksS0FBSyxhQUFhO0FBQ3BCLGNBQVUsU0FBUyxlQUFlLEtBQUssYUFBYSxLQUFLLEVBQUU7QUFBQSxFQUM3RDtBQUNBLE1BQUksS0FBSyxZQUFZLGtCQUFrQixLQUFLLFlBQVksZ0JBQWdCLElBQUk7QUFDMUUsY0FBVSxTQUFTLGtCQUFrQixLQUFLLFlBQVksZ0JBQWdCLElBQUksS0FBSyxJQUFJO0FBQUEsTUFDakYsUUFBUSxLQUFLLFlBQVksZ0JBQWdCO0FBQUEsSUFDM0MsQ0FBQztBQUFBLEVBQ0g7QUFDQSxNQUFJLEtBQUssWUFBWSxvQkFBb0IsS0FBSyxZQUFZLGtCQUFrQixJQUFJO0FBQzlFLGNBQVUsU0FBUyxvQkFBb0IsS0FBSyxZQUFZLGtCQUFrQixJQUFJLEtBQUssSUFBSTtBQUFBLE1BQ3JGLFFBQVEsS0FBSyxZQUFZLGtCQUFrQjtBQUFBLElBQzdDLENBQUM7QUFBQSxFQUNIO0FBQ0EsTUFBSSxLQUFLLFlBQVksbUJBQW1CLEtBQUssWUFBWSxpQkFBaUIsSUFBSTtBQUM1RSxjQUFVLFNBQVMsbUJBQW1CLEtBQUssWUFBWSxpQkFBaUIsSUFBSSxLQUFLLElBQUk7QUFBQSxNQUNuRixRQUFRLEtBQUssWUFBWSxpQkFBaUI7QUFBQSxJQUM1QyxDQUFDO0FBQUEsRUFDSDtBQUNBLE1BQUksS0FBSyxZQUFZLEtBQUssU0FBUyxRQUFRO0FBQ3pDLFNBQUssU0FBUyxRQUFRLENBQUMsWUFBWTtBQUNqQyxnQkFBVSxTQUFTLFVBQVUsUUFBUSxJQUFJLEtBQUssSUFBSTtBQUFBLFFBQ2hELE9BQU8sUUFBUTtBQUFBLE1BQ2pCLENBQUM7QUFBQSxJQUNILENBQUM7QUFBQSxFQUNIO0FBQ0YsQ0FBQztBQUVJLElBQU0sWUFBWSxDQUN2QixXQUNBLE9BQ0EsU0FDQSxxQkFDRztBQUVILE1BQUksa0JBQWtCO0FBQ3BCLFVBQU0sYUFBYSxVQUFVO0FBQUEsTUFDM0IsQ0FBQyxNQUFNLEVBQUUsT0FBTyxTQUFTLE9BQU8sUUFBUSxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsQ0FBQyxLQUFLLEtBQUssTUFBTSxFQUFFLEdBQUcsTUFBTSxLQUFLO0FBQUEsSUFDcEc7QUFFQSxRQUFJLFlBQVk7QUFFZCxpQkFBVyxTQUFTLEtBQUssT0FBTztBQUFBLElBQ2xDLE9BQU87QUFFTCxnQkFBVSxLQUFLO0FBQUEsUUFDYixJQUFJO0FBQUEsUUFDSixVQUFVLENBQUMsT0FBTztBQUFBLFFBQ2xCLEdBQUc7QUFBQSxNQUNMLENBQW1CO0FBQUEsSUFDckI7QUFBQSxFQUNGLE9BQU87QUFFTCxVQUFNLFdBQVcsVUFBVSxLQUFLLENBQUMsTUFBTSxFQUFFLE9BQU8sS0FBSztBQUNyRCxRQUFJLENBQUMsVUFBVTtBQUNiLGdCQUFVLEtBQUssRUFBRSxJQUFJLE9BQU8sVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFtQjtBQUFBLElBQ3JFLE9BQU87QUFDTCxlQUFTLFNBQVMsS0FBSyxPQUFPO0FBQUEsSUFDaEM7QUFBQSxFQUNGO0FBQ0Y7OztBQzNGTyxTQUFTLFFBQVEsS0FBYztBQUNwQyxRQUFNLEVBQUUsUUFBUSxLQUFNLFVBQVUsSUFBSSxJQUFJO0FBRXhDLFNBQU87QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDRjtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFFBQU0sUUFBUSxJQUFJLE9BQU87QUFDekIsY0FBWSxLQUFLO0FBQ2pCLFNBQU87QUFBQSxJQUNMO0FBQUEsSUFDQTtBQUFBLElBQ0EsV0FBVyxJQUFJLE9BQU87QUFBQSxFQUN4QjtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
