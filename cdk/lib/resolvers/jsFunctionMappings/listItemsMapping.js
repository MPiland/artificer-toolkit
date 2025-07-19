// lib/schemas/generic/functions/listItemsMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9nZW5lcmljL2Z1bmN0aW9ucy9saXN0SXRlbXNNYXBwaW5nLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLFNBQTBDLFlBQVk7QUFHL0MsU0FBUyxRQUFRLEtBQXFEO0FBQzNFLFFBQU0sRUFBRSxVQUFVLFFBQVEsS0FBTSxVQUFVLElBQThELElBQUk7QUFHNUcsUUFBTSxVQUFVLElBQUksU0FBUztBQUU3QixRQUFNLFlBQWtDO0FBQUEsSUFDdEMsV0FBVztBQUFBLElBQ1gsT0FBTztBQUFBLE1BQ0wsWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEtBQUssU0FBUyxZQUFZLEVBQUUsWUFBWSxRQUFRLENBQUM7QUFBQSxJQUNyRTtBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ04sWUFBWTtBQUFBLE1BQ1osa0JBQWtCLEtBQUssU0FBUyxZQUFZO0FBQUEsUUFDMUMsYUFBYTtBQUFBLE1BQ2YsQ0FBQztBQUFBLElBQ0g7QUFBQSxJQUNBLE9BQU87QUFBQSxJQUNQO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFFQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUNyQyxTQUFPO0FBQUEsSUFDTCxPQUFPLElBQUksT0FBTztBQUFBLElBQ2xCLFdBQVcsSUFBSSxPQUFPO0FBQUEsRUFDeEI7QUFDRjsiLAogICJuYW1lcyI6IFtdCn0K
