// lib/schemas/generic/functions/createItemMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9nZW5lcmljL2Z1bmN0aW9ucy9jcmVhdGVJdGVtTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxTQUEwQyxZQUFZO0FBRS9DLFNBQVMsUUFBUSxLQUFxRDtBQUUzRSxRQUFNLFVBQ0osSUFBSSxTQUFTLFVBQ2IsSUFBSSxTQUFTLE9BQU8sZ0JBQWdCLEtBQ3BDLElBQUksU0FBUyxPQUFPLGdCQUFnQixFQUFFLFNBQVMsUUFBUTtBQUV6RCxRQUFNLFVBQVUsVUFBVSxXQUFXLElBQUksU0FBUztBQUVsRCxTQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWCxLQUFLLEtBQUssU0FBUyxZQUFZLEVBQUUsSUFBSSxLQUFLLE9BQU8sRUFBRSxDQUFDO0FBQUEsSUFDcEQsaUJBQWlCLEtBQUssU0FBUyxZQUFZO0FBQUEsTUFDekMsR0FBRyxJQUFJLEtBQUs7QUFBQSxNQUNaO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDSDtBQUNGO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsU0FBTyxJQUFJO0FBQ2I7IiwKICAibmFtZXMiOiBbXQp9Cg==
