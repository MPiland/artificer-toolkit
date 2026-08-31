import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID,
  DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY,
  DND5E_CLEAVING_DEFINITION_ID,
  DND5E_CLEAVING_OPERATION_KEY,
  DND5E_CLIMB_ONTO_LARGER_CREATURE_DEFINITION_ID,
  DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY,
  DND5E_DISARM_DEFINITION_ID,
  DND5E_DISARM_OPERATION_KEY,
  DND5E_FLANKING_DEFINITION_ID,
  DND5E_FLANKING_OPERATION_KEY,
  DND5E_FACING_DEFINITION_ID,
  DND5E_FACING_OPERATION_KEY,
  DND5E_HITTING_COVER_DEFINITION_ID,
  DND5E_HITTING_COVER_OPERATION_KEY,
  DND5E_INJURIES_DEFINITION_ID,
  DND5E_INJURIES_OPERATION_KEY,
  DND5E_MARK_DEFINITION_ID,
  DND5E_MARK_OPERATION_KEY,
  DND5E_MASSIVE_DAMAGE_DEFINITION_ID,
  DND5E_MASSIVE_DAMAGE_OPERATION_KEY,
  DND5E_MORALE_DEFINITION_ID,
  DND5E_MORALE_OPERATION_KEY,
  DND5E_OVERRUN_DEFINITION_ID,
  DND5E_OVERRUN_OPERATION_KEY,
  DND5E_SHOVE_ASIDE_DEFINITION_ID,
  DND5E_SHOVE_ASIDE_OPERATION_KEY,
  DND5E_TUMBLE_DEFINITION_ID,
  DND5E_TUMBLE_OPERATION_KEY,
  dnd5eOptionalCombatRuleKindDtoSchema
} from '@artificer-toolkit/schema/shared/optionalCombat'
import { describe, expect, it } from 'vitest'

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'docs/roadmap/08-vtt-optional-combat-coverage.json'), 'utf8')
) as {
  caseId: string
  gate: number
  rules: Array<{
    kind: string
    definition: {
      definitionId: string | null
      module: { key: string; contractVersion: number } | null
      parameterKind: string
    }
    status: string
  }>
}

describe('optional combat coverage manifest', () => {
  it('enumerates the fixed closed optional-combat scope without changing acceptance totals', () => {
    const kinds = dnd5eOptionalCombatRuleKindDtoSchema.options
    expect(manifest.caseId).toBe('G2-OPTIONAL-COMBAT')
    expect(manifest.gate).toBe(2)
    expect(manifest.rules.map((rule) => rule.kind)).toEqual(kinds)
    expect(new Set(manifest.rules.map((rule) => rule.kind)).size).toBe(kinds.length)
    expect(manifest.rules.every((rule) => rule.definition.parameterKind === rule.kind)).toBe(true)
    expect(manifest.rules.every((rule) => rule.status !== 'DB_ACCEPTED')).toBe(true)
  })

  it('matches every currently registered definition to its stable UUID and module pin', () => {
    const expectedDefinitions = {
      ALTERNATING_DIAGONALS: {
        definitionId: DND5E_ALTERNATING_DIAGONALS_DEFINITION_ID,
        moduleKey: DND5E_ALTERNATING_DIAGONALS_OPERATION_KEY
      },
      FLANKING: {
        definitionId: DND5E_FLANKING_DEFINITION_ID,
        moduleKey: DND5E_FLANKING_OPERATION_KEY
      },
      FACING: { definitionId: DND5E_FACING_DEFINITION_ID, moduleKey: DND5E_FACING_OPERATION_KEY },
      CLIMB_ONTO_LARGER_CREATURE: {
        definitionId: DND5E_CLIMB_ONTO_LARGER_CREATURE_DEFINITION_ID,
        moduleKey: DND5E_CLIMB_ONTO_LARGER_CREATURE_OPERATION_KEY
      },
      DISARM: { definitionId: DND5E_DISARM_DEFINITION_ID, moduleKey: DND5E_DISARM_OPERATION_KEY },
      MARK: { definitionId: DND5E_MARK_DEFINITION_ID, moduleKey: DND5E_MARK_OPERATION_KEY },
      OVERRUN: {
        definitionId: DND5E_OVERRUN_DEFINITION_ID,
        moduleKey: DND5E_OVERRUN_OPERATION_KEY
      },
      SHOVE_ASIDE: {
        definitionId: DND5E_SHOVE_ASIDE_DEFINITION_ID,
        moduleKey: DND5E_SHOVE_ASIDE_OPERATION_KEY
      },
      TUMBLE: { definitionId: DND5E_TUMBLE_DEFINITION_ID, moduleKey: DND5E_TUMBLE_OPERATION_KEY },
      HITTING_COVER: {
        definitionId: DND5E_HITTING_COVER_DEFINITION_ID,
        moduleKey: DND5E_HITTING_COVER_OPERATION_KEY
      },
      CLEAVING: {
        definitionId: DND5E_CLEAVING_DEFINITION_ID,
        moduleKey: DND5E_CLEAVING_OPERATION_KEY
      },
      INJURIES: {
        definitionId: DND5E_INJURIES_DEFINITION_ID,
        moduleKey: DND5E_INJURIES_OPERATION_KEY
      },
      MASSIVE_DAMAGE: {
        definitionId: DND5E_MASSIVE_DAMAGE_DEFINITION_ID,
        moduleKey: DND5E_MASSIVE_DAMAGE_OPERATION_KEY
      },
      MORALE: { definitionId: DND5E_MORALE_DEFINITION_ID, moduleKey: DND5E_MORALE_OPERATION_KEY }
    } as const
    const registered = manifest.rules.filter((rule) => rule.definition.definitionId !== null)
    expect(registered).toHaveLength(14)
    for (const rule of registered) {
      const expected = expectedDefinitions[rule.kind as keyof typeof expectedDefinitions]
      expect(expected).toBeDefined()
      expect(rule.definition).toEqual({
        definitionId: expected.definitionId,
        module: { key: expected.moduleKey, contractVersion: 1 },
        parameterKind: rule.kind
      })
    }
  })
})
