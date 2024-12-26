// lib/dnd5e2014/generic/utils/listItemsMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const { systemId } = ctx.args;
  const baseQuery = {
    operation: "Query",
    query: {
      expression: "ownerId = :ownerId",
      expressionValues: util.dynamodb.toMapValues({ ":ownerId": ctx.identity.sub })
    },
    filter: {
      expression: "systemId = :systemId",
      expressionValues: util.dynamodb.toMapValues({
        ":systemId": systemId
      })
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy91dGlscy9saXN0SXRlbXNNYXBwaW5nLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLFNBQTBDLFlBQVk7QUFHL0MsU0FBUyxRQUFRLEtBQXFEO0FBQzNFLFFBQU0sRUFBRSxTQUFTLElBQTBCLElBQUk7QUFFL0MsUUFBTSxZQUFrQztBQUFBLElBQ3RDLFdBQVc7QUFBQSxJQUNYLE9BQU87QUFBQSxNQUNMLFlBQVk7QUFBQSxNQUNaLGtCQUFrQixLQUFLLFNBQVMsWUFBWSxFQUFFLFlBQVksSUFBSSxTQUFTLElBQUksQ0FBQztBQUFBLElBQzlFO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixZQUFZO0FBQUEsTUFDWixrQkFBa0IsS0FBSyxTQUFTLFlBQVk7QUFBQSxRQUMxQyxhQUFhO0FBQUEsTUFDZixDQUFDO0FBQUEsSUFDSDtBQUFBLElBQ0EsT0FBTztBQUFBLEVBQ1Q7QUFFQSxTQUFPO0FBQ1Q7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUNyQyxTQUFPLElBQUk7QUFDYjsiLAogICJuYW1lcyI6IFtdCn0K
