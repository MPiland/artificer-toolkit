// lib/schemas/generic/functions/deleteItemMapping.ts
function request(ctx) {
  return {
    operation: "DeleteItem",
    key: {
      id: ctx.args.input.id
    }
  };
}
function response(ctx) {
  return ctx.args.input.id;
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vLi4vc2NoZW1hcy9nZW5lcmljL2Z1bmN0aW9ucy9kZWxldGVJdGVtTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFFTyxTQUFTLFFBQVEsS0FBYztBQUNwQyxTQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWCxLQUFLO0FBQUEsTUFDSCxJQUFJLElBQUksS0FBSyxNQUFNO0FBQUEsSUFDckI7QUFBQSxFQUNGO0FBQ0Y7QUFFTyxTQUFTLFNBQVMsS0FBYztBQUNyQyxTQUFPLElBQUksS0FBSyxNQUFNO0FBQ3hCOyIsCiAgIm5hbWVzIjogW10KfQo=
