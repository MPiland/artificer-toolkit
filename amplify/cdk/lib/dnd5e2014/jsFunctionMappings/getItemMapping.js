// lib/dnd5e2014/generic/utils/getItemMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  return {
    operation: "GetItem",
    key: util.dynamodb.toMapValues({ id: ctx.args.id })
  };
}
function response(ctx) {
  return ctx.result;
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy91dGlscy9nZXRJdGVtTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFBQSxTQUFrQixZQUFZO0FBRXZCLFNBQVMsUUFBUSxLQUFjO0FBQ3BDLFNBQU87QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYLEtBQUssS0FBSyxTQUFTLFlBQVksRUFBRSxJQUFJLElBQUksS0FBSyxHQUFHLENBQUM7QUFBQSxFQUNwRDtBQUNGO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsU0FBTyxJQUFJO0FBQ2I7IiwKICAibmFtZXMiOiBbXQp9Cg==
