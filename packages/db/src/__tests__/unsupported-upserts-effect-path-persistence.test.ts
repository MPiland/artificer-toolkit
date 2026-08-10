import { describe, expect, it } from 'vitest'
import {
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PATH_ROLL_TABLE_KIND,
  TRIGGER,
  ACTIVATION_CODE,
  RANGE_KIND
} from '@artificer-toolkit/shared'
import { upsertEffect } from '../domains/effects/upserts/effect.js'
import { InMemoryDb } from './helpers/in-memory-db.js'
describe('unsupported authored effect paths fail loudly', () => {
  it('persists generic non-damage outcome kinds through native effect result blocks', async () => {
    const db = new InMemoryDb()
    await expect(
      upsertEffect(
        db as never,
        {
          id: 'effect-unsupported-heal',
          order: 1,
          invocation: {
            triggerCode: TRIGGER.SPELL_ATTACK,
            activation: {
              code: ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: 'range-unsupported-heal',
              rangeKind: RANGE_KIND.TOUCH
            }
          },
          paths: [
            {
              id: 'PATH_CODE-unsupported-heal',
              order: 1,
              pathCode: PATH_CODE.ON_HIT,
              groupType: PATH_GROUP_TYPE.SINGLE,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: 'PATH_CODE-unsupported-heal__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: 'PATH_CODE-unsupported-heal-entry',
                    effectKind: EFFECT_KIND.HEAL,
                    valueKind: 'DICE',
                    diceConfig: '1d8'
                  }
                ]
              }
            }
          ]
        } as never
      )
    ).resolves.toBeUndefined()
    expect(db.snapshot('effect_paths')).toEqual([
      {
        id: 'PATH_CODE-unsupported-heal',
        effect_id: 'effect-unsupported-heal',
        sort_order: 1,
        path_code: PATH_CODE.ON_HIT,
        group_type: PATH_GROUP_TYPE.SINGLE,
        selection_kind: 'FIXED',
        origin_kind: null,
        range_override_characteristic_id: null,
        target_selection_kind: null,
        target_disposition_kind: null,
        max_targets: null,
        max_targets_scaling: null,
        resolution_count: null,
        resolution_count_scaling: null,
        allow_repeated_targets: null,
        excluded_creature_type_ids: null,
        result_block_id: 'PATH_CODE-unsupported-heal__result',
        roll_table_kind: null,
        die: null
      }
    ])
    expect(db.snapshot('effect_result_blocks')).toEqual([
      {
        id: 'PATH_CODE-unsupported-heal__result',
        result_kind: 'SINGLE',
        duration_id: null,
        lifecycle_recurring_kind: null,
        lifecycle_consume_on_first_event: null,
        lifecycle_end_on_events: null
      }
    ])
    expect(db.snapshot('effect_result_block_outcomes')).toEqual([
      {
        result_block_id: 'PATH_CODE-unsupported-heal__result',
        outcome_id: 'PATH_CODE-unsupported-heal-entry',
        effect_kind: EFFECT_KIND.HEAL,
        sort_order: 1
      }
    ])
    expect(db.snapshot('effect_generic_outcomes')).toEqual([
      {
        id: 'PATH_CODE-unsupported-heal-entry',
        effect_kind: EFFECT_KIND.HEAL,
        json_data: {
          id: 'PATH_CODE-unsupported-heal-entry',
          effectKind: EFFECT_KIND.HEAL,
          valueKind: 'DICE',
          diceConfig: '1d8'
        }
      }
    ])
  })
  it('persists generic roll-table outcome kinds through native effect result blocks', async () => {
    const db = new InMemoryDb()
    await expect(
      upsertEffect(
        db as never,
        {
          id: 'effect-unsupported-roll-table',
          order: 1,
          invocation: {
            triggerCode: TRIGGER.ENTER_AREA,
            activation: {
              code: ACTIVATION_CODE.REACTION,
              amount: 1
            },
            range: {
              id: 'range-unsupported-roll-table',
              rangeKind: RANGE_KIND.SELF
            }
          },
          paths: [
            {
              id: 'PATH_CODE-unsupported-roll-table',
              order: 1,
              pathCode: PATH_CODE.PASSIVE,
              groupType: PATH_GROUP_TYPE.CHOICE,
              selectionKind: 'ROLL_TABLE' as const,
              dieConfig: '1d4',
              rollTableKind: PATH_ROLL_TABLE_KIND.EXACT,
              rows: [
                {
                  id: 'PATH_CODE-unsupported-roll-table-entry',
                  order: 1,
                  rollValue: 1,
                  resolutionKind: 'RESULT',
                  resultBlock: {
                    id: 'PATH_CODE-unsupported-roll-table-entry__result',
                    resultKind: 'SINGLE' as const,
                    outcomes: [
                      {
                        id: 'PATH_CODE-unsupported-roll-table-entry',
                        effectKind: EFFECT_KIND.MANUAL_ADJUDICATION
                      }
                    ]
                  }
                }
              ]
            }
          ]
        } as never
      )
    ).resolves.toBeUndefined()
    expect(db.snapshot('effect_paths')).toEqual([
      {
        id: 'PATH_CODE-unsupported-roll-table',
        effect_id: 'effect-unsupported-roll-table',
        sort_order: 1,
        path_code: PATH_CODE.PASSIVE,
        group_type: PATH_GROUP_TYPE.CHOICE,
        selection_kind: 'ROLL_TABLE',
        origin_kind: null,
        range_override_characteristic_id: null,
        target_selection_kind: null,
        target_disposition_kind: null,
        max_targets: null,
        max_targets_scaling: null,
        resolution_count: null,
        resolution_count_scaling: null,
        allow_repeated_targets: null,
        excluded_creature_type_ids: null,
        result_block_id: null,
        roll_table_kind: PATH_ROLL_TABLE_KIND.EXACT,
        die: '1d4'
      }
    ])
    expect(db.snapshot('effect_path_roll_table_rows')).toEqual([
      {
        id: 'PATH_CODE-unsupported-roll-table-entry',
        path_id: 'PATH_CODE-unsupported-roll-table',
        result_block_id: 'PATH_CODE-unsupported-roll-table-entry__result',
        sort_order: 1,
        roll_value: 1,
        roll_min: null,
        roll_max: null,
        resolution_kind: 'RESULT',
        repeat_config: null
      }
    ])
    expect(db.snapshot('effect_result_blocks')).toEqual([
      {
        id: 'PATH_CODE-unsupported-roll-table-entry__result',
        result_kind: 'SINGLE',
        duration_id: null,
        lifecycle_recurring_kind: null,
        lifecycle_consume_on_first_event: null,
        lifecycle_end_on_events: null
      }
    ])
    expect(db.snapshot('effect_result_block_outcomes')).toEqual([
      {
        result_block_id: 'PATH_CODE-unsupported-roll-table-entry__result',
        outcome_id: 'PATH_CODE-unsupported-roll-table-entry',
        effect_kind: EFFECT_KIND.MANUAL_ADJUDICATION,
        sort_order: 1
      }
    ])
    expect(db.snapshot('effect_generic_outcomes')).toEqual([
      {
        id: 'PATH_CODE-unsupported-roll-table-entry',
        effect_kind: EFFECT_KIND.MANUAL_ADJUDICATION,
        json_data: {
          id: 'PATH_CODE-unsupported-roll-table-entry',
          effectKind: EFFECT_KIND.MANUAL_ADJUDICATION
        }
      }
    ])
  })
})
