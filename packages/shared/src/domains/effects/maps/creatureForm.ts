import type { ManifestCreatureFormAuthored, ManifestCreatureFormFilterAuthored } from '#authored'
import { buildNodeMap, type NodeMap } from '#utils'
import { createBreakpointScalingNodeMap } from '../../shared/maps/index.js'

const manifestCreatureForm = buildNodeMap<ManifestCreatureFormAuthored>()
const manifestCreatureFormFilter = buildNodeMap<ManifestCreatureFormFilterAuthored>()

export const MANIFEST_CREATURE_FORM_NODE_MAP: NodeMap<ManifestCreatureFormAuthored> =
  manifestCreatureForm.define('manifestCreatureForm', ({ map, nodes, data }) => {
    const { text, number, selectSingle } = nodes
    const { table } = data

    map
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order', { requiredIf: true }))
      .set('label', text(['label'], 'Label', { requiredIf: true }))
      .set(
        'creatureId',
        selectSingle(
          ['creatureId'],
          'Creature',
          {
            kind: 'DATA',
            relationship: table('creatures', { selectColumns: ['id', 'label'] })
          },
          { requiredIf: true }
        )
      )
      .set(
        'maxTargets',
        number(['maxTargets'], 'Maximum Creatures', {
          constraints: { minimum: 1 },
          requiredIf: true
        })
      )
  })

type CreatureFormFilterScaledCapAuthored = {
  maxChallengeRatingId: string
  excludedSpeedIds?: string[]
}

const creatureFormFilterScaledCap = buildNodeMap<CreatureFormFilterScaledCapAuthored>()

const CREATURE_FORM_FILTER_SCALED_CAP_NODE_MAP = creatureFormFilterScaledCap.define(
  'creatureFormFilterScaledCap',
  ({ map, nodes, data }) => {
    const { selectSingle, selectMulti } = nodes
    const { table } = data

    map
      .set(
        'maxChallengeRatingId',
        selectSingle(
          ['maxChallengeRatingId'],
          'Maximum Challenge Rating',
          {
            kind: 'DATA',
            relationship: table('challenge_ratings', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { requiredIf: true }
        )
      )
      .set(
        'excludedSpeedIds',
        selectMulti(['excludedSpeedIds'], 'Excluded Speeds', {
          kind: 'DATA',
          relationship: table('speeds', { selectColumns: ['id', 'label', 'description'] })
        })
      )
  }
)

const CREATURE_FORM_FILTER_SCALING_NODE_MAP = createBreakpointScalingNodeMap(
  'creatureFormFilterScaling',
  'Challenge Rating Cap',
  CREATURE_FORM_FILTER_SCALED_CAP_NODE_MAP
)

export const MANIFEST_CREATURE_FORM_FILTER_NODE_MAP: NodeMap<ManifestCreatureFormFilterAuthored> =
  manifestCreatureFormFilter.define(
    'manifestCreatureFormFilter',
    ({ map, nodes, cond, data, logic }) => {
      const { text, selectSingle, selectMulti, groupObject } = nodes
      const local = cond.local()
      const { table } = data
      const { or } = logic

      map
        .set('id', text(['id'], 'ID'))
        .set(
          'creatureTypeId',
          selectSingle(['creatureTypeId'], 'Creature Type', {
            kind: 'DATA',
            relationship: table('creature_types', { selectColumns: ['id', 'label', 'description'] })
          })
        )
        .set(
          'challengeRatingCapKind',
          selectSingle(
            ['challengeRatingCapKind'],
            'Challenge Rating Cap',
            {
              kind: 'INLINE_OPTIONS',
              options: [
                { code: 'TARGET', label: "Target's Challenge Rating or Level" },
                { code: 'FIXED', label: 'Fixed Challenge Rating' },
                { code: 'SCALED', label: 'Challenge Rating By Class Level' }
              ]
            },
            { requiredIf: true }
          )
        )
        .set(
          'maxChallengeRatingId',
          selectSingle(
            ['maxChallengeRatingId'],
            'Maximum Challenge Rating',
            {
              kind: 'DATA',
              relationship: table('challenge_ratings', {
                selectColumns: ['id', 'label', 'description']
              })
            },
            {
              requiredIf: or([
                local.field(['challengeRatingCapKind']).eq('FIXED'),
                local.field(['challengeRatingCapKind']).eq('SCALED')
              ]),
              showIf: or([
                local.field(['challengeRatingCapKind']).eq('FIXED'),
                local.field(['challengeRatingCapKind']).eq('SCALED')
              ])
            }
          )
        )
        .set(
          'excludedSpeedIds',
          selectMulti(['excludedSpeedIds'], 'Excluded Speeds', {
            kind: 'DATA',
            relationship: table('speeds', { selectColumns: ['id', 'label', 'description'] })
          })
        )
        .set(
          'scaling',
          groupObject(['scaling'], 'Scaling', () => CREATURE_FORM_FILTER_SCALING_NODE_MAP, {
            presentation: 'inline',
            requiredIf: local.field(['challengeRatingCapKind']).eq('SCALED'),
            showIf: local.field(['challengeRatingCapKind']).eq('SCALED')
          })
        )
    }
  )
