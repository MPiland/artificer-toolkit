import { describe, expect, it } from 'vitest'

import {
  characterSheetPanelDtoSchema,
  characterSheetPanelTargetDtoSchema
} from '../api/characterSheetPanel.js'
import { characterSheetCommandInputDtoSchema } from '../api/characters.js'

const characterId = '00000000-0000-4000-8000-000000000001'
const adjustmentId = '00000000-0000-4000-8000-000000000002'

describe('character sheet panel contracts', () => {
  it('accepts a backend-authored ability panel with calculation provenance', () => {
    const result = characterSheetPanelDtoSchema.safeParse({
      kind: 'ABILITY',
      panelId: 'ability:STRENGTH',
      characterId,
      target: { kind: 'ABILITY', ability: 'STRENGTH' },
      title: 'Strength',
      state: 'ADJUSTED',
      editable: true,
      allowedCommands: [
        'UPSERT_ADJUSTMENT',
        'REMOVE_ADJUSTMENT',
        'RESET_ADJUSTMENTS'
      ],
      ability: 'STRENGTH',
      score: 16,
      modifier: 3,
      scoreCalculation: {
        base: 14,
        contributions: [
          {
            id: 'manual-bonus',
            source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId },
            sourceLabel: 'Training reward',
            sourceNote: 'Granted after session 4',
            value: 2,
            state: 'APPLIED'
          }
        ],
        effective: 16
      },
      editors: [
        {
          kind: 'NUMBER',
          field: 'OTHER_MODIFIER',
          label: 'Other modifier',
          value: 2,
          commitIntent: 'ON_BLUR_OR_ENTER',
          validation: { integer: true },
          adjustmentId,
          sourceCategory: 'MANUAL',
          sourceLabel: 'Training reward',
          sourceNote: 'Granted after session 4'
        },
        {
          kind: 'NUMBER',
          field: 'SCORE_OVERRIDE',
          label: 'Override score',
          value: null,
          commitIntent: 'ON_BLUR_OR_ENTER',
          validation: { integer: true },
          sourceCategory: 'MANUAL'
        }
      ]
    })

    expect(result.success).toBe(true)
  })

  it('keeps targets closed instead of accepting arbitrary paths', () => {
    expect(
      characterSheetPanelTargetDtoSchema.safeParse({
        kind: 'CUSTOM',
        path: 'overview.armorClass'
      }).success
    ).toBe(false)
  })

  it('accepts typed immediate adjustment commands', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: '00000000-0000-4000-8000-000000000003',
        expectedVersion: 2,
        adjustment: {
          id: adjustmentId,
          sourceCategory: 'MAGIC',
          sourceLabel: 'Blessing',
          family: 'SAVING_THROW',
          ability: 'WISDOM',
          field: 'MAGIC_BONUS',
          value: 1
        }
      }).success
    ).toBe(true)
  })

  it('rejects non-core adjustment families from the core-panel command', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: '00000000-0000-4000-8000-000000000003',
        expectedVersion: 2,
        adjustment: {
          sourceCategory: 'MANUAL',
          family: 'ITEM',
          itemInstanceId: adjustmentId,
          field: 'DAMAGE_BONUS',
          value: 1
        }
      }).success
    ).toBe(false)
  })

  it('rejects a negative absolute ability score', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: '00000000-0000-4000-8000-000000000003',
        expectedVersion: 2,
        adjustment: {
          sourceCategory: 'MANUAL',
          family: 'ABILITY',
          ability: 'STRENGTH',
          field: 'SCORE_OVERRIDE',
          value: -1
        }
      }).success
    ).toBe(false)
  })
})
