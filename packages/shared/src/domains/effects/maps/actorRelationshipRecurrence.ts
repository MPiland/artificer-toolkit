import type { ActorRelationshipAuthored } from '#authored'
import { EFFECT_KIND } from '#core'
import { buildNodeMap } from '#utils'
import type { AllUnionFields } from 'type-fest'
import { SAVING_THROW_NODE_MAP } from '../../shared/maps/index.js'
import { PATH_LIFECYCLE_TURN_ANCHOR_NODE_MAP } from './pathLifecycleTurnAnchor.js'

type ActorRelationshipRecurrenceNode = NonNullable<ActorRelationshipAuthored['recurrence']>

const actorRelationshipRecurrence = buildNodeMap<ActorRelationshipRecurrenceNode>()
const actorRelationshipRecurrenceOutcome =
  buildNodeMap<AllUnionFields<ActorRelationshipRecurrenceNode['outcome']>>()

/** The one exact dice roll a hold recurs: damage of one type, or hit points lost directly. */
const ACTOR_RELATIONSHIP_RECURRENCE_OUTCOME_NODE_MAP = actorRelationshipRecurrenceOutcome.define(
  'actorRelationshipRecurrenceOutcome',
  ({ map, nodes, cond, data }) => {
    const { text, selectSingle } = nodes
    const local = cond.local()
    const dealsDamage = local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE)
    map
      .set('id', text(['id'], 'ID'))
      .set(
        'effectKind',
        selectSingle(
          ['effectKind'],
          'Outcome',
          {
            kind: 'INLINE_OPTIONS' as const,
            options: [
              { code: EFFECT_KIND.DAMAGE, label: 'Damage' },
              { code: 'HIT_POINT_LOSS', label: 'Hit Point Loss' }
            ]
          },
          { requiredIf: true }
        )
      )
      .set(
        'damageTypeId',
        selectSingle(
          ['damageTypeId'],
          'Damage Type',
          {
            kind: 'DATA',
            relationship: data.table('damage_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { requiredIf: dealsDamage, showIf: dealsDamage }
        )
      )
      .set(
        'valueKind',
        selectSingle(
          ['valueKind'],
          'Value Kind',
          { kind: 'INLINE_OPTIONS' as const, options: [{ code: 'DICE', label: 'Dice' }] },
          {
            requiredIf: dealsDamage,
            showIf: dealsDamage
          }
        )
      )
      .set(
        'scalingKind',
        selectSingle(
          ['scalingKind'],
          'Scaling Kind',
          { kind: 'INLINE_OPTIONS' as const, options: [{ code: 'NONE', label: 'None' }] },
          { requiredIf: dealsDamage, showIf: dealsDamage }
        )
      )
      .set('diceConfig', text(['diceConfig'], 'Dice Config', { requiredIf: true }))
  }
)

/** A hold's recurrence: the turn it counts on, an optional held-creature save and its outcome. */
export const ACTOR_RELATIONSHIP_RECURRENCE_NODE_MAP = actorRelationshipRecurrence.define(
  'actorRelationshipRecurrence',
  ({ map, nodes }) => {
    const { groupObject } = nodes
    map
      .set(
        'turnAnchor',
        groupObject(['turnAnchor'], 'Turn Anchor', () => PATH_LIFECYCLE_TURN_ANCHOR_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
      .set(
        'savingThrow',
        groupObject(['savingThrow'], 'Held Creature Save', () => SAVING_THROW_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'outcome',
        groupObject(['outcome'], 'Outcome', () => ACTOR_RELATIONSHIP_RECURRENCE_OUTCOME_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
  }
)
