// lib/dnd5e2014/race/functions/utils/raceMetaFactory.ts
var addToMeta = (metaArray, keyId, raceId) => {
  const existing = metaArray.find((m) => m.id === keyId);
  if (!existing) {
    metaArray.push({ id: keyId, raceId: [raceId] });
  } else {
    existing.raceId.push(raceId);
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
  playable: createSimpleHandler("playable", (item) => item.playable),
  lineages: createArrayHandler("lineages", (item) => item.lineages || [])
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vcmFjZS9mdW5jdGlvbnMvdXRpbHMvcmFjZU1ldGFGYWN0b3J5LnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQVVPLElBQU0sWUFBWSxDQUFDLFdBQXlCLE9BQXdCLFdBQW1CO0FBQzVGLFFBQU0sV0FBVyxVQUFVLEtBQUssQ0FBQyxNQUFNLEVBQUUsT0FBTyxLQUFLO0FBQ3JELE1BQUksQ0FBQyxVQUFVO0FBQ2IsY0FBVSxLQUFLLEVBQUUsSUFBSSxPQUFPLFFBQVEsQ0FBQyxNQUFNLEVBQUUsQ0FBQztBQUFBLEVBQ2hELE9BQU87QUFDTCxhQUFTLE9BQU8sS0FBSyxNQUFNO0FBQUEsRUFDN0I7QUFDRjtBQUtBLElBQU0sc0JBQXNCLENBQUMsU0FBeUIsVUFBZ0U7QUFDcEgsU0FBTyxDQUFDLE1BQU0sYUFBYTtBQUN6QixVQUFNLEtBQUssTUFBTSxJQUFJO0FBQ3JCLFFBQUksT0FBTyxVQUFhLE9BQU8sTUFBTTtBQUNuQyxVQUFJLENBQUMsU0FBUyxPQUFPLEVBQUcsVUFBUyxPQUFPLElBQUksQ0FBQztBQUM3QyxnQkFBVSxTQUFTLE9BQU8sR0FBRyxJQUFJLEtBQUssRUFBRTtBQUFBLElBQzFDO0FBQUEsRUFDRjtBQUNGO0FBSUEsSUFBTSxxQkFBcUIsQ0FDekIsU0FDQSxXQUMrQztBQUMvQyxTQUFPLENBQUMsTUFBTSxhQUFhO0FBQ3pCLFVBQU0sTUFBTSxPQUFPLElBQUk7QUFDdkIsUUFBSSxNQUFNLFFBQVEsR0FBRyxLQUFLLElBQUksU0FBUyxHQUFHO0FBQ3hDLFVBQUksQ0FBQyxTQUFTLE9BQU8sRUFBRyxVQUFTLE9BQU8sSUFBSSxDQUFDO0FBQzdDLFVBQUksUUFBUSxDQUFDLE9BQU8sVUFBVSxTQUFTLE9BQU8sR0FBRyxJQUFJLEtBQUssRUFBRSxDQUFDO0FBQUEsSUFDL0Q7QUFBQSxFQUNGO0FBQ0Y7QUFJTyxJQUFNLGVBQWlGO0FBQUEsRUFDNUYsWUFBWSxvQkFBb0IsY0FBYyxDQUFDLFNBQVMsS0FBSyxRQUFRO0FBQUEsRUFDckUsVUFBVSxvQkFBb0IsWUFBWSxDQUFDLFNBQVMsS0FBSyxRQUFRO0FBQUEsRUFDakUsVUFBVSxtQkFBbUIsWUFBWSxDQUFDLFNBQVMsS0FBSyxZQUFZLENBQUMsQ0FBQztBQUN4RTtBQUlPLFNBQVMsWUFBWSxNQUFZLFVBQTBCO0FBQ2hFLGFBQVcsT0FBTyxjQUFjO0FBQzlCLGlCQUFhLEdBQXFCLEVBQUUsTUFBTSxRQUFRO0FBQUEsRUFDcEQ7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
