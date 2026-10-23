import { type PathLifecycleAuthored } from '#authored'
import { buildNodeMap, type NodeMap } from '#utils'

type PathLifecycleEndTriggerNode = NonNullable<PathLifecycleAuthored['endOnTriggers']>[number]

const pathLifecycleEndTrigger = buildNodeMap<PathLifecycleEndTriggerNode>()
export const PATH_LIFECYCLE_END_TRIGGER_NODE_MAP: NodeMap<PathLifecycleEndTriggerNode> =
  pathLifecycleEndTrigger.define('pathLifecycleEndTrigger', ({ map, nodes, data, cond, logic }) => {
    const { selectSingle, selectMulti, number } = nodes
    const { table } = data
    const event = cond.local().field(['event'])
    const isDamageTaken = event.eq('DAMAGE_TAKEN')
    const isAgainstEnemy = logic.or([event.eq('ATTACK_ROLL'), event.eq('SPELL_CAST')])
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
              { code: 'DAMAGE_TAKEN', label: 'The holder takes damage' },
              { code: 'ATTACK_ROLL', label: 'The holder attacks an enemy' },
              { code: 'SPELL_CAST', label: 'The holder casts a spell at an enemy' },
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
        'against',
        selectSingle(
          ['against'],
          'Against',
          { kind: 'INLINE_OPTIONS', options: [{ code: 'ENEMY', label: 'An enemy of the holder' }] },
          { requiredIf: isAgainstEnemy, showIf: isAgainstEnemy }
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
