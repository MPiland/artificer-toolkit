// lib/dnd5e2014/generic/functions/listItemsMasterMapping.ts
function request(ctx) {
  const { limit = 1e3, nextToken } = ctx.args;
  return {
    operation: "Scan",
    limit,
    nextToken
  };
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy9mdW5jdGlvbnMvbGlzdEl0ZW1zTWFzdGVyTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFFTyxTQUFTLFFBQVEsS0FBYztBQUNwQyxRQUFNLEVBQUUsUUFBUSxLQUFNLFVBQVUsSUFBSSxJQUFJO0FBRXhDLFNBQU87QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYO0FBQUEsSUFDQTtBQUFBLEVBQ0Y7QUFDRjtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFNBQU87QUFBQSxJQUNMLE9BQU8sSUFBSSxPQUFPO0FBQUEsSUFDbEIsV0FBVyxJQUFJLE9BQU87QUFBQSxFQUN4QjtBQUNGOyIsCiAgIm5hbWVzIjogW10KfQo=
