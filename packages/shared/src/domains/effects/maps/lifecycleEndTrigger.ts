import { type PathLifecycleAuthored } from '#authored'
import { buildNodeMap, type NodeMap } from '#utils'

type PathLifecycleEndTriggerNode = NonNullable<PathLifecycleAuthored['endTriggers']>[number]

const CODE_COLUMNS = ['id', 'label', 'description'] as const

const pathLifecycleEndTrigger = buildNodeMap<PathLifecycleEndTriggerNode>()
export const PATH_LIFECYCLE_END_TRIGGER_NODE_MAP: NodeMap<PathLifecycleEndTriggerNode> =
  pathLifecycleEndTrigger.define('pathLifecycleEndTrigger', ({ map, nodes, data, cond }) => {
    const { selectSingle, selectMulti, number } = nodes
    const { table, condition } = data
    const local = cond.local()
    const event = local.field(['event'])
    const isLifecycle = event.eq('LIFECYCLE')
    const isDamageTaken = event.eq('DAMAGE_TAKEN')
    const isActionTrait = event.eq('ACTION_TRAIT')
    const isActionUsed = event.eq('ACTION_USED_ON_HOLDER')
    const isIncapacitated = event.eq('INCAPACITATED')
    const isSeparated = event.eq('SEPARATED')

    map
      .set(
        'event',
        selectSingle(
          ['event'],
          'Ends When',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'LIFECYCLE', label: 'A System lifecycle event' },
              { code: 'DAMAGE_TAKEN', label: 'The holder takes damage' },
              { code: 'ACTION_TRAIT', label: 'The holder acts against an enemy' },
              {
                code: 'ACTION_USED_ON_HOLDER',
                label: 'Another creature uses an action on the holder'
              },
              { code: 'INCAPACITATED', label: 'The effect source is incapacitated or defeated' },
              { code: 'SEPARATED', label: 'The holder is too far from the effect source' }
            ]
          },
          { requiredIf: true }
        )
      )
      .set(
        'timing',
        selectSingle(
          ['timing'],
          'Timing',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'CONSUME', label: 'Used up: applies to the event, then ends' },
              { code: 'END', label: 'Ends on the event' }
            ]
          },
          { requiredIf: isLifecycle, showIf: isLifecycle }
        )
      )
      .set(
        'code',
        selectSingle(
          ['code'],
          'Event',
          {
            kind: 'DATA',
            relationship: condition((c) =>
              c
                .if(local.field(['timing']).eq('CONSUME'))
                .then((o) => o.table('effect_consume_events', { selectColumns: CODE_COLUMNS }))
                .else((o) => o.table('effect_end_events', { selectColumns: CODE_COLUMNS }))
            )
          },
          { requiredIf: isLifecycle, showIf: isLifecycle }
        )
      )
      .set(
        'by',
        selectSingle(
          ['by'],
          'Damage From',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'ANYONE', label: 'Anyone' },
              { code: 'SOURCE_SIDE', label: 'The effect source or its allies' }
            ]
          },
          { requiredIf: isDamageTaken, showIf: isDamageTaken }
        )
      )
      .set(
        'damageTypeIds',
        selectMulti(
          ['damageTypeIds'],
          'Damage Types (any when empty)',
          {
            kind: 'DATA',
            relationship: table('damage_types', { selectColumns: ['id', 'label', 'description'] })
          },
          { showIf: isDamageTaken }
        )
      )
      .set(
        'trait',
        selectSingle(
          ['trait'],
          'Action Trait',
          {
            kind: 'DATA',
            relationship: table('action_traits', { selectColumns: ['id', 'label', 'description'] })
          },
          { requiredIf: isActionTrait, showIf: isActionTrait }
        )
      )
      .set(
        'against',
        selectSingle(
          ['against'],
          'Against',
          { kind: 'INLINE_OPTIONS', options: [{ code: 'ENEMY', label: 'An enemy of the holder' }] },
          { requiredIf: isActionTrait, showIf: isActionTrait }
        )
      )
      .set(
        'of',
        selectSingle(
          ['of'],
          'Whose Incapacitation',
          { kind: 'INLINE_OPTIONS', options: [{ code: 'SOURCE', label: 'The effect source' }] },
          { requiredIf: isIncapacitated, showIf: isIncapacitated }
        )
      )
      .set(
        'from',
        selectSingle(
          ['from'],
          'Separated From',
          { kind: 'INLINE_OPTIONS', options: [{ code: 'SOURCE', label: 'The effect source' }] },
          { requiredIf: isSeparated, showIf: isSeparated }
        )
      )
      .set(
        'beyondFeet',
        number(['beyondFeet'], 'Farther Than (feet)', {
          requiredIf: isSeparated,
          showIf: isSeparated,
          constraints: { minimum: 1 }
        })
      )
      .set(
        'actionDefinitionIds',
        selectMulti(
          ['actionDefinitionIds'],
          'Actions',
          {
            kind: 'DATA',
            relationship: table('reusable_definitions', { selectColumns: ['id', 'label'] })
          },
          { requiredIf: isActionUsed, showIf: isActionUsed }
        )
      )
  })
