// lib/dnd5e2014/generic/functions/getItemMapping.ts
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy9mdW5jdGlvbnMvZ2V0SXRlbU1hcHBpbmcudHMiXSwKICAibWFwcGluZ3MiOiAiO0FBQUEsU0FBa0IsWUFBWTtBQUV2QixTQUFTLFFBQVEsS0FBYztBQUNwQyxTQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWCxLQUFLLEtBQUssU0FBUyxZQUFZLEVBQUUsSUFBSSxJQUFJLEtBQUssR0FBRyxDQUFDO0FBQUEsRUFDcEQ7QUFDRjtBQUVPLFNBQVMsU0FBUyxLQUFjO0FBQ3JDLFNBQU8sSUFBSTtBQUNiOyIsCiAgIm5hbWVzIjogW10KfQo=
