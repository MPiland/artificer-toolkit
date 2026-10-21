import { describe, expect, it } from 'vitest'
import { compileEffect } from '@artificer-toolkit/shared/compilers'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import { SRD_CONDITION_TYPES } from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { CharacterRuleActionExecutionPlan } from '../characterRuleActionSystemAdapter.js'
import { buildCompiledActionCompilerSource } from '../encounterActionEntryPointCompiler.js'
import { dnd5eCharacterRuleActionSystemAdapter } from '../systems/dnd5e/effectActionCompiler.js'
import {
  ACTION_EFFECT_ID,
  characterActionDescriptor
} from '../testing/characterActionDescriptor.js'

type AuthoredEffect = Parameters<typeof compileEffect>[0]

const GOLDEN_CHARACTER_LEVEL = 20

type Owner = { label: string; spellLevel: number | undefined }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** Every authored Effect in the SRD subjects, found by shape, with the label and spell level of its owner. */
function collectEffects(
  node: unknown,
  owner: Owner,
  found: { effect: AuthoredEffect; owner: Owner }[]
) {
  if (Array.isArray(node)) {
    for (const entry of node) collectEffects(entry, owner, found)
    return
  }
  if (!isRecord(node)) return
  if (typeof node.id === 'string' && isRecord(node.invocation) && typeof node.order === 'number') {
    found.push({ effect: node as unknown as AuthoredEffect, owner })
    return
  }
  const next: Owner = {
    label: typeof node.label === 'string' ? node.label : owner.label,
    spellLevel: typeof node.level === 'number' ? node.level : owner.spellLevel
  }
  for (const value of Object.values(node)) collectEffects(value, next, found)
}

const conditionDefinitionIds = SRD_CONDITION_TYPES.map((condition) => condition.id)

const describeGraph = ({
  checksum,
  definition
}: {
  checksum: string
  definition: { nodes: readonly unknown[]; outputs: object }
}) =>
  `${checksum} nodes=${definition.nodes.length} outputs=${Object.keys(definition.outputs).length}`

function describePlan(plan: CharacterRuleActionExecutionPlan | undefined) {
  if (!plan) return 'NO_PLAN'
  if (plan.kind === 'SINGLE_GRAPH') return `SINGLE_GRAPH ${describeGraph(plan.published)}`
  const outcomes = [...plan.outcomes]
    .map(({ pathCode, template }) => `${pathCode}=${template.checksum}`)
    .sort()
    .join(',')
  return `TEST_OUTCOME test=${describeGraph(plan.test.published)} outcomes=[${outcomes}]`
}

/** Compiles one authored Effect (under the descriptor's fixed id, so checksums do not depend on it) through the public System adapter, the way an Encounter Action does. */
function goldenLine({ effect, owner }: { effect: AuthoredEffect; owner: Owner }) {
  const outcome = (() => {
    try {
      const action = {
        ...characterActionDescriptor(
          compileEffect({ ...effect, id: ACTION_EFFECT_ID }),
          owner.spellLevel,
          GOLDEN_CHARACTER_LEVEL
        ),
        conditionDefinitionIds
      }
      return describePlan(
        dnd5eCharacterRuleActionSystemAdapter.compileExecutionPlan?.({
          action,
          compilerSource: buildCompiledActionCompilerSource(action)
        })
      )
    } catch (error) {
      const name = error instanceof Error ? error.name : 'UnknownError'
      const message = error instanceof Error ? error.message : String(error)
      return `REFUSED ${name}: ${message}`
    }
  })()
  return `${effect.id} ${owner.label.replaceAll('\n', ' ')} | ${outcome}`
}

describe('SRD effect compile golden', () => {
  const found: { effect: AuthoredEffect; owner: Owner }[] = []
  collectEffects(srdBaselineContent.subjects, { label: '', spellLevel: undefined }, found)

  it('finds the authored SRD effects', () => {
    expect(found.length).toBeGreaterThan(0)
    expect(new Set(found.map(({ effect }) => effect.id)).size).toBe(found.length)
  })

  it('compiles every authored SRD effect to the committed outcome, checksum and plan shape', async () => {
    const lines = found.map(goldenLine).sort()
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot(
      './__golden__/srdEffectCompile.golden.txt'
    )
  })
})
