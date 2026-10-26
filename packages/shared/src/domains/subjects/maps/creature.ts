import {
  CREATURE_CATEGORY_CODE,
  CREATURE_MOUNT_TYPE_CODE,
  CREATURE_COMPANION_BOND_TYPE_CODE,
  CREATURE_INITIATIVE_MODE_CODE,
  DAMAGE_DEFENSE_BYPASS_OPTIONS,
  MEASUREMENT_UNIT_OPTIONS,
  type DiceExpression
} from '#core'
import {
  CREATURE_FEATURE_NODE_MAP,
  PROFICIENCY_NODE_MAP,
  SENSE_RANGE_NODE_MAP,
  SPEED_NODE_MAP
} from '#maps'
import { AUTHORED_LIMITS, buildNodeMap } from '#utils'
import type {
  CapacityAuthored,
  CostAuthored,
  CreatureAuthored,
  CreatureCompanionProfile,
  CreatureEquipmentLoadoutEntry,
  CreatureMountProfile,
  CreatureNpcProfile,
  CreatureQualifiedDamageDefenseAuthored,
  CreatureSenseAuthored,
  DetailAuthored
} from '#authored'

export const CREATURE_SECTIONS = {
  basics: { id: 'basics', label: 'Basics', order: 10 },
  stats: { id: 'stats', label: 'Stats', order: 20 },
  defenses: { id: 'defenses', label: 'Defenses', order: 30 },
  details: { id: 'details', label: 'Details', order: 40 },
  features: { id: 'features', label: 'Features', order: 50 },
  equipment: { id: 'equipment', label: 'Equipment / Loadout', order: 60 },
  proficiencies: { id: 'proficiencies', label: 'Proficiencies', order: 70 },
  profiles: { id: 'profiles', label: 'Profiles', order: 80 }
} as const

const detailNode = buildNodeMap<DetailAuthored>()

export const CREATURE_DETAIL_NODE_MAP = detailNode.define('creatureDetail', ({ map, nodes }) => {
  const { text, richText, number } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', richText(['description'], 'Description'))
    .set('order', number(['order'], 'Order'))
})

const mountNode = buildNodeMap<CreatureMountProfile>()

export const CREATURE_MOUNT_PROFILE_NODE_MAP = mountNode.define(
  'creatureMountProfile',
  ({ map, nodes }) => {
    const { text, number, selectSingle } = nodes

    map
      .set(
        'mountType',
        selectSingle(['mountType'], 'Mount Type', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: CREATURE_MOUNT_TYPE_CODE.CONTROLLED, label: 'Controlled' },
            { code: CREATURE_MOUNT_TYPE_CODE.INDEPENDENT, label: 'Independent' }
          ]
        })
      )
      .set('capacity', number(['capacity'], 'Carrying Capacity'))
      .set('riderCount', number(['riderCount'], 'Rider Count'))
      .set(
        'notes',
        text(['notes'], 'Notes', {
          constraints: { maximumLength: AUTHORED_LIMITS.plainTextCharacters }
        })
      )
  }
)

const companionNode = buildNodeMap<CreatureCompanionProfile>()

export const CREATURE_COMPANION_PROFILE_NODE_MAP = companionNode.define(
  'creatureCompanionProfile',
  ({ map, nodes }) => {
    const { text, selectSingle } = nodes

    map
      .set(
        'bondType',
        selectSingle(['bondType'], 'Bond Type', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: CREATURE_COMPANION_BOND_TYPE_CODE.FAMILIAR, label: 'Familiar' },
            { code: CREATURE_COMPANION_BOND_TYPE_CODE.ANIMAL_COMPANION, label: 'Animal Companion' },
            { code: CREATURE_COMPANION_BOND_TYPE_CODE.SUMMON, label: 'Summon' }
          ]
        })
      )
      .set(
        'initiativeMode',
        selectSingle(['initiativeMode'], 'Initiative Mode', {
          kind: 'INLINE_OPTIONS',
          options: [
            {
              code: CREATURE_INITIATIVE_MODE_CODE.USES_PC_INITIATIVE,
              label: "Uses PC's Initiative"
            },
            { code: CREATURE_INITIATIVE_MODE_CODE.OWN_INITIATIVE, label: 'Own Initiative' }
          ]
        })
      )
      .set(
        'notes',
        text(['notes'], 'Notes', {
          constraints: { maximumLength: AUTHORED_LIMITS.plainTextCharacters }
        })
      )
  }
)

