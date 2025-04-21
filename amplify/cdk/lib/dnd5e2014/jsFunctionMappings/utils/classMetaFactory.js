// lib/dnd5e2014/class/functions/utils/classMetaFactory.ts
var addToMeta = (metaArray, keyId, classId) => {
  const existing = metaArray.find((m) => m.id === keyId);
  if (!existing) {
    metaArray.push({ id: keyId, classId: [classId] });
  } else {
    existing.classId.push(classId);
  }
};
var createSimpleHandler = (metaKey, getId) => {
  return (item, metaData) => {
    const id = getId(item);
    if (id !== void 0 && id !== null) {
      if (!metaData[metaKey]) metaData[metaKey] = [];
      addToMeta(metaData[metaKey], id, item.id);
    }
  };
};
var metaHandlers = {
  categories: createSimpleHandler("categories", (item) => item.category),
  parentClasses: createSimpleHandler("parentClasses", (item) => item.parentClass)
};
function processItem(item, metaData) {
  for (const key in metaHandlers) {
    metaHandlers[key](item, metaData);
  }
}
export {
  addToMeta,
  metaHandlers,
  processItem
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vY2xhc3MvZnVuY3Rpb25zL3V0aWxzL2NsYXNzTWV0YUZhY3RvcnkudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBU08sSUFBTSxZQUFZLENBQUMsV0FBeUIsT0FBd0IsWUFBb0I7QUFDN0YsUUFBTSxXQUFXLFVBQVUsS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPLEtBQUs7QUFDckQsTUFBSSxDQUFDLFVBQVU7QUFDYixjQUFVLEtBQUssRUFBRSxJQUFJLE9BQU8sU0FBUyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQUEsRUFDbEQsT0FBTztBQUNMLGFBQVMsUUFBUSxLQUFLLE9BQU87QUFBQSxFQUMvQjtBQUNGO0FBS0EsSUFBTSxzQkFBc0IsQ0FDMUIsU0FDQSxVQUNnRDtBQUNoRCxTQUFPLENBQUMsTUFBTSxhQUFhO0FBQ3pCLFVBQU0sS0FBSyxNQUFNLElBQUk7QUFDckIsUUFBSSxPQUFPLFVBQWEsT0FBTyxNQUFNO0FBQ25DLFVBQUksQ0FBQyxTQUFTLE9BQU8sRUFBRyxVQUFTLE9BQU8sSUFBSSxDQUFDO0FBQzdDLGdCQUFVLFNBQVMsT0FBTyxHQUFHLElBQUksS0FBSyxFQUFFO0FBQUEsSUFDMUM7QUFBQSxFQUNGO0FBQ0Y7QUFJTyxJQUFNLGVBQWtGO0FBQUEsRUFDN0YsWUFBWSxvQkFBb0IsY0FBYyxDQUFDLFNBQVMsS0FBSyxRQUFRO0FBQUEsRUFDckUsZUFBZSxvQkFBb0IsaUJBQWlCLENBQUMsU0FBUyxLQUFLLFdBQVc7QUFDaEY7QUFJTyxTQUFTLFlBQVksTUFBYSxVQUEwQjtBQUNqRSxhQUFXLE9BQU8sY0FBYztBQUM5QixpQkFBYSxHQUFxQixFQUFFLE1BQU0sUUFBUTtBQUFBLEVBQ3BEO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
