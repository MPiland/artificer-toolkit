// lib/dnd5e2014/generic/utils/batchCreateItemsMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const transactItems = ctx.args.input.map((item) => ({
    table: item.tableName,
    operation: "PutItem",
    attributeValues: util.dynamodb.toMapValues({
      ...item.data,
      id: util.autoId(),
      createdAt: util.time.nowISO8601(),
      updatedAt: util.time.nowISO8601(),
      ownerId: ctx.identity.sub
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy91dGlscy9iYXRjaENyZWF0ZUl0ZW1zTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFLQSxTQUEwQyxZQUErQztBQUVsRixTQUFTLFFBQVEsS0FBd0Y7QUFDOUcsUUFBTSxnQkFBZ0IsSUFBSSxLQUFLLE1BQU0sSUFBSSxDQUFDLFVBQTRCO0FBQUEsSUFDcEUsT0FBTyxLQUFLO0FBQUEsSUFDWixXQUFXO0FBQUEsSUFDWCxpQkFBaUIsS0FBSyxTQUFTLFlBQVk7QUFBQSxNQUN6QyxHQUFHLEtBQUs7QUFBQSxNQUNSLElBQUksS0FBSyxPQUFPO0FBQUEsTUFDaEIsV0FBVyxLQUFLLEtBQUssV0FBVztBQUFBLE1BQ2hDLFdBQVcsS0FBSyxLQUFLLFdBQVc7QUFBQSxNQUNoQyxTQUFTLElBQUksU0FBUztBQUFBLElBQ3hCLENBQUM7QUFBQSxFQUNILEVBQUU7QUFFRixTQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFDRjtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFNBQU8sSUFBSTtBQUNiOyIsCiAgIm5hbWVzIjogW10KfQo=