const npcNode = buildNodeMap<CreatureNpcProfile>()

export const CREATURE_NPC_PROFILE_NODE_MAP = npcNode.define(
  'creatureNpcProfile',
  ({ map, nodes }) => {
    const { groupArray } = nodes

    const stringNode = buildNodeMap<{ value: string }>().define(
      'string',
      ({ map: m, nodes: n }) => {
        m.set(
          'value',
          n.text(['value'], 'Value', {
            constraints: { maximumLength: AUTHORED_LIMITS.plainTextCharacters }
          })
        )
      }
    )

    map
      .set(
        'bonds',
        groupArray(['bonds'], 'Bonds', () => stringNode, { presentation: 'inline' })
      )
      .set(
        'flaws',
        groupArray(['flaws'], 'Flaws', () => stringNode, { presentation: 'inline' })
      )
      .set(
        'ideals',
        groupArray(['ideals'], 'Ideals', () => stringNode, { presentation: 'inline' })
      )
      .set(
        'personalityTraits',
        groupArray(['personalityTraits'], 'Personality Traits', () => stringNode, {
          presentation: 'inline'
        })
      )
  }
)

const costNode = buildNodeMap<CostAuthored>()

export const CREATURE_COST_NODE_MAP = costNode.define('creatureCost', ({ map, nodes, data }) => {
  const { number, selectSingle } = nodes
  const { table } = data

  map.set('amount', number(['amount'], 'Amount')).set(
    'currencyId',
    selectSingle(['currencyId'], 'Currency', {
      kind: 'DATA',
      relationship: table('currencies', {
        selectColumns: ['id', 'label', 'description']
      })
    })
  )
})

const capacityNode = buildNodeMap<CapacityAuthored>()

export const CREATURE_CAPACITY_NODE_MAP = capacityNode.define(
  'creatureCapacity',
  ({ map, nodes }) => {
    const { number, selectSingle } = nodes

    map.set('amount', number(['amount'], 'Amount')).set(
      'unit',
      selectSingle(['unit'], 'Unit', {
        kind: 'INLINE_OPTIONS',
        options: MEASUREMENT_UNIT_OPTIONS
      })
    )
  }
)

const creatureNode = buildNodeMap<CreatureAuthored>()

const creatureEquipmentLoadoutNode = buildNodeMap<CreatureEquipmentLoadoutEntry>()

export const CREATURE_EQUIPMENT_LOADOUT_NODE_MAP = creatureEquipmentLoadoutNode.define(
  'creatureEquipmentLoadout',
  ({ map, nodes, data }) => {
    map
      .set('id', nodes.text(['id'], 'ID'))
      .set(
        'equipmentId',
        nodes.selectSingle(['equipmentId'], 'Equipment', {
          kind: 'DATA',
          relationship: data.table('equipment', { selectColumns: ['id', 'label'] })
        })
      )
      .set('quantity', nodes.number(['quantity'], 'Quantity', { constraints: { minimum: 1 } }))
      .set(
        'useState',
        nodes.selectSingle(['useState'], 'Use State', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'MAIN_HAND', label: 'Main hand' },
            { code: 'OFF_HAND', label: 'Off hand' },
            { code: 'CARRIED', label: 'Carried' },
            { code: 'WORN', label: 'Worn' }
          ]
        })
      )
      .set('attuned', nodes.toggle(['attuned'], 'Attuned'))
      .set(
        'actionFeatureIds',
        nodes.selectMulti(['actionFeatureIds'], 'Bound Action Features', {
          kind: 'LOCAL_COLLECTION',
          rootCollectionPath: ['features'],
          valuePath: ['id'],
          labelPath: ['label']
        })
      )
  }
)

const qualifiedDamageDefenseNode = buildNodeMap<CreatureQualifiedDamageDefenseAuthored>()

