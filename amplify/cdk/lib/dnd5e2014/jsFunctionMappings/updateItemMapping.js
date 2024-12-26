// lib/dnd5e2014/generic/utils/updateItemMapping.ts
import { util } from "@aws-appsync/utils";
function request(ctx) {
  const { id, ...values } = ctx.args.input;
  const condition = {
    id: { attributeExists: true }
  };
  return dynamodbUpdateRequest({ keys: { id }, values, condition });
}
function dynamodbUpdateRequest(params) {
  const { keys, values, condition: inCondObj } = params;
  const sets = [];
  const removes = [];
  const expressionNames = {};
  const expValues = {};
  for (const [key, value] of Object.entries(values)) {
    expressionNames[`#${key}`] = key;
    if (value) {
      sets.push(`#${key} = :${key}`);
      expValues[`:${key}`] = value;
    } else {
      removes.push(`#${key}`);
    }
  }
  let expression = sets.length ? `SET ${sets.join(", ")}` : "";
  expression += removes.length ? ` REMOVE ${removes.join(", ")}` : "";
  const condition = JSON.parse(util.transform.toDynamoDBConditionExpression(inCondObj));
  return {
    operation: "UpdateItem",
    key: util.dynamodb.toMapValues(keys),
    condition,
    update: {
      expression,
      expressionNames,
      expressionValues: util.dynamodb.toMapValues(expValues)
    }
  };
}
function response(ctx) {
  return ctx.result;
}
export {
  request,
  response
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vZ2VuZXJpYy91dGlscy91cGRhdGVJdGVtTWFwcGluZy50cyJdLAogICJtYXBwaW5ncyI6ICI7QUFDQSxTQUFTLFlBQVk7QUFFZCxTQUFTLFFBQVEsS0FBYztBQUNwQyxRQUFNLEVBQUUsSUFBSSxHQUFHLE9BQU8sSUFBSSxJQUFJLEtBQUs7QUFFbkMsUUFBTSxZQUFZO0FBQUEsSUFDaEIsSUFBSSxFQUFFLGlCQUFpQixLQUFLO0FBQUEsRUFDOUI7QUFDQSxTQUFPLHNCQUFzQixFQUFFLE1BQU0sRUFBRSxHQUFHLEdBQUcsUUFBUSxVQUFVLENBQUM7QUFDbEU7QUFNQSxTQUFTLHNCQUFzQixRQUk1QjtBQUNELFFBQU0sRUFBRSxNQUFNLFFBQVEsV0FBVyxVQUFVLElBQUk7QUFFL0MsUUFBTSxPQUFpQixDQUFDO0FBQ3hCLFFBQU0sVUFBb0IsQ0FBQztBQUMzQixRQUFNLGtCQUE2QyxDQUFDO0FBQ3BELFFBQU0sWUFBb0MsQ0FBQztBQUczQyxhQUFXLENBQUMsS0FBSyxLQUFLLEtBQUssT0FBTyxRQUFRLE1BQU0sR0FBRztBQUNqRCxvQkFBZ0IsSUFBSSxHQUFHLEVBQUUsSUFBSTtBQUM3QixRQUFJLE9BQU87QUFDVCxXQUFLLEtBQUssSUFBSSxHQUFHLE9BQU8sR0FBRyxFQUFFO0FBQzdCLGdCQUFVLElBQUksR0FBRyxFQUFFLElBQUk7QUFBQSxJQUN6QixPQUFPO0FBQ0wsY0FBUSxLQUFLLElBQUksR0FBRyxFQUFFO0FBQUEsSUFDeEI7QUFBQSxFQUNGO0FBRUEsTUFBSSxhQUFhLEtBQUssU0FBUyxPQUFPLEtBQUssS0FBSyxJQUFJLENBQUMsS0FBSztBQUMxRCxnQkFBYyxRQUFRLFNBQVMsV0FBVyxRQUFRLEtBQUssSUFBSSxDQUFDLEtBQUs7QUFFakUsUUFBTSxZQUFZLEtBQUssTUFBTSxLQUFLLFVBQVUsOEJBQThCLFNBQVMsQ0FBQztBQUVwRixTQUFPO0FBQUEsSUFDTCxXQUFXO0FBQUEsSUFDWCxLQUFLLEtBQUssU0FBUyxZQUFZLElBQUk7QUFBQSxJQUNuQztBQUFBLElBQ0EsUUFBUTtBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsTUFDQSxrQkFBa0IsS0FBSyxTQUFTLFlBQVksU0FBUztBQUFBLElBQ3ZEO0FBQUEsRUFDRjtBQUNGO0FBRU8sU0FBUyxTQUFTLEtBQWM7QUFDckMsU0FBTyxJQUFJO0FBQ2I7IiwKICAibmFtZXMiOiBbXQp9Cg==
