import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * SPELLS-33 T6i (orchestrator ruling 4): armor class and damage read an item's corrosion in one
 * place each. Every other mention of `.degradation` only carries the value (the overlay stamp,
 * the rule snapshot, the Sheet projection and panel) or plans the next step of it.
 */

const SRC = join(__dirname, '..')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path)
    return /\.ts$/.test(name) && !/\.test\.ts$/.test(name) ? [path] : []
  })
}

const mentions = (pattern: RegExp) =>
  sourceFiles(SRC)
    .filter((path) => pattern.test(readFileSync(path, 'utf8')))
    .map((path) => relative(SRC, path).split(sep).join('/'))
    .sort()

describe('equipment degradation readers (SPELLS-33 T6i)', () => {
  it('has one armor class reader and one damage reader of an item’s penalty', () => {
    expect(mentions(/degradation\s*\?\?\s*0/)).toEqual([
      'encounterEquipmentDegradation.ts',
      'systems/dnd5e/characterActionMechanics.ts',
      'systems/dnd5e/characterVitals.ts'
    ])
  })
})
