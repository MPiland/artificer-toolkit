import { CREATURE_CATEGORY_CODE, CREATURE_MOUNT_TYPE_CODE, CREATURE_COMPANION_BOND_TYPE_CODE, CREATURE_INITIATIVE_MODE_CODE, SIZE_OPTIONS } from '#core'
import { FEATURE_NODE_MAP, SPEED_NODE_MAP } from '#maps'
import { buildNodeMap } from '#utils'
import type {
  CreatureActionAuthored,
  CreatureAuthored,
  CreatureCompanionProfile,
  CreatureLairProfile,
  CreatureLegendaryProfile,
  CreatureMountProfile,
  CreatureNpcProfile,
  DetailAuthored
} from '#authored'

const detailNode = buildNodeMap<DetailAuthored>()

const CREATURE_DETAIL_NODE_MAP = detailNode.define('creatureDetail', ({ map, nodes }) => {
  const { text, number } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('order', number(['order'], 'Order'))
})

const actionNode = buildNodeMap<CreatureActionAuthored>()

const CREATURE_ACTION_NODE_MAP = actionNode.define('creatureAction', ({ map, nodes }) => {
  const { text, number } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('description', text(['description'], 'Description'))
    .set('attackBonus', number(['attackBonus'], 'Attack Bonus'))
    .set('damage', text(['damage'], 'Damage'))
    .set('recharge', text(['recharge'], 'Recharge'))
})

const legendaryNode = buildNodeMap<CreatureLegendaryProfile>()

const CREATURE_LEGENDARY_PROFILE_NODE_MAP = legendaryNode.define('creatureLegendaryProfile', ({ map, nodes }) => {
  const { number, groupArray } = nodes

  map
    .set('legendaryResistanceCount', number(['legendaryResistanceCount'], 'Legendary Resistance Uses'))
    .set('actionsCount', number(['actionsCount'], 'Legendary Actions Per Round'))
    .set('actions', groupArray(['actions'], 'Legendary Actions', () => CREATURE_ACTION_NODE_MAP))
})

const lairNode = buildNodeMap<CreatureLairProfile>()

const CREATURE_LAIR_PROFILE_NODE_MAP = lairNode.define('creatureLairProfile', ({ map, nodes }) => {
  const { groupArray } = nodes

  const regionalEffectNode = buildNodeMap<{ value: string }>().define('regionalEffect', ({ map: m, nodes: n }) => {
    m.set('value', n.text(['value'], 'Effect'))
  })

  map
    .set('lairActions', groupArray(['lairActions'], 'Lair Actions', () => CREATURE_ACTION_NODE_MAP))
    .set('regionalEffects', groupArray(['regionalEffects'], 'Regional Effects', () => regionalEffectNode))
})

const mountNode = buildNodeMap<CreatureMountProfile>()

const CREATURE_MOUNT_PROFILE_NODE_MAP = mountNode.define('creatureMountProfile', ({ map, nodes }) => {
  const { text, number, selectSingle } = nodes

  map
    .set('mountType', selectSingle(['mountType'], 'Mount Type', {
      kind: 'INLINE',
      options: [
        { code: CREATURE_MOUNT_TYPE_CODE.CONTROLLED, label: 'Controlled' },
        { code: CREATURE_MOUNT_TYPE_CODE.INDEPENDENT, label: 'Independent' }
      ]
    }))
    .set('capacity', number(['capacity'], 'Carrying Capacity'))
    .set('riderCount', number(['riderCount'], 'Rider Count'))
    .set('notes', text(['notes'], 'Notes'))
})

const companionNode = buildNodeMap<CreatureCompanionProfile>()

