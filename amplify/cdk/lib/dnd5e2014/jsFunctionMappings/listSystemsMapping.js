// lib/dnd5e2014/generic/functions/listSystemsMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const isAdmin = ctx.identity.claims && ctx.identity.claims["cognito:groups"] && ctx.identity.claims["cognito:groups"].includes("Admins");
  const ownerId = isAdmin ? "master" : ctx.identity.sub;
  const baseQuery = {
    operation: "Query",
    query: {
      expression: "ownerId = :ownerId",
      expressionValues: util.dynamodb.toMapValues({ ":ownerId": ownerId })
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy9mdW5jdGlvbnMvbGlzdFN5c3RlbXNNYXBwaW5nLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFBLFNBQTBDLFlBQVk7QUFHL0MsU0FBUyxRQUFRLEtBQXFEO0FBRTNFLFFBQU0sVUFDSixJQUFJLFNBQVMsVUFDYixJQUFJLFNBQVMsT0FBTyxnQkFBZ0IsS0FDcEMsSUFBSSxTQUFTLE9BQU8sZ0JBQWdCLEVBQUUsU0FBUyxRQUFRO0FBRXpELFFBQU0sVUFBVSxVQUFVLFdBQVcsSUFBSSxTQUFTO0FBRWxELFFBQU0sWUFBa0M7QUFBQSxJQUN0QyxXQUFXO0FBQUEsSUFDWCxPQUFPO0FBQUEsTUFDTCxZQUFZO0FBQUEsTUFDWixrQkFBa0IsS0FBSyxTQUFTLFlBQVksRUFBRSxZQUFZLFFBQVEsQ0FBQztBQUFBLElBQ3JFO0FBQUEsSUFDQSxPQUFPO0FBQUEsRUFDVDtBQUVBLFNBQU87QUFDVDtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFNBQU8sSUFBSTtBQUNiOyIsCiAgIm5hbWVzIjogW10KfQo=
