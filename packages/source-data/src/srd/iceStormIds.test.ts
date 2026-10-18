import { describe, expect, it } from 'vitest'
import { iceStorm } from './spells/ice-storm.js'

type Node = Record<string, unknown>

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null

/** The ids of every path and outcome under `value`, at any depth. */
function pathAndOutcomeIds(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(pathAndOutcomeIds)
  if (!isNode(value)) return []
  const own =
    typeof value.id === 'string' && ('pathCode' in value || 'effectKind' in value) ? [value.id] : []
  return [...own, ...Object.values(value).flatMap(pathAndOutcomeIds)]
}

/** SPELLS-7.2: Ice Storm's save keeps its own id; no damage path or outcome reuses it. */
describe('SRD Ice Storm ids', () => {
  it('gives no path or outcome the saving throw id', () => {
    const [effect] = iceStorm.effects ?? []
    if (effect?.invocation.triggerCode !== 'SAVING_THROW')
      throw new Error('Ice Storm is a saving-throw action.')
    expect(pathAndOutcomeIds(effect.paths)).not.toContain(effect.invocation.savingThrow.id)
  })
})
