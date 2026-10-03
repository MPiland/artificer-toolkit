import { describe, expect, it } from 'vitest'
import { encounterCommandInputDtoSchema } from '@artificer-toolkit/schema/api/encounters'

// Every Encounter command commits in the room's SQLite (ADR 0035, D78); Convex only ingests fenced
// checkpoints. A Convex function whose arguments name an Encounter command type could write one
// directly, so none may exist.
const modules = import.meta.glob<Record<string, unknown>>([
  '../**/*.ts',
  '!../**/*.test.ts',
  '!../**/*.d.ts',
  '!../**/*.config.ts',
  '!../_generated/**'
])

describe('Convex Encounter command boundary', () => {
  it('registers no public or internal function that accepts an Encounter command', async () => {
    const commandTypes = encounterCommandInputDtoSchema.def.options.map(
      (option) => option.shape.type._zod.def.values[0]
    )
    const acceptors: string[] = []
    let registered = 0
    for (const [path, load] of Object.entries(modules)) {
      for (const [name, value] of Object.entries(await load())) {
        if (typeof value !== 'function' || !('exportArgs' in value)) continue
        if (typeof value.exportArgs !== 'function') continue
        registered += 1
        const args = String(value.exportArgs())
        if (commandTypes.some((type) => args.includes(`"${type}"`)))
          acceptors.push(`${path}:${name}`)
      }
    }
    expect(registered).toBeGreaterThan(100)
    expect(acceptors).toEqual([])
  }, 60_000)
})
