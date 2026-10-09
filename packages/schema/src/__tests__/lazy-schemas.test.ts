/// <reference types="node" />
import { readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { types } from 'node:util'
import { describe, expect, it } from 'vitest'
import { z } from '../zod.js'

// D59 moves schema construction errors (a bad `z.extend`, a cycle between lazy schemas) from import
// to first use, so this test imports every module and builds every exported schema.
const sourceRoot = fileURLToPath(new URL('..', import.meta.url))
const modulePaths = readdirSync(sourceRoot, { recursive: true, withFileTypes: true })
  .filter(
    (entry) =>
      entry.isFile() &&
      entry.name.endsWith('.ts') &&
      !entry.name.endsWith('.d.ts') &&
      !/[\\/]__tests__([\\/]|$)/.test(entry.parentPath)
  )
  .map((entry) => path.join(entry.parentPath, entry.name))

const exportedSchemas = async () => {
  const schemas: { name: string; schema: z.ZodMiniType }[] = []
  for (const modulePath of modulePaths) {
    const exports: Record<string, unknown> = await import(pathToFileURL(modulePath).href)
    const module = path.relative(sourceRoot, modulePath).replaceAll('\\', '/')
    for (const [name, value] of Object.entries(exports))
      if (value instanceof z.ZodMiniType) schemas.push({ name: `${module}#${name}`, schema: value })
  }
  return schemas
}

// Visits every definition reachable from the schema. Reading a definition resolves the lazy
// schemas nested in it and runs recursive shape getters.
const buildGraph = (root: z.ZodMiniType, seen: Set<object>) => {
  const pending: unknown[] = [root]
  while (pending.length) {
    const value = pending.pop()
    if (typeof value !== 'object' || value === null || seen.has(value)) continue
    seen.add(value)
    pending.push(...Object.values(value instanceof z.ZodMiniType ? value._zod.def : value))
  }
}

describe('lazy schemas', () => {
  it('builds and parses with every exported schema', async () => {
    const schemas = await exportedSchemas()
    const seen = new Set<object>()
    const failures = schemas.flatMap(({ name, schema }) => {
      try {
        buildGraph(schema, seen)
        z.safeParse(schema, undefined)
        return []
      } catch (error) {
        return [`${name}: ${error instanceof Error ? error.message : String(error)}`]
      }
    })

    expect(schemas.length).toBeGreaterThan(2_000)
    expect(failures).toEqual([])
  }, 30000)

  it('defers every exported schema except z.json()', async () => {
    const eager = (await exportedSchemas())
      .filter(({ schema }) => !types.isProxy(schema) && schema._zod.def.type !== 'lazy')
      .map(({ name }) => name)

    expect(eager).toEqual([])
  })
})
