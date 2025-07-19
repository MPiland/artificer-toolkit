// lib/schemas/generic/functions/updateItemMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const input = ctx.args.input;
  return {
    operation: "PutItem",
    key: util.dynamodb.toMapValues({ id: input.id }),
    attributeValues: util.dynamodb.toMapValues(input),
    condition: {
      expression: "attribute_exists(id)"
    }
  };
}
function response(ctx) {
  if (ctx.error) {
    if (ctx.error.message && ctx.error.message.includes("ConditionalCheckFailedException")) {
      util.error("Item does not exist", "ConditionError");
    }
    util.error(ctx.error.message || "Unknown error occurred", ctx.error.type || "InternalError");
  }
  return ctx.result;
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9nZW5lcmljL2Z1bmN0aW9ucy91cGRhdGVJdGVtTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLFlBQVk7QUFFZCxTQUFTLFFBQVEsS0FBYztBQUNwQyxRQUFNLFFBQVEsSUFBSSxLQUFLO0FBRXZCLFNBQU87QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYLEtBQUssS0FBSyxTQUFTLFlBQVksRUFBRSxJQUFJLE1BQU0sR0FBRyxDQUFDO0FBQUEsSUFDL0MsaUJBQWlCLEtBQUssU0FBUyxZQUFZLEtBQUs7QUFBQSxJQUNoRCxXQUFXO0FBQUEsTUFDVCxZQUFZO0FBQUEsSUFDZDtBQUFBLEVBQ0Y7QUFDRjtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBRXJDLE1BQUksSUFBSSxPQUFPO0FBRWIsUUFBSSxJQUFJLE1BQU0sV0FBVyxJQUFJLE1BQU0sUUFBUSxTQUFTLGlDQUFpQyxHQUFHO0FBQ3RGLFdBQUssTUFBTSx1QkFBdUIsZ0JBQWdCO0FBQUEsSUFDcEQ7QUFHQSxTQUFLLE1BQU0sSUFBSSxNQUFNLFdBQVcsMEJBQTBCLElBQUksTUFBTSxRQUFRLGVBQWU7QUFBQSxFQUM3RjtBQUVBLFNBQU8sSUFBSTtBQUNiOyIsCiAgIm5hbWVzIjogW10KfQo=
