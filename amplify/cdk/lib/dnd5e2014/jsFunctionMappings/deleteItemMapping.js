// lib/dnd5e2014/generic/functions/deleteItemMapping.ts
function request(ctx) {
  return {
    operation: "DeleteItem",
    key: {
      id: ctx.args.input.id
    }
  };
}
function response(ctx) {
  return ctx.args.input.id;
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy9mdW5jdGlvbnMvZGVsZXRlSXRlbU1hcHBpbmcudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBRU8sU0FBUyxRQUFRLEtBQWM7QUFDcEMsU0FBTztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1gsS0FBSztBQUFBLE1BQ0gsSUFBSSxJQUFJLEtBQUssTUFBTTtBQUFBLElBQ3JCO0FBQUEsRUFDRjtBQUNGO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsU0FBTyxJQUFJLEtBQUssTUFBTTtBQUN4QjsiLAogICJuYW1lcyI6IFtdCn0K
