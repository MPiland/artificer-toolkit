// lib/dnd5e2014/generic/utils/listSystemsMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const isAdmin = ctx.identity.claims && ctx.identity.claims["cognito:groups"] && ctx.identity.claims["cognito:groups"].includes("Admins");
  const ownerId = isAdmin ? "master" : ctx.identity.sub;
  const baseQuery = {
    operation: "Query",
    query: {
      expression: "ownerId = :ownerId",
      expressionValues: util.dynamodb.toMapValues({ ":ownerId": ownerId })
    },
    index: "ownerIndex"
  };
  return baseQuery;
}
function response(ctx) {
  return ctx.result;
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy91dGlscy9saXN0U3lzdGVtc01hcHBpbmcudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsU0FBMEMsWUFBWTtBQUcvQyxTQUFTLFFBQVEsS0FBcUQ7QUFFM0UsUUFBTSxVQUNKLElBQUksU0FBUyxVQUNiLElBQUksU0FBUyxPQUFPLGdCQUFnQixLQUNwQyxJQUFJLFNBQVMsT0FBTyxnQkFBZ0IsRUFBRSxTQUFTLFFBQVE7QUFFekQsUUFBTSxVQUFVLFVBQVUsV0FBVyxJQUFJLFNBQVM7QUFFbEQsUUFBTSxZQUFrQztBQUFBLElBQ3RDLFdBQVc7QUFBQSxJQUNYLE9BQU87QUFBQSxNQUNMLFlBQVk7QUFBQSxNQUNaLGtCQUFrQixLQUFLLFNBQVMsWUFBWSxFQUFFLFlBQVksUUFBUSxDQUFDO0FBQUEsSUFDckU7QUFBQSxJQUNBLE9BQU87QUFBQSxFQUNUO0FBRUEsU0FBTztBQUNUO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsU0FBTyxJQUFJO0FBQ2I7IiwKICAibmFtZXMiOiBbXQp9Cg==
