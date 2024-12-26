// lib/dnd5e2014/generic/utils/listItemsMasterMapping.ts
function request(ctx) {
  return {
    operation: "Scan",
    limit: ctx.args.limit || 1e3,
    nextToken: ctx.args.nextToken
  };
}
function response(ctx) {
  return ctx.result.items;
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy91dGlscy9saXN0SXRlbXNNYXN0ZXJNYXBwaW5nLnRzIl0sCiAgIm1hcHBpbmdzIjogIjtBQUVPLFNBQVMsUUFBUSxLQUFjO0FBQ3BDLFNBQU87QUFBQSxJQUNMLFdBQVc7QUFBQSxJQUNYLE9BQU8sSUFBSSxLQUFLLFNBQVM7QUFBQSxJQUN6QixXQUFXLElBQUksS0FBSztBQUFBLEVBQ3RCO0FBQ0Y7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUNyQyxTQUFPLElBQUksT0FBTztBQUNwQjsiLAogICJuYW1lcyI6IFtdCn0K
