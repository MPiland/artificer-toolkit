import type { SummonAttackAuthored, SummonStatBlockAuthored } from '#authored'
import { SUMMON_DAMAGEABILITY_KIND, SUMMON_VISIBILITY_KIND } from '#authored'
import { AUTHORED_LIMITS, buildNodeMap, type NodeMap } from '#utils'
import { NUMERIC_EXPR_NODE_MAP, SPEED_NODE_MAP } from '../../shared/maps/index.js'

type SummonAbilityScoresNode = NonNullable<SummonStatBlockAuthored['abilityScores']>

const SUMMON_DAMAGEABILITY_OPTIONS = [
  { code: SUMMON_DAMAGEABILITY_KIND.NORMAL, label: 'Normal' },
  { code: SUMMON_DAMAGEABILITY_KIND.INVULNERABLE, label: 'Invulnerable' },
  { code: SUMMON_DAMAGEABILITY_KIND.SPECIAL, label: 'Special' }
] as const

const SUMMON_VISIBILITY_OPTIONS = [
  { code: SUMMON_VISIBILITY_KIND.VISIBLE, label: 'Visible' },
  { code: SUMMON_VISIBILITY_KIND.INVISIBLE, label: 'Invisible' },
  { code: SUMMON_VISIBILITY_KIND.SPECIAL, label: 'Special' }
] as const

const summonAbilityScores = buildNodeMap<SummonAbilityScoresNode>()
const summonStatBlock = buildNodeMap<SummonStatBlockAuthored>()
const summonAttack = buildNodeMap<SummonAttackAuthored>()

const SUMMON_ABILITY_SCORES_NODE_MAP: NodeMap<SummonAbilityScoresNode> =
  summonAbilityScores.defineKeyed('summonAbilityScores', {
    rows: summonAbilityScores.data.table('abilities', {
      selectColumns: ['id', 'label', 'description']
    }),
    entry: {
      kind: 'GROUP',
      groupKind: 'OBJECT',
      presentation: 'inline',
      nodes: () => NUMERIC_EXPR_NODE_MAP
    }
  })

const SUMMON_ATTACK_NODE_MAP: NodeMap<SummonAttackAuthored> = summonAttack.define(
  'summonAttack',
  ({ map, nodes, data }) => {
    const { text, number, selectSingle } = nodes
    const { table } = data

    map
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order', { requiredIf: true }))
      .set('label', text(['label'], 'Label', { requiredIf: true }))
      .set('attackBonus', number(['attackBonus'], 'Attack Bonus', { requiredIf: true }))
      .set(
        'reachFeet',
        number(['reachFeet'], 'Reach (feet)', { constraints: { minimum: 1 }, requiredIf: true })
      )
      .set(
        'damageTypeId',
        selectSingle(
          ['damageTypeId'],
          'Damage Type',
          {
            kind: 'DATA',
            relationship: table('damage_types', { selectColumns: ['id', 'label', 'description'] })
          },
          { requiredIf: true }
        )
      )
      .set('diceConfig', text(['diceConfig'], 'Damage Dice', { requiredIf: true }))
  }
)

export const SUMMON_STAT_BLOCK_NODE_MAP: NodeMap<SummonStatBlockAuthored> = summonStatBlock.define(
  'summonStatBlock',
  ({ map, nodes, data }) => {
    const { selectSingle, text, toggle, groupObject, groupArray, selectMulti } = nodes
    const { table } = data

    map
      .set(
        'creatureTypeId',
        selectSingle(['creatureTypeId'], 'Creature Type', {
          kind: 'DATA',
          relationship: table('creature_types', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set(
        'attacks',
        groupArray(['attacks'], 'Attacks', () => SUMMON_ATTACK_NODE_MAP, {
          presentation: 'summary'
        })
      )
      .set(
        'size',
        selectSingle(['size'], 'Size', {
          kind: 'DATA',
          relationship: table('sizes', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set('occupiesSpace', toggle(['occupiesSpace'], 'Occupies Space'))
      .set(
        'armorClass',
        groupObject(['armorClass'], 'Armor Class', () => NUMERIC_EXPR_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'armorClassNote',
        text(['armorClassNote'], 'Armor Class Note', {
          constraints: { maximumLength: AUTHORED_LIMITS.plainTextCharacters }
        })
      )
      .set(
        'hitPoints',
        groupObject(['hitPoints'], 'Hit Points', () => NUMERIC_EXPR_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'speeds',
        groupArray(['speeds'], 'Movement', () => SPEED_NODE_MAP, { presentation: 'inline' })
      )
      .set(
        'abilityScores',
        groupObject(['abilityScores'], 'Ability Scores', () => SUMMON_ABILITY_SCORES_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'senses',
        selectMulti(['senses'], 'Senses', {
          kind: 'DATA',
          relationship: table('senses', {
            selectColumns: ['id', 'label', 'description']
          })
        })
      )
      .set(
        'passivePerception',
        groupObject(['passivePerception'], 'Passive Perception', () => NUMERIC_EXPR_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'damageVulnerabilities',
        selectMulti(['damageVulnerabilities'], 'Damage Vulnerabilities', {
          kind: 'DATA',
          relationship: table('damage_types', {
            selectColumns: ['id', 'label', 'description']
          })
        })
      )
      .set(
        'damageResistances',
        selectMulti(['damageResistances'], 'Damage Resistances', {
          kind: 'DATA',
          relationship: table('damage_types', {
            selectColumns: ['id', 'label', 'description']
          })
        })
      )
      .set(
        'damageImmunities',
        selectMulti(['damageImmunities'], 'Damage Immunities', {
          kind: 'DATA',
          relationship: table('damage_types', {
            selectColumns: ['id', 'label', 'description']
          })
        })
      )
      .set(
        'conditionImmunities',
        selectMulti(['conditionImmunities'], 'Condition Immunities', {
          kind: 'DATA',
          relationship: table('condition_types', {
            selectColumns: ['id', 'label', 'description']
          })
        })
      )
      .set(
        'damageabilityKind',
        selectSingle(['damageabilityKind'], 'Damageability', {
          kind: 'INLINE_OPTIONS',
          options: SUMMON_DAMAGEABILITY_OPTIONS
        })
      )
      .set(
        'visibilityKind',
        selectSingle(['visibilityKind'], 'Visibility', {
          kind: 'INLINE_OPTIONS',
          options: SUMMON_VISIBILITY_OPTIONS
        })
      )
  }
)
