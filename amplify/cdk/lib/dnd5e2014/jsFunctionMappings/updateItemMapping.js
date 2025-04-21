// lib/dnd5e2014/generic/functions/updateItemMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const input = ctx.args.input;
  console.log("Processing update for item:", input.id);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy9mdW5jdGlvbnMvdXBkYXRlSXRlbU1hcHBpbmcudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBQ0EsU0FBUyxZQUFZO0FBRWQsU0FBUyxRQUFRLEtBQWM7QUFDcEMsUUFBTSxRQUFRLElBQUksS0FBSztBQUd2QixVQUFRLElBQUksK0JBQStCLE1BQU0sRUFBRTtBQUVuRCxTQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWCxLQUFLLEtBQUssU0FBUyxZQUFZLEVBQUUsSUFBSSxNQUFNLEdBQUcsQ0FBQztBQUFBLElBQy9DLGlCQUFpQixLQUFLLFNBQVMsWUFBWSxLQUFLO0FBQUEsSUFDaEQsV0FBVztBQUFBLE1BQ1QsWUFBWTtBQUFBLElBQ2Q7QUFBQSxFQUNGO0FBQ0Y7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUVyQyxNQUFJLElBQUksT0FBTztBQUViLFFBQUksSUFBSSxNQUFNLFdBQVcsSUFBSSxNQUFNLFFBQVEsU0FBUyxpQ0FBaUMsR0FBRztBQUN0RixXQUFLLE1BQU0sdUJBQXVCLGdCQUFnQjtBQUFBLElBQ3BEO0FBR0EsU0FBSyxNQUFNLElBQUksTUFBTSxXQUFXLDBCQUEwQixJQUFJLE1BQU0sUUFBUSxlQUFlO0FBQUEsRUFDN0Y7QUFFQSxTQUFPLElBQUk7QUFDYjsiLAogICJuYW1lcyI6IFtdCn0K
