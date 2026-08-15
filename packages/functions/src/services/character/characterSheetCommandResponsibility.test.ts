import { describe, expect, it } from 'vitest'

import type { CharacterSheetCommandInputDto } from '@artificer-toolkit/schema/api/characters'

import {
  canReuseCommittedCharacterRuleEvaluation,
  classifyCharacterSheetCommandRuleResponsibility
} from './characterSheetCommandResponsibility.js'

const commandBase = {
  commandId: '00000000-0000-4000-8000-000000000001',
  expectedVersion: 3
} as const

describe('classifyCharacterSheetCommandRuleResponsibility', () => {
  it('keeps fast play-state and presentation commands on the committed snapshot', () => {
    const commands = [
      { ...commandBase, type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 5 },
      { ...commandBase, type: 'USE_SPELL_SLOT', slotKey: 'STANDARD:1' },
      {
        ...commandBase,
        type: 'CREATE_NOTE',
        title: 'Door clue',
        groupId: '00000000-0000-4000-8000-000000000002'
      },
      { ...commandBase, type: 'SET_HIT_POINTS', current: 12 },
      {
        ...commandBase,
        type: 'UPDATE_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          extraId: '00000000-0000-4000-8000-000000000003',
          currentHitPoints: 4,
          notes: 'Injured'
        }
      }
    ] satisfies CharacterSheetCommandInputDto[]

    expect(commands.map(classifyCharacterSheetCommandRuleResponsibility)).toEqual(
      commands.map(() => 'COMMITTED_SNAPSHOT')
    )
  })

  it('reevaluates prospective facts when a command changes mechanics', () => {
    const commands = [
      { ...commandBase, type: 'SET_EXHAUSTION', level: 2 },
      { ...commandBase, type: 'SET_HIT_POINTS', maxOverride: 20 },
      {
        ...commandBase,
        type: 'UPDATE_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          extraId: '00000000-0000-4000-8000-000000000003',
          isActive: false
        }
      },
      {
        ...commandBase,
        type: 'UPDATE_SHEET_EXTRA',
        extra: {
          kind: 'COMPANION',
          extraId: '00000000-0000-4000-8000-000000000003',
          hitDice: [{ die: 8, total: 2, used: 1 }]
        }
      },
      {
        ...commandBase,
        type: 'EQUIP_ITEM',
        itemId: '00000000-0000-4000-8000-000000000004'
      }
    ] satisfies CharacterSheetCommandInputDto[]

    expect(commands.map(classifyCharacterSheetCommandRuleResponsibility)).toEqual(
      commands.map(() => 'CHARACTER_POLICY')
    )
  })

  it('reuses committed mechanics directly or through one bounded play-state evaluation', () => {
    const reusable = [
      { ...commandBase, type: 'ADJUST_HIT_POINTS', mode: 'DAMAGE', amount: 5 },
      { ...commandBase, type: 'SET_INSPIRATION', inspired: true },
      {
        ...commandBase,
        type: 'CREATE_NOTE',
        title: 'Door clue',
        groupId: '00000000-0000-4000-8000-000000000002'
      },
      { ...commandBase, type: 'USE_SPELL_SLOT', slotKey: 'STANDARD:1' }
    ] satisfies CharacterSheetCommandInputDto[]
    const mutablePolicyInputs = [
      { ...commandBase, type: 'SET_MOVEMENT_DISPLAY_PREFERENCE', preference: { mode: 'AUTO' } },
      { ...commandBase, type: 'SET_EXHAUSTION', level: 2 }
    ] satisfies CharacterSheetCommandInputDto[]

    expect(reusable.every(canReuseCommittedCharacterRuleEvaluation)).toBe(true)
    expect(mutablePolicyInputs.some(canReuseCommittedCharacterRuleEvaluation)).toBe(false)
  })
})