const CREATURE_COMPANION_PROFILE_NODE_MAP = companionNode.define('creatureCompanionProfile', ({ map, nodes }) => {
  const { text, selectSingle } = nodes

  map
    .set('bondType', selectSingle(['bondType'], 'Bond Type', {
      kind: 'INLINE',
      options: [
        { code: CREATURE_COMPANION_BOND_TYPE_CODE.FAMILIAR, label: 'Familiar' },
        { code: CREATURE_COMPANION_BOND_TYPE_CODE.ANIMAL_COMPANION, label: 'Animal Companion' },
        { code: CREATURE_COMPANION_BOND_TYPE_CODE.SUMMON, label: 'Summon' }
      ]
    }))
    .set('initiativeMode', selectSingle(['initiativeMode'], 'Initiative Mode', {
      kind: 'INLINE',
      options: [
        { code: CREATURE_INITIATIVE_MODE_CODE.USES_PC_INITIATIVE, label: 'Uses PC\'s Initiative' },
        { code: CREATURE_INITIATIVE_MODE_CODE.OWN_INITIATIVE, label: 'Own Initiative' }
      ]
    }))
    .set('notes', text(['notes'], 'Notes'))
})

const npcNode = buildNodeMap<CreatureNpcProfile>()

const CREATURE_NPC_PROFILE_NODE_MAP = npcNode.define('creatureNpcProfile', ({ map, nodes }) => {
  const { groupArray } = nodes

  const stringNode = buildNodeMap<{ value: string }>().define('string', ({ map: m, nodes: n }) => {
    m.set('value', n.text(['value'], 'Value'))
  })

  map
    .set('bonds', groupArray(['bonds'], 'Bonds', () => stringNode))
    .set('flaws', groupArray(['flaws'], 'Flaws', () => stringNode))
    .set('ideals', groupArray(['ideals'], 'Ideals', () => stringNode))
    .set('personalityTraits', groupArray(['personalityTraits'], 'Personality Traits', () => stringNode))
})

const creatureNode = buildNodeMap<CreatureAuthored>()

