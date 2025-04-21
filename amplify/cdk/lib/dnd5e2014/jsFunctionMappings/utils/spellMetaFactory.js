// lib/dnd5e2014/spell/functions/utils/spellMetaFactory.ts
var addToMeta = (metaArray, keyId, spellId) => {
  const existing = metaArray.find((m) => m.id === keyId);
  if (!existing) {
    metaArray.push({ id: keyId, spellId: [spellId] });
  } else {
    existing.spellId.push(spellId);
  }
};
export {
  addToMeta
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc3BlbGwvZnVuY3Rpb25zL3V0aWxzL3NwZWxsTWV0YUZhY3RvcnkudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBa0JPLElBQU0sWUFBWSxDQUFDLFdBQXlCLE9BQXdCLFlBQW9CO0FBQzdGLFFBQU0sV0FBVyxVQUFVLEtBQUssQ0FBQyxNQUFNLEVBQUUsT0FBTyxLQUFLO0FBQ3JELE1BQUksQ0FBQyxVQUFVO0FBQ2IsY0FBVSxLQUFLLEVBQUUsSUFBSSxPQUFPLFNBQVMsQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUFBLEVBQ2xELE9BQU87QUFDTCxhQUFTLFFBQVEsS0FBSyxPQUFPO0FBQUEsRUFDL0I7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
