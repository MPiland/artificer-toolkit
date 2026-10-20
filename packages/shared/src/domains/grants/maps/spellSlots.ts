import type { SpellSlotTableAuthored } from '#authored'
import { buildNodeMap } from '#utils'
import { CHARGE_RESET_OPTIONS } from '#core'

const spellSlotLevel = buildNodeMap<SpellSlotTableAuthored['levels'][number]>()

const SPELL_SLOT_LEVEL_NODE_MAP = spellSlotLevel.define('spellSlotLevels', ({ map, nodes }) => {
  const { number } = nodes

  map
    .set('level', number(['level'], 'Spell Level', { order: 1, requiredIf: true }))
    .set('amount', number(['amount'], 'Slots', { order: 2, requiredIf: true }))
})

const spellSlotTable = buildNodeMap<SpellSlotTableAuthored>()

export const SPELL_SLOT_TABLE_NODE_MAP = spellSlotTable.define(
  'spellSlotTable',
  ({ map, nodes }) => {
    const { groupArray, selectSingle } = nodes

    map
      .set(
        'resetKind',
        selectSingle(
          ['resetKind'],
          'Reset Kind',
          { kind: 'INLINE_OPTIONS', options: CHARGE_RESET_OPTIONS },
          { order: 1, requiredIf: true }
        )
      )
      .set(
        'levels',
        groupArray(['levels'], 'Slots by Spell Level', () => SPELL_SLOT_LEVEL_NODE_MAP, {
          presentation: 'table',
          order: 2
        })
      )
  }
)