export const CREATURE_NODE_MAP = creatureNode.define('creature', ({ map, nodes, cond, data, logic }) => {
  const { text, number, selectSingle, groupArray, groupObject } = nodes
  const { table } = data

  const tagNode = buildNodeMap<{ value: string }>().define('tag', ({ map: m, nodes: n }) => {
    m.set('value', n.text(['value'], 'Tag'))
  })

  const senseNode = buildNodeMap<{ value: string }>().define('sense', ({ map: m, nodes: n }) => {
    m.set('value', n.text(['value'], 'Sense'))
  })

  const savingThrowNode = buildNodeMap<{ value: string }>().define('savingThrow', ({ map: m, nodes: n }) => {
    m.set('value', n.text(['value'], 'Ability'))
  })

  const skillNode = buildNodeMap<{ value: string }>().define('skill', ({ map: m, nodes: n }) => {
    m.set('value', n.text(['value'], 'Skill'))
  })

  const damageTypeNode = buildNodeMap<{ value: string }>().define('damageType', ({ map: m, nodes: n }) => {
    m.set('value', n.text(['value'], 'Damage Type'))
  })

  const conditionNode = buildNodeMap<{ value: string }>().define('condition', ({ map: m, nodes: n }) => {
    m.set('value', n.text(['value'], 'Condition'))
  })

  const languageNode = buildNodeMap<{ value: string }>().define('language', ({ map: m, nodes: n }) => {
    m.set('value', n.text(['value'], 'Language'))
  })

  map
    // Identity
    .set('id', text(['id'], 'ID'))
    .set('label', text(['label'], 'Label'))
    .set('quote', text(['quote'], 'Quote'))
    .set('description', text(['description'], 'Description'))
    .set('details', groupArray(['details'], 'Details', () => CREATURE_DETAIL_NODE_MAP))
    .set('features', groupArray(['features'], 'Features', () => FEATURE_NODE_MAP))
    .set('userId', text(['userId'], 'User ID'))
    .set('systemId', text(['systemId'], 'System ID'))
    .set('category', selectSingle(['category'], 'Category', {
      kind: 'INLINE',
      options: [
        { code: CREATURE_CATEGORY_CODE.NPC, label: 'NPC' },
        { code: CREATURE_CATEGORY_CODE.MONSTER, label: 'Monster' },
        { code: CREATURE_CATEGORY_CODE.BEAST, label: 'Beast' },
        { code: CREATURE_CATEGORY_CODE.COMPANION, label: 'Companion' },
        { code: CREATURE_CATEGORY_CODE.SUMMON, label: 'Summon' }
      ]
    }))
    .set('creatureTypeId', selectSingle(['creatureTypeId'], 'Creature Type', {
      kind: 'DATA',
      relationship: table('creature_types', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('size', selectSingle(['size'], 'Size', {
      kind: 'INLINE',
      options: SIZE_OPTIONS
    }))
    .set('alignmentId', selectSingle(['alignmentId'], 'Alignment', {
      kind: 'DATA',
      relationship: table('alignments', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('tags', groupArray(['tags'], 'Tags', () => tagNode))

    // Core stats
    .set('abilityScores', groupObject(['abilityScores'], 'Ability Scores', () => buildNodeMap<Record<string, number>>().define('abilityScores', ({ map: m, nodes: n }) => {
      m
        .set('STR', n.number(['STR'], 'Strength'))
        .set('DEX', n.number(['DEX'], 'Dexterity'))
        .set('CON', n.number(['CON'], 'Constitution'))
        .set('INT', n.number(['INT'], 'Intelligence'))
        .set('WIS', n.number(['WIS'], 'Wisdom'))
        .set('CHA', n.number(['CHA'], 'Charisma'))
    })))
    .set('armorClass', number(['armorClass'], 'Armor Class'))
    .set('armorClassNote', text(['armorClassNote'], 'AC Note'))
    .set('hitPoints', number(['hitPoints'], 'Hit Points'))
    .set('hitDice', text(['hitDice'], 'Hit Dice'))

    // Movement
    .set('speeds', groupArray(['speeds'], 'Speeds', () => SPEED_NODE_MAP))
    .set('senses', groupArray(['senses'], 'Senses', () => senseNode))
    .set('passivePerception', number(['passivePerception'], 'Passive Perception'))

    // Defenses (stored as arrays of vocabulary IDs)
    .set('savingThrowProficiencies', groupArray(['savingThrowProficiencies'], 'Saving Throw Proficiencies', () => savingThrowNode))
    .set('skillProficiencies', groupArray(['skillProficiencies'], 'Skill Proficiencies', () => skillNode))
    .set('damageVulnerabilities', groupArray(['damageVulnerabilities'], 'Damage Vulnerabilities', () => damageTypeNode))
    .set('damageResistances', groupArray(['damageResistances'], 'Damage Resistances', () => damageTypeNode))
    .set('damageImmunities', groupArray(['damageImmunities'], 'Damage Immunities', () => damageTypeNode))
    .set('conditionImmunities', groupArray(['conditionImmunities'], 'Condition Immunities', () => conditionNode))

    // Social/rules
    .set('languages', groupArray(['languages'], 'Languages', () => languageNode))
    .set('challengeRatingId', selectSingle(['challengeRatingId'], 'Challenge Rating', {
      kind: 'DATA',
      relationship: table('challenge_ratings', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('xp', number(['xp'], 'XP'))

    // Standard actions
    .set('actions', groupArray(['actions'], 'Actions', () => CREATURE_ACTION_NODE_MAP))
    .set('bonusActions', groupArray(['bonusActions'], 'Bonus Actions', () => CREATURE_ACTION_NODE_MAP))
    .set('reactions', groupArray(['reactions'], 'Reactions', () => CREATURE_ACTION_NODE_MAP))

    // Optional profiles
    .set('legendaryProfile', groupObject(['legendaryProfile'], 'Legendary Profile', () => CREATURE_LEGENDARY_PROFILE_NODE_MAP))
    .set('lairProfile', groupObject(['lairProfile'], 'Lair Profile', () => CREATURE_LAIR_PROFILE_NODE_MAP))
    .set('mountProfile', groupObject(['mountProfile'], 'Mount Profile', () => CREATURE_MOUNT_PROFILE_NODE_MAP))
    .set('companionProfile', groupObject(['companionProfile'], 'Companion Profile', () => CREATURE_COMPANION_PROFILE_NODE_MAP))
    .set('npcProfile', groupObject(['npcProfile'], 'NPC Profile', () => CREATURE_NPC_PROFILE_NODE_MAP))
})
