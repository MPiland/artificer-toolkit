// lib/dnd5e2014/generic/functions/listItemsMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const { systemId, limit = 1e3, nextToken } = ctx.args;
  const ownerId = ctx.identity.sub;
  const baseQuery = {
    operation: "Query",
    query: {
      expression: "ownerId = :ownerId",
      expressionValues: util.dynamodb.toMapValues({ ":ownerId": ownerId })
    },
    filter: {
      expression: "systemId = :systemId",
      expressionValues: util.dynamodb.toMapValues({
        ":systemId": systemId
      })
    },
    index: "ownerIndex",
    limit,
    nextToken
  };
  return baseQuery;
}
function response(ctx) {
  return {
    items: ctx.result.items,
    nextToken: ctx.result.nextToken
  };
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy9mdW5jdGlvbnMvbGlzdEl0ZW1zTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxTQUEwQyxZQUFZO0FBRy9DLFNBQVMsUUFBUSxLQUFxRDtBQUMzRSxRQUFNLEVBQUUsVUFBVSxRQUFRLEtBQU0sVUFBVSxJQUE4RCxJQUFJO0FBRzVHLFFBQU0sVUFBVSxJQUFJLFNBQVM7QUFFN0IsUUFBTSxZQUFrQztBQUFBLElBQ3RDLFdBQVc7QUFBQSxJQUNYLE9BQU87QUFBQSxNQUNMLFlBQVk7QUFBQSxNQUNaLGtCQUFrQixLQUFLLFNBQVMsWUFBWSxFQUFFLFlBQVksUUFBUSxDQUFDO0FBQUEsSUFDckU7QUFBQSxJQUNBLFFBQVE7QUFBQSxNQUNOLFlBQVk7QUFBQSxNQUNaLGtCQUFrQixLQUFLLFNBQVMsWUFBWTtBQUFBLFFBQzFDLGFBQWE7QUFBQSxNQUNmLENBQUM7QUFBQSxJQUNIO0FBQUEsSUFDQSxPQUFPO0FBQUEsSUFDUDtBQUFBLElBQ0E7QUFBQSxFQUNGO0FBRUEsU0FBTztBQUNUO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsU0FBTztBQUFBLElBQ0wsT0FBTyxJQUFJLE9BQU87QUFBQSxJQUNsQixXQUFXLElBQUksT0FBTztBQUFBLEVBQ3hCO0FBQ0Y7IiwKICAibmFtZXMiOiBbXQp9Cg==
