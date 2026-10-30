import { EFFECT_KIND, MANIFEST_KIND } from '#core'
import {
  MANIFEST_CREATURE_FORM_FILTER_NODE_MAP,
  MANIFEST_CREATURE_FORM_NODE_MAP
} from './creatureForm.js'
import type { OutcomeNodeMapApi } from './path.js'

/**
 * The fields only a MANIFEST / CREATURE outcome has (D130, D191): the forms it offers, which
 * Creatures qualify, and what the wearer keeps of its own (excess damage, ability scores,
 * proficiencies). A MANIFEST / SUMMON outcome may offer forms too, and the Creature Types the caster
 * picks one of for the summoned form (SPELLS-34.T3a).
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
  const manifestsSummon = logic.and([
    local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST),
    local.field(['manifestKind']).eq(MANIFEST_KIND.SUMMON)
  ])
  const { table } = data

  map
    .set(
      'forms',
      groupArray(['forms'], 'Forms', () => MANIFEST_CREATURE_FORM_NODE_MAP, {
        presentation: 'summary',
        showIf: logic.or([manifestsCreature, manifestsSummon])
      })
    )
    .set(
      'creatureTypeIds',
      selectMulti(
        ['creatureTypeIds'],
        'Creature Type Choices',
        {
          kind: 'DATA',
          relationship: table('creature_types', { selectColumns: ['id', 'label', 'description'] })
        },
        { showIf: manifestsSummon }
      )
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
