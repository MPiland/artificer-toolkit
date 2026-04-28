import { describe, expect, it } from 'vitest'
import {
  createDefaultEffect,
  createOutcome,
  createPathForSelection,
  createTargeting,
  formatEffectSummary
} from './effectEditor.utils'

const references = {
  damageTypes: [{ value: 'fire', label: 'Fire' }],
  conditionTypes: [{ value: 'blinded', label: 'Blinded' }],
  creatures: [{ value: 'sprite', label: 'Sprite' }]
}

describe('EffectEditor utilities', () => {
  it('creates a default effect with a fixed on-use path', () => {
    const effect = createDefaultEffect(1)

    expect(effect.order).toBe(1)
    expect(effect.invocation.triggerCode).toBe('ACTIVATED')
    expect(effect.paths[0]).toMatchObject({
      pathCode: 'ON_USE',
      selectionKind: 'FIXED',
      groupType: 'SINGLE'
    })
  })

  it('creates schema-shaped choice and roll-table paths when switching resolution', () => {
    expect(createPathForSelection({
      id: 'path-choice',
      order: 1,
      pathCode: 'ON_HIT',
      selectionKind: 'CHOICE'
    })).toMatchObject({
      selectionKind: 'CHOICE',
      groupType: 'CHOICE',
      options: []
    })

    expect(createPathForSelection({
      id: 'path-roll',
      order: 1,
      pathCode: 'ON_HIT',
      selectionKind: 'ROLL_TABLE'
    })).toMatchObject({
      selectionKind: 'ROLL_TABLE',
      groupType: 'SINGLE',
      rollTableKind: 'RANGE',
      dieConfig: '1d6',
      rows: []
    })
  })

  it.each([
    'DAMAGE',
    'CONDITION',
    'HEAL',
    'APPLY_GRANT',
    'FORCED_MOVEMENT',
    'TELEPORT',
    'MANIFEST',
    'MOVE_MANIFEST',
    'COMMAND_MANIFEST',
    'RULE'
  ])('creates a %s outcome payload', (kind) => {
    expect(createOutcome(kind, references)).toMatchObject({ effectKind: kind })
  })

  it('summarizes effect invocation, paths, and outcomes', () => {
    const effect = createDefaultEffect(1)

    expect(formatEffectSummary(effect)).toBe('Activated, 1 path, no outcomes yet')
  })

  it('creates schema-shaped targeting defaults', () => {
    expect(createTargeting('SELF')).toMatchObject({ selectionKind: 'SELF' })
    expect(createTargeting('CHOSEN_CREATURES')).toMatchObject({
      selectionKind: 'CHOSEN_CREATURES',
      dispositionKind: 'ANY',
      maxTargets: 1
    })
  })
})
