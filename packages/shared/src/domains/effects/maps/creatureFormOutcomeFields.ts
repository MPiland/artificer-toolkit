import type { ManifestCreatureFormAuthored, ManifestCreatureFormFilterAuthored } from '#authored'
import { EFFECT_KIND, MANIFEST_KIND } from '#core'
import { buildNodeMap, type NodeMap } from '#utils'
import type { OutcomeNodeMapApi } from './path.js'

const manifestCreatureForm = buildNodeMap<ManifestCreatureFormAuthored>()
const manifestCreatureFormFilter = buildNodeMap<ManifestCreatureFormFilterAuthored>()

const MANIFEST_CREATURE_FORM_NODE_MAP: NodeMap<ManifestCreatureFormAuthored> =
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

const MANIFEST_CREATURE_FORM_FILTER_NODE_MAP: NodeMap<ManifestCreatureFormFilterAuthored> =
  manifestCreatureFormFilter.define('manifestCreatureFormFilter', ({ map, nodes, cond, data }) => {
    const { text, selectSingle, selectMulti } = nodes
    const local = cond.local()
    const { table } = data

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
              { code: 'FIXED', label: 'Fixed Challenge Rating' }
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
            requiredIf: local.field(['challengeRatingCapKind']).eq('FIXED'),
            showIf: local.field(['challengeRatingCapKind']).eq('FIXED')
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
  })

/**
 * The fields only a MANIFEST / CREATURE outcome has (D130, D191): the forms it offers, which
 * Creatures qualify, and what the wearer keeps of its own (excess damage, ability scores,
 * proficiencies).
 */
export function registerCreatureFormOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  logic: OutcomeNodeMapApi['logic'],
  data: OutcomeNodeMapApi['data']
) {
  const { selectMulti, toggle, groupArray, groupObject } = nodes
  const local = cond.local()
  const manifestsCreature = logic.and([
    local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST),
    local.field(['manifestKind']).eq(MANIFEST_KIND.CREATURE)
  ])
  const { table } = data

  map
    .set(
      'forms',
      groupArray(['forms'], 'Forms', () => MANIFEST_CREATURE_FORM_NODE_MAP, {
        presentation: 'summary',
        showIf: manifestsCreature
      })
    )
    .set(
      'formFilter',
      groupObject(['formFilter'], 'Form Filter', () => MANIFEST_CREATURE_FORM_FILTER_NODE_MAP, {
        presentation: 'inline',
        showIf: manifestsCreature
      })
    )
    .set(
      'excessDamageCarriesOver',
      toggle(['excessDamageCarriesOver'], 'Excess Damage Carries Over', {
        showIf: manifestsCreature
      })
    )
    .set(
      'retainedAbilityDefinitionIds',
      selectMulti(
        ['retainedAbilityDefinitionIds'],
        'Retained Ability Scores',
        {
          kind: 'DATA',
          relationship: table('ability_definitions', {
            selectColumns: ['id', 'label', 'description']
          })
        },
        { showIf: manifestsCreature }
      )
    )
    .set(
      'retainsProficiencies',
      toggle(['retainsProficiencies'], 'Retains Proficiencies', {
        showIf: manifestsCreature
      })
    )
}
