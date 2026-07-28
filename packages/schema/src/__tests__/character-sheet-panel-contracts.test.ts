import { describe, expect, it } from 'vitest'

import {
  characterSheetPanelDtoSchema,
  characterSheetPanelTargetDtoSchema
} from '../api/characterSheetPanel.js'
import { characterSheetCommandInputDtoSchema } from '../api/characters.js'

const characterId = '00000000-0000-4000-8000-000000000001'
const adjustmentId = '00000000-0000-4000-8000-000000000002'
const deterministicSrdSpellId = '00000000-0000-0000-0020-00c600000000'

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
      allowedCommands: ['UPSERT_ADJUSTMENT', 'REMOVE_ADJUSTMENT', 'RESET_ADJUSTMENTS'],
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
          sourceNote: 'Granted after session 4'
        },
        {
          kind: 'NUMBER',
          field: 'SCORE_OVERRIDE',
          label: 'Override score',
          value: null,
          commitIntent: 'ON_BLUR_OR_ENTER',
          validation: { integer: true }
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
          sourceNote: 'Blessing',
          family: 'SAVING_THROW',
          ability: 'WISDOM',
          field: 'MAGIC_BONUS',
          value: 1
        }
      }).success
    ).toBe(true)
  })

  it('keeps maximum HP adjustments on the generic Sheet adjustment seam', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: '00000000-0000-4000-8000-000000000003',
        expectedVersion: 2,
        adjustment: {
          id: adjustmentId,
          family: 'HIT_POINTS',
          field: 'MAXIMUM_MODIFIER',
          value: -4
        }
      }).success
    ).toBe(true)
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'REMOVE_SHEET_ADJUSTMENT',
        commandId: '00000000-0000-4000-8000-000000000003',
        expectedVersion: 2,
        adjustmentId,
        target: { kind: 'HIT_POINTS' },
        family: 'HIT_POINTS'
      }).success
    ).toBe(true)
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'RESET_SHEET_PANEL_ADJUSTMENTS',
        commandId: '00000000-0000-4000-8000-000000000003',
        expectedVersion: 2,
        target: { kind: 'HIT_POINTS' }
      }).success
    ).toBe(true)
  })

  it('accepts typed owned-item adjustments through the shared Sheet command', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'UPSERT_SHEET_ADJUSTMENT',
        commandId: '00000000-0000-4000-8000-000000000003',
        expectedVersion: 2,
        adjustment: {
          family: 'ITEM',
          itemInstanceId: adjustmentId,
          field: 'DAMAGE_BONUS',
          value: 1
        }
      }).success
    ).toBe(true)
  })

  it('accepts companion panels with numeric and select adjustment editors', () => {
    expect(
      characterSheetPanelDtoSchema.safeParse({
        kind: 'COMPANION',
        panelId: 'companion:owl',
        characterId,
        target: { kind: 'COMPANION', companionInstanceId: adjustmentId },
        title: 'Owl',
        state: 'DEFAULT',
        editable: true,
        allowedCommands: ['UPSERT_ADJUSTMENT'],
        companionInstanceId: adjustmentId,
        creatureId: deterministicSrdSpellId,
        relationshipKind: 'COMPANION',
        relationshipLabel: 'Companion',
        originKind: 'WORLD',
        originLabel: 'World',
        authoredName: 'Owl',
        displayName: 'Owl',
        isActive: true,
        armorClass: 11,
        hitPoints: { current: 1, temp: 0, maximum: 1 },
        hitDice: [],
        facts: [],
        actions: [],
        features: [],
        equipmentItemIds: [],
        resources: [
          {
            target: {
              kind: 'RESOURCE',
              owner: {
                kind: 'COMPANION_FEATURE',
                chargeId: 'charge-owl',
                companionInstanceId: adjustmentId,
                featureId: deterministicSrdSpellId
              }
            },
            label: 'Keen Senses',
            remaining: 0,
            maximum: 1,
            recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
          }
        ],
        numericEditors: [
          {
            kind: 'NUMBER',
            field: 'ARMOR_CLASS_OVERRIDE',
            label: 'Armor Class',
            value: null,
            commitIntent: 'ON_BLUR_OR_ENTER',
            validation: { integer: true, minimum: 0 }
          }
        ],
        selectEditors: [
          {
            kind: 'SELECT',
            field: 'SIZE_OVERRIDE',
            label: 'Size',
            value: null,
            options: [{ value: 'SMALL', label: 'Small' }],
            commitIntent: 'IMMEDIATE'
          }
        ],
        textEditors: []
      }).success
    ).toBe(true)
  })

  it.each([
    ['used hit dice above total', [{ die: 8, total: 1, used: 2, remaining: 0 }]],
    [
      'duplicate hit-die denominations',
      [
        { die: 8, total: 1, used: 0, remaining: 1 },
        { die: 8, total: 2, used: 0, remaining: 2 }
      ]
    ],
    ['inconsistent remaining hit dice', [{ die: 8, total: 2, used: 1, remaining: 2 }]]
  ])('rejects companion panels with %s', (_label, hitDice) => {
    expect(
      characterSheetPanelDtoSchema.safeParse({
        kind: 'COMPANION',
        panelId: 'companion:owl',
        characterId,
        target: { kind: 'COMPANION', companionInstanceId: adjustmentId },
        title: 'Owl',
        state: 'DEFAULT',
        editable: true,
        allowedCommands: ['UPSERT_ADJUSTMENT'],
        companionInstanceId: adjustmentId,
        creatureId: deterministicSrdSpellId,
        relationshipKind: 'COMPANION',
        relationshipLabel: 'Companion',
        originKind: 'WORLD',
        originLabel: 'World',
        authoredName: 'Owl',
        displayName: 'Owl',
        isActive: true,
        armorClass: 11,
        hitPoints: { current: 1, temp: 0, maximum: 1 },
        hitDice,
        facts: [],
        actions: [],
        features: [],
        equipmentItemIds: [],
        resources: [],
        numericEditors: [],
        selectEditors: [],
        textEditors: []
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
          family: 'ABILITY',
          ability: 'STRENGTH',
          field: 'SCORE_OVERRIDE',
          value: -1
        }
      }).success
    ).toBe(false)
  })

  it('accepts contextual spell mechanic customization commands', () => {
    const source = {
      spellId: deterministicSrdSpellId,
      sourceKind: 'CLASS',
      sourceInstanceId: 'CLASS:wizard'
    }

    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
        commandId: '00000000-0000-4000-8000-000000000003',
        expectedVersion: 2,
        source,
        category: 'TO_HIT',
        mode: 'OVERRIDE',
        value: 7,
        sourceNote: 'Table ruling'
      }).success
    ).toBe(true)

    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'REMOVE_SPELL_MECHANIC_CUSTOMIZATION',
        commandId: '00000000-0000-4000-8000-000000000004',
        expectedVersion: 3,
        source,
        category: 'TO_HIT'
      }).success
    ).toBe(true)
  })

  it('rejects damage overrides because damage supports a flat bonus only', () => {
    expect(
      characterSheetCommandInputDtoSchema.safeParse({
        type: 'SET_SPELL_MECHANIC_CUSTOMIZATION',
        commandId: '00000000-0000-4000-8000-000000000003',
        expectedVersion: 2,
        source: {
          spellId: characterId,
          sourceKind: 'CLASS',
          sourceInstanceId: 'CLASS:wizard'
        },
        category: 'DAMAGE',
        mode: 'OVERRIDE',
        value: 4
      }).success
    ).toBe(false)
  })
})
