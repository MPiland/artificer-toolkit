// lib/dnd5e2014/generic/utils/createItemMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  return {
    operation: "PutItem",
    key: util.dynamodb.toMapValues({ id: util.autoId() }),
    attributeValues: util.dynamodb.toMapValues({
      ...ctx.args.input,
      ownerId: ctx.identity.sub
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy91dGlscy9jcmVhdGVJdGVtTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxTQUEwQyxZQUFZO0FBRS9DLFNBQVMsUUFBUSxLQUFxRDtBQUMzRSxTQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWCxLQUFLLEtBQUssU0FBUyxZQUFZLEVBQUUsSUFBSSxLQUFLLE9BQU8sRUFBRSxDQUFDO0FBQUEsSUFDcEQsaUJBQWlCLEtBQUssU0FBUyxZQUFZO0FBQUEsTUFDekMsR0FBRyxJQUFJLEtBQUs7QUFBQSxNQUNaLFNBQVMsSUFBSSxTQUFTO0FBQUEsSUFDeEIsQ0FBQztBQUFBLEVBQ0g7QUFDRjtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFNBQU8sSUFBSTtBQUNiOyIsCiAgIm5hbWVzIjogW10KfQo=
