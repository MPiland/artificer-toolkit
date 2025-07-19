import { globSync } from 'glob'
import * as fs from 'fs'

// Utility: Lowercase first letter and add 's' for plural (simple pluralization)
function toTableVarName(entity: string) {
  return entity.charAt(0).toLowerCase() + entity.slice(1)
}

function extractOps(content: string, prefix: string) {
  // Matches: opName(args...): ReturnType!
  const regex = new RegExp(`^\\s*(${prefix}[A-Z][A-Za-z0-9_]*)\\s*\\([^)]*\\):\\s*([A-Za-z0-9_\\[\\]!]+)`, 'gm')
  return Array.from(content.matchAll(regex)).map((match) => {
    const op = match[1]
    let entity = match[2].replace(/[[\]!]/g, '')

    if (prefix === 'delete') {
      entity = op.replace('delete', '')
    }
    // If op includes 'Master', add 'Master' to entity name (before entity)
    if (op.includes('Master')) {
      // Insert 'Master' before the base entity name
      // e.g. getMasterAncestryFeature -> MasterAncestryFeature
      // Handles both getMasterX and getXMaster if needed
      if (!entity.startsWith('Master')) {
        entity = 'Master' + entity
      }
    }
    if (entity.endsWith('Connection')) {
      entity = entity.replace('Connection', '')
    }

    return { op, entity }
  })
}

// Find all queries and mutations files
const queryFiles = globSync('./lib/schemas/**/queries.graphql')
const mutationFiles = globSync('./lib/schemas/**/mutations.graphql')

const entityMap: Record<string, { queries: string[]; mutations: string[] }> = {}

// Queries
for (const file of queryFiles) {
  const content = fs.readFileSync(file, 'utf-8')
  const ops = extractOps(content, 'get').concat(extractOps(content, 'list'))
  for (const { op, entity } of ops) {
    if (!entityMap[entity]) entityMap[entity] = { queries: [], mutations: [] }
    entityMap[entity].queries.push(op)
  }
}

// Mutations
for (const file of mutationFiles) {
  const content = fs.readFileSync(file, 'utf-8')
  const ops = extractOps(content, 'create')
    .concat(extractOps(content, 'update'))
    .concat(extractOps(content, 'delete'))
    .concat(extractOps(content, 'batchCreate'))
  for (const { op, entity } of ops) {
    if (!entityMap[entity]) entityMap[entity] = { queries: [], mutations: [] }
    entityMap[entity].mutations.push(op)
  }
}

// Build mapping array
const mapping = Object.entries(entityMap)
  .map(([entity, ops]) => ({
    entity,
    table: toTableVarName(entity),
    queries: ops.queries.sort(),
    mutations: ops.mutations.sort(),
  }))
  .sort((a, b) => a.entity.localeCompare(b.entity))

// Output as TypeScript file
const outputPath = './lib/schemas/entityMap.ts'
const fileContent = `// AUTO-GENERATED: DO NOT EDIT
export interface EntityOperationMapEntry {
  entity: string
  table: string
  queries: string[]
  mutations: string[]
}

export const entityOperationMap: EntityOperationMapEntry[] = ${JSON.stringify(mapping, null, 2)};
`

fs.writeFileSync(outputPath, fileContent)
console.log(`✅ Entity-operation mapping written to ${outputPath}`)
