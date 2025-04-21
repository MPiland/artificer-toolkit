// lib/dnd5e2014/generic/functions/createItemMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const isAdmin = ctx.identity.claims && ctx.identity.claims["cognito:groups"] && ctx.identity.claims["cognito:groups"].includes("Admins");
  const ownerId = isAdmin ? "master" : ctx.identity.sub;
  return {
    operation: "PutItem",
    key: util.dynamodb.toMapValues({ id: util.autoId() }),
    attributeValues: util.dynamodb.toMapValues({
      ...ctx.args.input,
      ownerId
    })
  };
}
function response(ctx) {
  return ctx.result;
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy9mdW5jdGlvbnMvY3JlYXRlSXRlbU1hcHBpbmcudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsU0FBMEMsWUFBWTtBQUUvQyxTQUFTLFFBQVEsS0FBcUQ7QUFFM0UsUUFBTSxVQUNKLElBQUksU0FBUyxVQUNiLElBQUksU0FBUyxPQUFPLGdCQUFnQixLQUNwQyxJQUFJLFNBQVMsT0FBTyxnQkFBZ0IsRUFBRSxTQUFTLFFBQVE7QUFFekQsUUFBTSxVQUFVLFVBQVUsV0FBVyxJQUFJLFNBQVM7QUFFbEQsU0FBTztBQUFBLElBQ0wsV0FBVztBQUFBLElBQ1gsS0FBSyxLQUFLLFNBQVMsWUFBWSxFQUFFLElBQUksS0FBSyxPQUFPLEVBQUUsQ0FBQztBQUFBLElBQ3BELGlCQUFpQixLQUFLLFNBQVMsWUFBWTtBQUFBLE1BQ3pDLEdBQUcsSUFBSSxLQUFLO0FBQUEsTUFDWjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFNBQU8sSUFBSTtBQUNiOyIsCiAgIm5hbWVzIjogW10KfQo=