export const CREATURE_QUALIFIED_DAMAGE_DEFENSE_NODE_MAP = qualifiedDamageDefenseNode.define(
  'creatureQualifiedDamageDefense',
  ({ map, nodes, data }) => {
    map
      .set(
        'kind',
        nodes.selectSingle(['kind'], 'Defense', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'RESISTANCE', label: 'Resistance' },
            { code: 'IMMUNITY', label: 'Immunity' }
          ]
        })
      )
      .set(
        'damageTypeIds',
        nodes.selectMulti(['damageTypeIds'], 'Damage Types', {
          kind: 'DATA',
          relationship: data.table('damage_types', {
            selectColumns: ['id', 'label', 'description']
          })
        })
      )
      .set(
        'bypassedBy',
        nodes.selectMulti(['bypassedBy'], 'Except Attacks That Are', {
          kind: 'INLINE_OPTIONS',
          options: DAMAGE_DEFENSE_BYPASS_OPTIONS
        })
      )
  }
)

const senseNode = buildNodeMap<CreatureSenseAuthored>()

export const CREATURE_SENSE_NODE_MAP = senseNode.define('creatureSense', ({ map, nodes, data }) => {
  map
    .set(
      'senseDefinitionId',
      nodes.selectSingle(
        ['senseDefinitionId'],
        'Sense',
        {
          kind: 'DATA',
          relationship: data.table('senses', {
            selectColumns: ['id', 'label', 'description']
          })
        },
        { order: 1, requiredIf: true }
      )
    )
    .set(
      'range',
      nodes.groupObject(['range'], 'Range', () => SENSE_RANGE_NODE_MAP, {
        presentation: 'inline',
        order: 2,
        requiredIf: true
      })
    )
    .set('qualifier', nodes.text(['qualifier'], 'Note', { order: 3 }))
})

const abilityScoresNode = buildNodeMap<Record<string, number>>()
const ABILITY_SCORES_NODE_MAP = abilityScoresNode.defineKeyed('abilityScores', {
  rows: abilityScoresNode.data.table('abilities', {
    selectColumns: ['id', 'label', 'description']
  }),
  entry: { kind: 'INPUT', type: 'NUMBER' }
})

const diceExpressionNode = buildNodeMap<DiceExpression>()

export const CREATURE_HIT_DICE_NODE_MAP = diceExpressionNode.define(
  'creatureHitDice',
  ({ map, nodes }) => {
    map
      .set('count', nodes.number(['count'], 'Count'))
      .set('die', nodes.number(['die'], 'Die'))
      .set('modifier', nodes.number(['modifier'], 'Modifier'))
  }
)

