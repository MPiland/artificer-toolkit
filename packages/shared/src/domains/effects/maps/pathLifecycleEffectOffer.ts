import type { PathLifecycleAuthored } from '#authored'
import { ACTIVATION_OPTIONS, LENGTH_UNIT_OPTIONS } from '#core'
import { buildNodeMap, type NodeMap } from '#utils'

const pathLifecycleEffectOffer =
  buildNodeMap<NonNullable<PathLifecycleAuthored['effectOffers']>[number]>()
const pathLifecycleEffectOfferRange =
  buildNodeMap<NonNullable<NonNullable<PathLifecycleAuthored['effectOffers']>[number]['range']>>()

const PATH_LIFECYCLE_EFFECT_OFFER_RANGE_NODE_MAP: NodeMap<
  NonNullable<NonNullable<PathLifecycleAuthored['effectOffers']>[number]['range']>
> = pathLifecycleEffectOfferRange.define('pathLifecycleEffectOfferRange', ({ map, nodes }) => {
  const { number, selectSingle } = nodes

  map
    .set('amount', number(['amount'], 'Range', { requiredIf: true, constraints: { minimum: 1 } }))
    .set(
      'unit',
      selectSingle(
        ['unit'],
        'Unit',
        { kind: 'INLINE_OPTIONS', options: LENGTH_UNIT_OPTIONS },
        { requiredIf: true }
      )
    )
})

export const PATH_LIFECYCLE_EFFECT_OFFER_NODE_MAP: NodeMap<
  NonNullable<PathLifecycleAuthored['effectOffers']>[number]
> = pathLifecycleEffectOffer.define('pathLifecycleEffectOffer', ({ map, nodes, cond }) => {
  const { selectSingle, selectMulti, groupObject } = nodes
  const isMove = cond.local().field(['kind']).eq('MOVE_HELD_EFFECT')
  const isRepeat = cond.local().field(['kind']).eq('REPEAT_SOURCE_PATH')

  map
    .set(
      'kind',
      selectSingle(
        ['kind'],
        'Offer',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'MOVE_HELD_EFFECT', label: 'Move the effect to another creature' },
            { code: 'REPEAT_SOURCE_PATH', label: 'Repeat paths of this effect against the holder' }
          ]
        },
        { requiredIf: true }
      )
    )
    .set(
      'offeredTo',
      selectSingle(
        ['offeredTo'],
        'Offered To',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'SOURCE', label: 'The effect source' },
            { code: 'HOLDER', label: 'The effect holder' }
          ]
        },
        { requiredIf: true }
      )
    )
    .set(
      'when',
      selectSingle(
        ['when'],
        'When',
        {
          kind: 'INLINE_OPTIONS',
          options: [{ code: 'HOLDER_AT_ZERO_HP', label: 'The holder is at 0 hit points' }]
        },
        { requiredIf: isMove, showIf: isMove, hiddenBehavior: 'CLEAR' }
      )
    )
    .set(
      'pathIds',
      selectMulti(
        ['pathIds'],
        'Paths Repeated',
        {
          kind: 'LOCAL_COLLECTION',
          // The offer sits in the path's result block lifecycle: lifecycle, result block, path, effect.
          up: 4,
          rootCollectionPath: ['paths'],
          valuePath: ['id'],
          labelPath: ['pathCode']
        },
        // Empty when the offer re-runs a sibling Effect instead; the schema requires one of the two.
        { showIf: isRepeat, hiddenBehavior: 'CLEAR' }
      )
    )
    .set(
      'effectId',
      selectSingle(
        ['effectId'],
        'Effect Repeated',
        {
          kind: 'LOCAL_COLLECTION',
          // lifecycle, result block, path, effect, then the subject whose Effects these are.
          up: 5,
          rootCollectionPath: ['effects'],
          valuePath: ['id'],
          labelPath: ['id']
        },
        { showIf: isRepeat, hiddenBehavior: 'CLEAR' }
      )
    )
    .set(
      'target',
      selectSingle(
        ['target'],
        'Repeated Against',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'HOLDER', label: 'The creature holding the effect' },
            { code: 'INVOCATION', label: 'Whoever the repeated action targets' }
          ]
        },
        { showIf: isRepeat, hiddenBehavior: 'CLEAR' }
      )
    )
    .set(
      'origin',
      selectSingle(
        ['origin'],
        'Measured From',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'ACTOR', label: 'The creature taking the offer' },
            { code: 'CONJURED', label: 'The creature the effect conjured' }
          ]
        },
        { showIf: isRepeat, hiddenBehavior: 'CLEAR' }
      )
    )
    .set(
      'activation',
      selectSingle(
        ['activation'],
        'Costs',
        {
          kind: 'INLINE_OPTIONS',
          options: ACTIVATION_OPTIONS.filter(({ code }) => code !== 'REACTION' && code !== 'FREE')
        },
        { requiredIf: true }
      )
    )
    .set(
      'range',
      groupObject(['range'], 'Range', () => PATH_LIFECYCLE_EFFECT_OFFER_RANGE_NODE_MAP, {
        presentation: 'inline',
        requiredIf: isMove,
        showIf: isMove,
        hiddenBehavior: 'CLEAR'
      })
    )
})
