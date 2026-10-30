/// <reference types="node" />
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// SPELLS-10.T1b (R1): a holder's stored share of its maximum hit points is resolved when its
// conditions are written. A writer that sets a holder's conditions without going through
// `settle*ConditionMaximum` would leave the stored fraction stale, so it fails here.
const sourceRoot = fileURLToPath(new URL('..', import.meta.url))
const CONDITION_WRITE = /\bconditions:/
const SETTLES = /\bsettle(?:Creature|Character)ConditionMaximum\(/

/** Files that write `conditions:` without settling, and why that is safe. */
const NOT_A_WRITER_OF_HELD_CONDITIONS: Record<string, string> = {
  'actorReinforcementCommand.ts':
    'a new actor starts with no conditions, so it keeps its whole maximum',
  'characterStates.ts':
    'builds the frozen Character snapshot an Encounter reads, never a stored Sheet',
  'targetMechanicsInverse.ts':
    'pure: returns the restored actor and Sheet state, settled by revertedRunActors.ts and actionRevert.ts',
  'turnMovement.ts': 'passes condition ids to a rules check and stores none'
}

const productionFiles = readdirSync(sourceRoot).filter(
  (name) => name.endsWith('.ts') && !name.endsWith('.test.ts')
)

describe('condition maximum writers', () => {
  const sourceOf = (name: string) => readFileSync(path.join(sourceRoot, name), 'utf8')

  it.each(productionFiles.filter((name) => CONDITION_WRITE.test(sourceOf(name))))(
    '%s settles the condition maximum or is a documented non-writer',
    (name) => {
      expect(
        SETTLES.test(sourceOf(name)) || name in NOT_A_WRITER_OF_HELD_CONDITIONS,
        `${name} writes conditions without settleCreatureConditionMaximum or settleCharacterConditionMaximum`
      ).toBe(true)
    }
  )

  it('keeps the allowlist to files that still write conditions without settling', () => {
    for (const name of Object.keys(NOT_A_WRITER_OF_HELD_CONDITIONS)) {
      const source = sourceOf(name)
      expect(CONDITION_WRITE.test(source), `${name} no longer writes conditions`).toBe(true)
      expect(SETTLES.test(source), `${name} settles; drop it from the allowlist`).toBe(false)
    }
  })
})
