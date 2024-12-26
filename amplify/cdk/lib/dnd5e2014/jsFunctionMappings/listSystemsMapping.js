// lib/dnd5e2014/generic/utils/listSystemsMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const { limit, nextToken } = ctx.args;
  const baseQuery = {
    operation: "Query",
    query: {
      expression: "ownerId = :ownerId",
      expressionValues: util.dynamodb.toMapValues({ ":ownerId": ctx.identity.sub })
    },
    index: "ownerIndex"
  };
  if (limit) {
    baseQuery.limit = limit;
    if (nextToken) {
      baseQuery.nextToken = nextToken;
    }
  }
  return baseQuery;
}
function response(ctx) {
  const { items, nextToken } = ctx.result;
  return { items, nextToken };
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy91dGlscy9saXN0U3lzdGVtc01hcHBpbmcudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsU0FBMEMsWUFBWTtBQUcvQyxTQUFTLFFBQVEsS0FBcUQ7QUFDM0UsUUFBTSxFQUFFLE9BQU8sVUFBVSxJQUE4RCxJQUFJO0FBRTNGLFFBQU0sWUFBa0M7QUFBQSxJQUN0QyxXQUFXO0FBQUEsSUFDWCxPQUFPO0FBQUEsTUFDTCxZQUFZO0FBQUEsTUFDWixrQkFBa0IsS0FBSyxTQUFTLFlBQVksRUFBRSxZQUFZLElBQUksU0FBUyxJQUFJLENBQUM7QUFBQSxJQUM5RTtBQUFBLElBQ0EsT0FBTztBQUFBLEVBQ1Q7QUFFQSxNQUFJLE9BQU87QUFDVCxjQUFVLFFBQVE7QUFDbEIsUUFBSSxXQUFXO0FBQ2IsZ0JBQVUsWUFBWTtBQUFBLElBQ3hCO0FBQUEsRUFDRjtBQUVBLFNBQU87QUFDVDtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFFBQU0sRUFBRSxPQUFPLFVBQVUsSUFBSSxJQUFJO0FBQ2pDLFNBQU8sRUFBRSxPQUFPLFVBQVU7QUFDNUI7IiwKICAibmFtZXMiOiBbXQp9Cg==
