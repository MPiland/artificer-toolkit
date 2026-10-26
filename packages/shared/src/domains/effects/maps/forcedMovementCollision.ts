import { type ForcedMovementCollisionAuthored } from '#authored'
import { buildNodeMap } from '#utils'

import { SAVING_THROW_NODE_MAP } from '../../shared/maps/index.js'

const forcedMovementCollision = buildNodeMap<ForcedMovementCollisionAuthored>()

export const FORCED_MOVEMENT_COLLISION_NODE_MAP = forcedMovementCollision.define(
  'forcedMovementCollision',
  ({ map, nodes, data }) => {
    const { text, selectSingle, groupObject } = nodes
    const { table } = data

    map
      .set('id', text(['id'], 'ID'))
      .set('diceConfig', text(['diceConfig'], 'Damage Dice Per 10 Feet', { requiredIf: true }))
      .set(
        'damageTypeId',
        selectSingle(
          ['damageTypeId'],
          'Damage Type',
          {
            kind: 'DATA',
            relationship: table('damage_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { requiredIf: true }
        )
      )
      .set(
        'savingThrow',
        groupObject(['savingThrow'], 'Struck Creature Save', () => SAVING_THROW_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
      .set(
        'conditionId',
        selectSingle(
          ['conditionId'],
          'Condition On Failure',
          {
            kind: 'DATA',
            relationship: table('condition_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { requiredIf: true }
        )
      )
  }
)
