// lib/dnd5e2014/equipment/functions/utils/equipmentMetaFactory.ts
var addToMeta = (metaArray, keyId, equipmentId) => {
  const existing = metaArray.find((m) => m.id === keyId);
  if (!existing) {
    metaArray.push({ id: keyId, equipmentId: [equipmentId] });
  } else {
    existing.equipmentId.push(equipmentId);
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
var createArrayHandler = (metaKey, getIds) => {
  return (item, metaData) => {
    const ids = getIds(item);
    if (Array.isArray(ids) && ids.length > 0) {
      if (!metaData[metaKey]) metaData[metaKey] = [];
      ids.forEach((id) => addToMeta(metaData[metaKey], id, item.id));
    }
  };
};
var metaHandlers = {
  categories: createSimpleHandler("categories", (item) => item.category),
  properties: createArrayHandler("properties", (item) => item.properties || []),
  primaryDamages: createSimpleHandler("primaryDamages", (item) => item.damage?.primary?.id),
  secondaryDamages: createSimpleHandler("secondaryDamages", (item) => item.damage?.secondary?.id),
  versatileDamages: createSimpleHandler("versatileDamages", (item) => item.damage?.versatile?.id),
  armorClasses: createSimpleHandler("armorClasses", (item) => item.armorClass)
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vZXF1aXBtZW50L2Z1bmN0aW9ucy91dGlscy9lcXVpcG1lbnRNZXRhRmFjdG9yeS50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFhTyxJQUFNLFlBQVksQ0FBQyxXQUF5QixPQUF3QixnQkFBd0I7QUFDakcsUUFBTSxXQUFXLFVBQVUsS0FBSyxDQUFDLE1BQU0sRUFBRSxPQUFPLEtBQUs7QUFDckQsTUFBSSxDQUFDLFVBQVU7QUFDYixjQUFVLEtBQUssRUFBRSxJQUFJLE9BQU8sYUFBYSxDQUFDLFdBQVcsRUFBRSxDQUFDO0FBQUEsRUFDMUQsT0FBTztBQUNMLGFBQVMsWUFBWSxLQUFLLFdBQVc7QUFBQSxFQUN2QztBQUNGO0FBS0EsSUFBTSxzQkFBc0IsQ0FDMUIsU0FDQSxVQUNvRDtBQUNwRCxTQUFPLENBQUMsTUFBTSxhQUFhO0FBQ3pCLFVBQU0sS0FBSyxNQUFNLElBQUk7QUFDckIsUUFBSSxPQUFPLFVBQWEsT0FBTyxNQUFNO0FBQ25DLFVBQUksQ0FBQyxTQUFTLE9BQU8sRUFBRyxVQUFTLE9BQU8sSUFBSSxDQUFDO0FBQzdDLGdCQUFVLFNBQVMsT0FBTyxHQUFHLElBQUksS0FBSyxFQUFFO0FBQUEsSUFDMUM7QUFBQSxFQUNGO0FBQ0Y7QUFJQSxJQUFNLHFCQUFxQixDQUN6QixTQUNBLFdBQ29EO0FBQ3BELFNBQU8sQ0FBQyxNQUFNLGFBQWE7QUFDekIsVUFBTSxNQUFNLE9BQU8sSUFBSTtBQUN2QixRQUFJLE1BQU0sUUFBUSxHQUFHLEtBQUssSUFBSSxTQUFTLEdBQUc7QUFDeEMsVUFBSSxDQUFDLFNBQVMsT0FBTyxFQUFHLFVBQVMsT0FBTyxJQUFJLENBQUM7QUFDN0MsVUFBSSxRQUFRLENBQUMsT0FBTyxVQUFVLFNBQVMsT0FBTyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7QUFBQSxJQUMvRDtBQUFBLEVBQ0Y7QUFDRjtBQUlPLElBQU0sZUFBc0Y7QUFBQSxFQUNqRyxZQUFZLG9CQUFvQixjQUFjLENBQUMsU0FBUyxLQUFLLFFBQVE7QUFBQSxFQUNyRSxZQUFZLG1CQUFtQixjQUFjLENBQUMsU0FBUyxLQUFLLGNBQWMsQ0FBQyxDQUFDO0FBQUEsRUFDNUUsZ0JBQWdCLG9CQUFvQixrQkFBa0IsQ0FBQyxTQUFTLEtBQUssUUFBUSxTQUFTLEVBQUU7QUFBQSxFQUN4RixrQkFBa0Isb0JBQW9CLG9CQUFvQixDQUFDLFNBQVMsS0FBSyxRQUFRLFdBQVcsRUFBRTtBQUFBLEVBQzlGLGtCQUFrQixvQkFBb0Isb0JBQW9CLENBQUMsU0FBUyxLQUFLLFFBQVEsV0FBVyxFQUFFO0FBQUEsRUFDOUYsY0FBYyxvQkFBb0IsZ0JBQWdCLENBQUMsU0FBUyxLQUFLLFVBQVU7QUFDN0U7QUFJTyxTQUFTLFlBQVksTUFBaUIsVUFBMEI7QUFDckUsYUFBVyxPQUFPLGNBQWM7QUFDOUIsaUJBQWEsR0FBcUIsRUFBRSxNQUFNLFFBQVE7QUFBQSxFQUNwRDtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
