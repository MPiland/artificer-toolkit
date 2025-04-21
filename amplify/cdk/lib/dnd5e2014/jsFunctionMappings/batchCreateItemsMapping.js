// lib/dnd5e2014/generic/functions/batchCreateItemsMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy9mdW5jdGlvbnMvYmF0Y2hDcmVhdGVJdGVtc01hcHBpbmcudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBS0EsU0FBMEMsWUFBK0M7QUFFbEYsU0FBUyxRQUFRLEtBQXdGO0FBRTlHLFFBQU0sVUFDSixJQUFJLFNBQVMsVUFDYixJQUFJLFNBQVMsT0FBTyxnQkFBZ0IsS0FDcEMsSUFBSSxTQUFTLE9BQU8sZ0JBQWdCLEVBQUUsU0FBUyxRQUFRO0FBRXpELFFBQU0sVUFBVSxVQUFVLFdBQVcsSUFBSSxTQUFTO0FBRWxELFFBQU0sZ0JBQWdCLElBQUksS0FBSyxNQUFNLElBQUksQ0FBQyxVQUE0QjtBQUFBLElBQ3BFLE9BQU8sS0FBSztBQUFBLElBQ1osV0FBVztBQUFBLElBQ1gsaUJBQWlCLEtBQUssU0FBUyxZQUFZO0FBQUEsTUFDekMsR0FBRyxLQUFLO0FBQUEsTUFDUixJQUFJLEtBQUssT0FBTztBQUFBLE1BQ2hCLFdBQVcsS0FBSyxLQUFLLFdBQVc7QUFBQSxNQUNoQyxXQUFXLEtBQUssS0FBSyxXQUFXO0FBQUEsTUFDaEM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNILEVBQUU7QUFFRixTQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWDtBQUFBLEVBQ0Y7QUFDRjtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFNBQU8sSUFBSTtBQUNiOyIsCiAgIm5hbWVzIjogW10KfQo=
