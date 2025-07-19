import { globSync } from 'glob'
import * as fs from 'fs'
import { join } from 'path'

const typeFiles = globSync('./lib/schemas/**/types.graphql')
const inputFiles = globSync('./lib/schemas/**/inputs.graphql')
const queryFiles = globSync('./lib/schemas/**/queries.graphql')
const mutationFiles = globSync('./lib/schemas/**/mutations.graphql')

const schemaHeader = `schema {
  query: Query
  mutation: Mutation
}\n\n`

const types = typeFiles.map((file) => fs.readFileSync(file, 'utf-8')).join('\n')
const inputs = inputFiles.map((file) => fs.readFileSync(file, 'utf-8')).join('\n')

const queryFields = queryFiles
  .map((file) =>
    fs
      .readFileSync(file, 'utf-8')
      .replace(/type Query\s*{/, '')
      .replace(/}\s*$/, '')
      .trim()
  )
  .join('\n  ')

const mutationFields = mutationFiles
  .map((file) =>
    fs
      .readFileSync(file, 'utf-8')
      .replace(/type Mutation\s*{/, '')
      .replace(/}\s*$/, '')
      .trim()
  )
  .join('\n  ')

const unifiedTypes = `type Query {
  ${queryFields}
}

type Mutation {
  ${mutationFields}
}`

const mergedSchema = `${schemaHeader}${types}\n${inputs}\n${unifiedTypes}`

// Write the merged schema file
const mergedSchemaPath = join(__dirname, '../schema.graphql')
fs.writeFileSync(mergedSchemaPath, mergedSchema)

console.log('✅ Merged schema written to schema.graphql')