export const CREATURE_NODE_MAP = creatureNode.define(
  'creature',
  ({ map, nodes, cond, data, logic }) => {
    const { text, richText, number, selectMulti, selectSingle, groupArray, groupObject } = nodes
    const { table } = data
    const local = cond.local()
    const { or } = logic
    const isBeast = local.field(['category']).eq(CREATURE_CATEGORY_CODE.BEAST)
    const isNpc = local.field(['category']).eq(CREATURE_CATEGORY_CODE.NPC)
    const isCompanion = local.field(['category']).eq(CREATURE_CATEGORY_CODE.COMPANION)
    const isSummon = local.field(['category']).eq(CREATURE_CATEGORY_CODE.SUMMON)
    const isCompanionOrSummon = or([isCompanion, isSummon])

    const tagNode = buildNodeMap<{ value: string }>().define('tag', ({ map: m, nodes: n }) => {
      m.set('value', n.text(['value'], 'Tag'))
    })

    map
      // Identity
      .set('id', text(['id'], 'ID'))
      .set(
        'label',
        text(['label'], 'Name', {
          section: CREATURE_SECTIONS.basics,
          order: 10,
          requiredIf: true
        })
      )
      .set('quote', richText(['quote'], 'Quote', { section: CREATURE_SECTIONS.basics, order: 20 }))
      .set(
        'description',
        richText(['description'], 'Description', { section: CREATURE_SECTIONS.basics, order: 30 })
      )
      .set(
        'details',
        groupArray(['details'], 'Details', () => CREATURE_DETAIL_NODE_MAP, {
          presentation: 'inline',
          section: CREATURE_SECTIONS.details,
          order: 10
        })
      )
      .set(
        'features',
        groupArray(['features'], 'Features', () => CREATURE_FEATURE_NODE_MAP, {
          presentation: 'branch',
          section: CREATURE_SECTIONS.features,
          order: 10
        })
      )
      .set(
        'equipmentLoadout',
        groupArray(
          ['equipmentLoadout'],
          'Equipment Loadout',
          () => CREATURE_EQUIPMENT_LOADOUT_NODE_MAP,
          {
            presentation: 'table',
            section: CREATURE_SECTIONS.equipment,
            order: 10
          }
        )
      )
      .set(
        'proficiencies',
        groupArray(['proficiencies'], 'Proficiencies', () => PROFICIENCY_NODE_MAP, {
          presentation: 'branch',
          section: CREATURE_SECTIONS.proficiencies,
          order: 10
        })
      )
      .set('userId', text(['userId'], 'User ID'))
      .set('systemId', text(['systemId'], 'System ID'))
      .set(
        'category',
        selectSingle(
          ['category'],
          'Category',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: CREATURE_CATEGORY_CODE.MONSTER, label: 'Monster' },
              { code: CREATURE_CATEGORY_CODE.BEAST, label: 'Beast' },
              { code: CREATURE_CATEGORY_CODE.NPC, label: 'NPC' },
              { code: CREATURE_CATEGORY_CODE.COMPANION, label: 'Companion' },
              { code: CREATURE_CATEGORY_CODE.SUMMON, label: 'Summon' }
            ]
          },
          { section: CREATURE_SECTIONS.basics, order: 50 }
        )
      )
      .set(
        'creatureTypeId',
        selectSingle(
          ['creatureTypeId'],
          'Creature Type',
          {
            kind: 'DATA',
            relationship: table('creature_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { section: CREATURE_SECTIONS.basics, order: 60 }
        )
      )
      .set(
        'size',
        selectSingle(
          ['size'],
          'Size',
          {
            kind: 'DATA',
            relationship: table('sizes', { selectColumns: ['id', 'label', 'description'] })
          },
          { section: CREATURE_SECTIONS.basics, order: 70 }
        )
      )
      .set(
        'alignmentId',
        selectSingle(
          ['alignmentId'],
          'Alignment',
          {
            kind: 'DATA',
            relationship: table('alignments', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { section: CREATURE_SECTIONS.basics, order: 80 }
        )
      )
      .set(
        'tags',
        groupArray(['tags'], 'Tags', () => tagNode, {
          presentation: 'inline',
          section: CREATURE_SECTIONS.basics,
          order: 90
        })
      )

      // Core stats
      .set(
        'abilityScores',
        groupObject(['abilityScores'], 'Ability Scores', () => ABILITY_SCORES_NODE_MAP, {
          presentation: 'inline',
          section: CREATURE_SECTIONS.stats,
          order: 10
        })
      )
      .set(
        'naturalArmorBonus',
        number(['naturalArmorBonus'], 'Natural Armor Bonus', {
          section: CREATURE_SECTIONS.stats,
          order: 20
        })
      )
      .set(
        'hitPoints',
        number(['hitPoints'], 'Hit Points', { section: CREATURE_SECTIONS.stats, order: 40 })
      )
      .set(
        'hitDice',
        groupObject(['hitDice'], 'Hit Dice', () => CREATURE_HIT_DICE_NODE_MAP, {
          presentation: 'inline',
          section: CREATURE_SECTIONS.stats,
          order: 50
        })
      )

      // Movement
      .set(
        'speeds',
        groupArray(['speeds'], 'Speeds', () => SPEED_NODE_MAP, {
          presentation: 'inline',
          section: CREATURE_SECTIONS.stats,
          order: 60
        })
      )
      .set(
        'senses',
        groupArray(['senses'], 'Senses', () => CREATURE_SENSE_NODE_MAP, {
          presentation: 'inline',
          section: CREATURE_SECTIONS.stats,
          order: 70
        })
      )
      .set(
        'passivePerception',
        number(['passivePerception'], 'Passive Perception', {
          section: CREATURE_SECTIONS.stats,
          order: 90
        })
      )

      // Defense arrays also retain authored prose, not only vocabulary IDs.
      .set(
        'damageVulnerabilities',
        selectMulti(
          ['damageVulnerabilities'],
          'Damage Vulnerabilities',
          {
            kind: 'DATA',
            preserveUnknownOptions: true,
            relationship: table('damage_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { section: CREATURE_SECTIONS.defenses, order: 10 }
        )
      )
      .set(
        'damageResistances',
        selectMulti(
          ['damageResistances'],
          'Damage Resistances',
          {
            kind: 'DATA',
            preserveUnknownOptions: true,
            relationship: table('damage_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { section: CREATURE_SECTIONS.defenses, order: 20 }
        )
      )
      .set(
        'damageImmunities',
        selectMulti(
          ['damageImmunities'],
          'Damage Immunities',
          {
            kind: 'DATA',
            preserveUnknownOptions: true,
            relationship: table('damage_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { section: CREATURE_SECTIONS.defenses, order: 30 }
        )
      )
      .set(
        'qualifiedDamageDefenses',
        groupArray(
          ['qualifiedDamageDefenses'],
          'Qualified Damage Defenses',
          () => CREATURE_QUALIFIED_DAMAGE_DEFENSE_NODE_MAP,
          { presentation: 'inline', section: CREATURE_SECTIONS.defenses, order: 35 }
        )
      )
      .set(
        'conditionImmunities',
        selectMulti(
          ['conditionImmunities'],
          'Condition Immunities',
          {
            kind: 'DATA',
            preserveUnknownOptions: true,
            relationship: table('condition_types', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { section: CREATURE_SECTIONS.defenses, order: 40 }
        )
      )

      // Social/rules
      .set(
        'challengeRatingId',
        selectSingle(
          ['challengeRatingId'],
          'Challenge Rating',
          {
            kind: 'DATA',
            relationship: table('challenge_ratings', {
              selectColumns: ['id', 'label', 'description']
            })
          },
          { section: CREATURE_SECTIONS.stats, order: 100 }
        )
      )
      .set('xp', number(['xp'], 'XP', { section: CREATURE_SECTIONS.stats, order: 110 }))

      // Travel and cost
      .set(
        'cost',
        groupObject(['cost'], 'Cost', () => CREATURE_COST_NODE_MAP, {
          presentation: 'inline',
          section: CREATURE_SECTIONS.profiles,
          order: 5,
          showIf: isBeast
        })
      )
      .set(
        'carryingCapacity',
        groupObject(['carryingCapacity'], 'Carrying Capacity', () => CREATURE_CAPACITY_NODE_MAP, {
          presentation: 'inline',
          section: CREATURE_SECTIONS.profiles,
          order: 6,
          showIf: isBeast
        })
      )
      .set(
        'logisticsNotes',
        groupArray(
          ['logisticsNotes'],
          'Usage Notes',
          () =>
            buildNodeMap<{ value: string }>().define('logisticsNote', ({ map: m, nodes: n }) => {
              m.set(
                'value',
                n.text(['value'], 'Note', {
                  constraints: { maximumLength: AUTHORED_LIMITS.plainTextCharacters }
                })
              )
            }),
          { presentation: 'inline', section: CREATURE_SECTIONS.profiles, order: 7, showIf: isBeast }
        )
      )

      // Optional profiles
      .set(
        'mountProfile',
        groupObject(['mountProfile'], 'Mount Profile', () => CREATURE_MOUNT_PROFILE_NODE_MAP, {
          presentation: 'inline',
          section: CREATURE_SECTIONS.profiles,
          order: 30,
          showIf: isBeast,
          hiddenBehavior: 'CLEAR'
        })
      )
      .set(
        'companionProfile',
        groupObject(
          ['companionProfile'],
          'Companion Profile',
          () => CREATURE_COMPANION_PROFILE_NODE_MAP,
          {
            presentation: 'inline',
            section: CREATURE_SECTIONS.profiles,
            order: 40,
            showIf: isCompanionOrSummon,
            hiddenBehavior: 'CLEAR'
          }
        )
      )
      .set(
        'npcProfile',
        groupObject(['npcProfile'], 'NPC Profile', () => CREATURE_NPC_PROFILE_NODE_MAP, {
          presentation: 'inline',
          section: CREATURE_SECTIONS.profiles,
          order: 50,
          showIf: isNpc,
          hiddenBehavior: 'CLEAR'
        })
      )
  }
)
