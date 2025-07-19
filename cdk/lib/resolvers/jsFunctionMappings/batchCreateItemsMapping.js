// lib/schemas/generic/functions/batchCreateItemsMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const isAdmin = ctx.identity.claims && ctx.identity.claims["cognito:groups"] && ctx.identity.claims["cognito:groups"].includes("Admins");
  const ownerId = isAdmin ? "master" : ctx.identity.sub;
  const transactItems = ctx.args.input.map((item) => ({
    table: item.tableName,
    operation: "PutItem",
    attributeValues: util.dynamodb.toMapValues({
      ...item.data,
      id: util.autoId(),
      createdAt: util.time.nowISO8601(),
      updatedAt: util.time.nowISO8601(),
      ownerId
    })
  }));
  return {
    operation: "TransactWriteItems",
    transactItems
  };
}
function response(ctx) {
  return ctx.result;
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9nZW5lcmljL2Z1bmN0aW9ucy9iYXRjaENyZWF0ZUl0ZW1zTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFLQSxTQUEwQyxZQUErQztBQUVsRixTQUFTLFFBQVEsS0FBd0Y7QUFFOUcsUUFBTSxVQUNKLElBQUksU0FBUyxVQUNiLElBQUksU0FBUyxPQUFPLGdCQUFnQixLQUNwQyxJQUFJLFNBQVMsT0FBTyxnQkFBZ0IsRUFBRSxTQUFTLFFBQVE7QUFFekQsUUFBTSxVQUFVLFVBQVUsV0FBVyxJQUFJLFNBQVM7QUFFbEQsUUFBTSxnQkFBZ0IsSUFBSSxLQUFLLE1BQU0sSUFBSSxDQUFDLFVBQTRCO0FBQUEsSUFDcEUsT0FBTyxLQUFLO0FBQUEsSUFDWixXQUFXO0FBQUEsSUFDWCxpQkFBaUIsS0FBSyxTQUFTLFlBQVk7QUFBQSxNQUN6QyxHQUFHLEtBQUs7QUFBQSxNQUNSLElBQUksS0FBSyxPQUFPO0FBQUEsTUFDaEIsV0FBVyxLQUFLLEtBQUssV0FBVztBQUFBLE1BQ2hDLFdBQVcsS0FBSyxLQUFLLFdBQVc7QUFBQSxNQUNoQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0gsRUFBRTtBQUVGLFNBQU87QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYO0FBQUEsRUFDRjtBQUNGO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsU0FBTyxJQUFJO0FBQ2I7IiwKICAibmFtZXMiOiBbXQp9Cg==
