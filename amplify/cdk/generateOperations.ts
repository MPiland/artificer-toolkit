import {
  GraphQLObjectType,
  isObjectType,
  isListType,
  isNonNullType,
  isScalarType,
  isEnumType,
  GraphQLType,
  GraphQLField,
  GraphQLArgument,
} from 'graphql'
import { loadSchema } from '@graphql-tools/load'
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader'
import * as fs from 'fs'

const MAX_DEPTH = 11

function getBaseType(type: GraphQLType): GraphQLType {
  if (isNonNullType(type) || isListType(type)) {
    return getBaseType(type.ofType)
  }
  return type
}

function getFieldSelections(type: GraphQLObjectType, depth = 0): string {
  if (depth > MAX_DEPTH) return ''

  const fields = type.getFields()
  let selections = `\n${'\t'.repeat(depth + 1)}__typename`

  Object.entries(fields).forEach(([fieldName, field]) => {
    const baseType = getBaseType(field.type)
    selections += `\n${'\t'.repeat(depth + 1)}${fieldName}`

    if (isObjectType(baseType)) {
      if (fieldName === 'items' || depth < MAX_DEPTH) {
        selections += ` {${getFieldSelections(baseType, depth + 1)}\n\t${'\t'.repeat(depth)}}`
      } else {
        selections += ` { __typename }`
      }
    } else if (isEnumType(baseType)) {
      selections += ''
    } else if (isScalarType(baseType)) {
      selections += ''
    }
  })

  return selections
}

function getArgumentString(field: GraphQLField<any, any>): string {
  if (!field.args.length) return ''

  const args = field.args
    .map((arg: GraphQLArgument) => {
      const baseType = getBaseType(arg.type)
      const isNonNull = isNonNullType(arg.type)
      return `$${arg.name}: ${baseType}${isNonNull ? '!' : ''}`
    })
    .join(', ')

  return `(${args})`
}

function getInputString(field: GraphQLField<any, any>): string {
  if (!field.args.length) return ''

  const args = field.args
    .map((arg: GraphQLArgument) => {
      return `${arg.name}: $${arg.name}`
    })
    .join(', ')

  return `(${args})`
}

function generateOperation(operationType: 'query' | 'mutation', name: string, field: GraphQLField<any, any>) {
  const operationName = name.charAt(0).toUpperCase() + name.slice(1)
  const argsString = getArgumentString(field)
  const inputString = getInputString(field)
  const returnType = getBaseType(field.type)
  const upperReturnType = String(operationType).charAt(0).toUpperCase() + String(operationType).slice(1)
  const selections = isObjectType(returnType) ? getFieldSelections(returnType) : ''

  const operationArgs = argsString ? `${argsString}` : ''
  const fieldArgs = inputString ? `${inputString}` : ''

  const footerText = `as Generated${upperReturnType}<${
    field.args.length === 0 && operationType === 'query' ? '{}' : `APITypes.${upperReturnType}${operationName}Args`
  }, {${name}: APITypes.${upperReturnType}['${name}']}>;`

  return `export const ${name} = /* GraphQL */ \`
${operationType} ${operationName}${operationArgs} {
  ${name}${fieldArgs} {${selections}
  }
}
\`${footerText}\n\n`
}

async function generateAllOperations() {
  const schema = await loadSchema('lib/schema.graphql', {
    loaders: [new GraphQLFileLoader()],
  })

  const queryType = schema.getType('Query') as GraphQLObjectType
  const mutationType = schema.getType('Mutation') as GraphQLObjectType

  let mutations = `/* tslint:disable */
  /* eslint-disable */
  // this is an auto generated file. This will be overwritten
  
  import * as APITypes from "./types";
  
  type GeneratedMutation<InputType, OutputType> = string & {
    __generatedMutationInput: InputType;
    __generatedMutationOutput: OutputType;
  };\n\n`

  let queries = `/* tslint:disable */
  /* eslint-disable */
  // this is an auto generated file. This will be overwritten
  
  import * as APITypes from "./types";
  
  type GeneratedQuery<InputType, OutputType> = string & {
    __generatedQueryInput: InputType;
    __generatedQueryOutput: OutputType;
  };\n\n`

  if (queryType) {
    const queryFields = queryType.getFields()
    Object.entries(queryFields).forEach(([name, field]) => {
      queries += generateOperation('query', name, field)
    })
  }

  if (mutationType) {
    const mutationFields = mutationType.getFields()
    Object.entries(mutationFields).forEach(([name, field]) => {
      mutations += generateOperation('mutation', name, field)
    })
  }

  fs.writeFileSync('../../amplify/gql/mutations.ts', mutations)
  fs.writeFileSync('../../amplify/gql/queries.ts', queries)
}

generateAllOperations()

export default generateAllOperations
