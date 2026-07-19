import type {
  ApplyGrantAuthored,
  PathLifecycleAuthored,
  EffectPathAuthored,
  ManifestBehaviorAuthored,
  NonManifestOutcomeAuthored,
  OutcomeAuthored,
  PathChoiceOptionAuthored,
  PathRollTableRowAuthored,
  ResultBlockAuthored,
  SummonStatBlockAuthored
} from '#authored'
import {
  SUMMON_DAMAGEABILITY_KIND,
  SUMMON_VISIBILITY_KIND
} from '#authored'
import {
  PATH_ORIGIN_KIND_OPTIONS,
  PATH_LIFECYCLE_CONSUME_EVENT_OPTIONS,
  PATH_LIFECYCLE_END_EVENT_OPTIONS,
  PATH_LIFECYCLE_RECURRING_KIND_OPTIONS,
  PATH_CODE_OPTIONS,
  PATH_GROUP_TYPE_OPTIONS,
  PATH_ROLL_TABLE_KIND_OPTIONS,
  DAMAGE_VALUE_OPTIONS,
  EFFECT_KIND,
  EFFECT_KIND_OPTIONS,
  FORCED_MOVEMENT_ACTION_ECONOMY_OPTIONS,
  FORCED_MOVEMENT_DIRECTION_OPTIONS,
  FORCED_MOVEMENT_DISTANCE_MODE_OPTIONS,
  MANIFEST_KIND,
  MANIFEST_KIND_OPTIONS,
  MEASUREMENT_UNIT_OPTIONS,
  NON_MANIFEST_EFFECT_KIND_OPTIONS,
  SCALING_AMOUNT_OPTIONS,
  SIZE_OPTIONS,
  type Trigger
} from '#core'
import { buildNodeMap, type BuildNodeMap, type NodeMap, valuesOf } from '#utils'
import type { AllUnionFields } from 'type-fest'
import {
  DURATION_NODE_MAP,
  NUMERIC_EXPR_NODE_MAP,
  RANGE_NODE_MAP,
  SHAPE_NODE_MAP,
  SPEED_NODE_MAP
} from '../../shared/maps/index.js'
import { MODIFIER_GRANT_NODE_MAP } from '../../grants/maps/modifier.js'
import { PROFICIENCY_NODE_MAP } from '../../grants/maps/proficiency.js'
import { SENSE_GRANT_NODE_MAP } from '../../grants/maps/sense.js'
import { INVOCATION_NODE_MAP } from './invocation.js'
import { OUTCOME_BONUS_NODE_MAP } from './outcomeBonus.js'
import { TARGETING_NODE_MAP } from './targeting.js'
import { DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP } from './damage.js'

type OutcomeNode = AllUnionFields<OutcomeAuthored>
type NonManifestOutcomeNode = AllUnionFields<NonManifestOutcomeAuthored>
type ApplyGrantsNode = ApplyGrantAuthored['grants']
type SummonAbilityScoresNode = NonNullable<SummonStatBlockAuthored['abilityScores']>
type NodeMapBuildApi<NLocal extends object> = Parameters<BuildNodeMap<NLocal>['define']>[1] extends (api: infer TApi) => void
  ? TApi
  : never
type OutcomeNodeMapApi = NodeMapBuildApi<OutcomeNode>

const PATH_SELECTION_KIND_OPTIONS = [
  {
    code: 'FIXED',
    label: 'Direct',
    description: 'Resolve one selected result directly.',
    tooltip: 'Direct result.'
  },
  {
    code: 'CHOICE',
    label: 'Choose One',
    description: 'Choose one authored option.',
    tooltip: 'Choose one option.'
  },
  {
    code: 'ROLL_TABLE',
    label: 'Roll Table',
    description: 'Resolve a result by rolling on a table.',
    tooltip: 'Roll for a result.'
  }
] as const

const RESULT_KIND_OPTIONS = [
  {
    code: 'SINGLE', label: 'Single',
    description: 'Resolve one authored outcome.',
    tooltip: 'Single outcome.'
  },
  {
    code: 'SEQUENCE',
    label: 'Resolve In Order',
    description: 'Resolve multiple outcomes in order.',
    tooltip: 'Sequential outcomes.'
  }
] as const

const TELEPORT_TARGET_KIND_OPTIONS = [
  { code: 'SELF', label: 'Self' },
  { code: 'TARGET', label: 'Target' },
  { code: 'CHOSEN_CREATURES', label: 'Chosen Creatures' }
] as const

const TELEPORT_DESTINATION_KIND_OPTIONS = [
  { code: 'SELF', label: 'Self' },
  { code: 'VISIBLE', label: 'Visible Location' },
  { code: 'SPECIFIED_POINT', label: 'Specified Point' },
  { code: 'LINKED_LOCATION', label: 'Linked Location' },
  { code: 'SPECIAL', label: 'Special' }
] as const

const SUMMON_DAMAGEABILITY_OPTIONS = valuesOf(
  Object.fromEntries(
    Object.values(SUMMON_DAMAGEABILITY_KIND).map((code) => [
      code, {
        code,
        label: code === 'INVULNERABLE' ? 'Invulnerable' : code === 'SPECIAL' ? 'Special' : 'Normal'
      }
    ])
  )
)

const SUMMON_VISIBILITY_OPTIONS = valuesOf(
  Object.fromEntries(
    Object.values(SUMMON_VISIBILITY_KIND).map((code) => [
      code, {
        code,
        label: code === 'INVISIBLE' ? 'Invisible' : code === 'SPECIAL' ? 'Special' : 'Visible'
      }
    ])
  )
)

const pathLifecycle = buildNodeMap<PathLifecycleAuthored>()
const applyGrants = buildNodeMap<ApplyGrantsNode>()
const summonAbilityScores = buildNodeMap<SummonAbilityScoresNode>()
const summonStatBlock = buildNodeMap<SummonStatBlockAuthored>()
const outcome = buildNodeMap<OutcomeNode>()
const nonManifestOutcome = buildNodeMap<NonManifestOutcomeNode>()
const resultBlock = buildNodeMap<ResultBlockAuthored>()
const nonManifestResultBlock = buildNodeMap<ResultBlockAuthored<NonManifestOutcomeAuthored>>()
const choiceOption = buildNodeMap<PathChoiceOptionAuthored>()
const nonManifestChoiceOption = buildNodeMap<PathChoiceOptionAuthored<NonManifestOutcomeAuthored>>()
const rollRow = buildNodeMap<PathRollTableRowAuthored>()
const nonManifestRollRow = buildNodeMap<PathRollTableRowAuthored<NonManifestOutcomeAuthored>>()
const effectPath = buildNodeMap<EffectPathAuthored>()
const manifestNestedPath = buildNodeMap<EffectPathAuthored<Trigger, NonManifestOutcomeAuthored>>()
const manifestBehavior = buildNodeMap<ManifestBehaviorAuthored>()

const PATH_LIFECYCLE_NODE_MAP: NodeMap<PathLifecycleAuthored> = pathLifecycle.define('pathLifecycle', ({ map, nodes }) => {
  const { selectSingle, selectMulti } = nodes

  map
    .set('recurringKind', selectSingle(['recurringKind'], 'Recurring', {
      kind: 'INLINE_OPTIONS',
      options: PATH_LIFECYCLE_RECURRING_KIND_OPTIONS
    }))
    .set('consumeOnFirstEvent', selectSingle(['consumeOnFirstEvent'], 'Consume On First Event', {
      kind: 'INLINE_OPTIONS',
      options: PATH_LIFECYCLE_CONSUME_EVENT_OPTIONS
    }))
    .set('endOnEvents', selectMulti(['endOnEvents'], 'End On Events', {
      kind: 'INLINE_OPTIONS',
      options: PATH_LIFECYCLE_END_EVENT_OPTIONS
    }))
})

const APPLY_GRANTS_NODE_MAP: NodeMap<ApplyGrantsNode> = applyGrants.define('applyGrants', ({ map, nodes }) => {
  const { groupArray } = nodes

  map
    .set('modifiers', groupArray(['modifiers'], 'Modifier Grants', () => MODIFIER_GRANT_NODE_MAP, { presentation: 'inline' }))
    .set('proficiencies', groupArray(['proficiencies'], 'Proficiency Grants', () => PROFICIENCY_NODE_MAP, { presentation: 'inline' }))
    .set('senses', groupArray(['senses'], 'Sense Grants', () => SENSE_GRANT_NODE_MAP, { presentation: 'inline' }))
})

const SUMMON_ABILITY_SCORES_NODE_MAP: NodeMap<SummonAbilityScoresNode> = summonAbilityScores.define('summonAbilityScores', ({ map, nodes }) => {
  const { groupObject } = nodes

  map
    .set('STRENGTH', groupObject(['STRENGTH'], 'Strength', () => NUMERIC_EXPR_NODE_MAP, { presentation: 'inline' }))
    .set('DEXTERITY', groupObject(['DEXTERITY'], 'Dexterity', () => NUMERIC_EXPR_NODE_MAP, { presentation: 'inline' }))
    .set('CONSTITUTION', groupObject(['CONSTITUTION'], 'Constitution', () => NUMERIC_EXPR_NODE_MAP, { presentation: 'inline' }))
    .set('INTELLIGENCE', groupObject(['INTELLIGENCE'], 'Intelligence', () => NUMERIC_EXPR_NODE_MAP, { presentation: 'inline' }))
    .set('WISDOM', groupObject(['WISDOM'], 'Wisdom', () => NUMERIC_EXPR_NODE_MAP, { presentation: 'inline' }))
    .set('CHARISMA', groupObject(['CHARISMA'], 'Charisma', () => NUMERIC_EXPR_NODE_MAP, { presentation: 'inline' }))
})

const SUMMON_STAT_BLOCK_NODE_MAP: NodeMap<SummonStatBlockAuthored> = summonStatBlock.define('summonStatBlock', ({ map, nodes, data }) => {
  const { selectSingle, text, toggle, groupObject, groupArray, selectMulti } = nodes
  const { table } = data

  map
    .set('size', selectSingle(['size'], 'Size', {
      kind: 'INLINE_OPTIONS',
      options: SIZE_OPTIONS
    }))
    .set('occupiesSpace', toggle(['occupiesSpace'], 'Occupies Space'))
    .set('armorClass', groupObject(['armorClass'], 'Armor Class', () => NUMERIC_EXPR_NODE_MAP, { presentation: 'inline' }))
    .set('armorClassNote', text(['armorClassNote'], 'Armor Class Note'))
    .set('hitPoints', groupObject(['hitPoints'], 'Hit Points', () => NUMERIC_EXPR_NODE_MAP, { presentation: 'inline' }))
    .set('speeds', groupArray(['speeds'], 'Movement', () => SPEED_NODE_MAP, { presentation: 'inline' }))
    .set('abilityScores', groupObject(['abilityScores'], 'Ability Scores', () => SUMMON_ABILITY_SCORES_NODE_MAP, { presentation: 'inline' }))
    .set('senses', selectMulti(['senses'], 'Senses', {
      kind: 'DATA',
      relationship: table('senses', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('passivePerception', groupObject(['passivePerception'], 'Passive Perception', () => NUMERIC_EXPR_NODE_MAP, { presentation: 'inline' }))
    .set('damageVulnerabilities', selectMulti(['damageVulnerabilities'], 'Damage Vulnerabilities', {
      kind: 'DATA',
      relationship: table('damage_types', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('damageResistances', selectMulti(['damageResistances'], 'Damage Resistances', {
      kind: 'DATA',
      relationship: table('damage_types', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('damageImmunities', selectMulti(['damageImmunities'], 'Damage Immunities', {
      kind: 'DATA',
      relationship: table('damage_types', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('conditionImmunities', selectMulti(['conditionImmunities'], 'Condition Immunities', {
      kind: 'DATA',
      relationship: table('condition_types', {
        selectColumns: ['id', 'label']
      })
    }))
    .set('damageabilityKind', selectSingle(['damageabilityKind'], 'Damageability', {
      kind: 'INLINE_OPTIONS',
      options: SUMMON_DAMAGEABILITY_OPTIONS
    }))
    .set('visibilityKind', selectSingle(['visibilityKind'], 'Visibility', {
      kind: 'INLINE_OPTIONS',
      options: SUMMON_VISIBILITY_OPTIONS
    }))
})

function registerOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  logic: OutcomeNodeMapApi['logic'],
  data: OutcomeNodeMapApi['data'],
  effectKindOptions: readonly { code: string, label: string }[]
) {
  const { text, number, selectSingle, toggle, groupArray, groupObject } = nodes
  const { and, or, not } = logic
  const local = cond.local()
  const { table } = data

  map
    .set('id', text(['id'], 'ID'))
    .set('effectKind', selectSingle(['effectKind'], 'Effect Kind', {
      kind: 'INLINE_OPTIONS',
      options: effectKindOptions
    }, {
      requiredIf: true
    }))
    .set('bonuses', groupArray(['bonuses'], 'Bonuses', () => OUTCOME_BONUS_NODE_MAP, { presentation: 'inline',
      showIf: or([
        local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
        local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
      ])
    }))
    .set('temporary', toggle(['temporary'], 'Temporary', {
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
    }))
    .set('damageTypeId', selectSingle(['damageTypeId'], 'Damage Type', {
      kind: 'DATA',
      relationship: table('damage_types', {
        selectColumns: ['id', 'label', 'tooltip']
      })
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE)
    }))
    .set('valueKind', selectSingle(['valueKind'], 'Value Kind', {
      kind: 'INLINE_OPTIONS',
      options: DAMAGE_VALUE_OPTIONS
    }, {
      requiredIf: true,
      showIf: or([
        local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
        local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
      ])
    }))
    .set('scalingKind', selectSingle(['scalingKind'], 'Scaling Kind', {
      kind: 'INLINE_OPTIONS',
      options: [
        { code: 'NONE', label: 'None' },
        { code: 'PER_LEVEL', label: 'Per Level' },
        { code: 'BREAKPOINTS', label: 'Breakpoints' }
      ]
    }, {
      requiredIf: true,
      showIf: or([
        local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
        local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
      ])
    }))
    .set('amountKind', selectSingle(['amountKind'], 'Amount Modifier', {
      kind: 'INLINE_OPTIONS',
      options: SCALING_AMOUNT_OPTIONS
    }, {
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE)
    }))
    .set('amount', number(['amount'], 'Amount', {
      requiredIf: not(and([
        local.field(['valueKind']).eq('POOL'),
        local.field(['scalingKind']).eq('PER_LEVEL')
      ])),
      showIf: or([
        local.field(['effectKind']).eq(EFFECT_KIND.MOVE_MANIFEST),
        and([
          or([
            local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
            local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
          ]),
          or([
            and([
              local.field(['scalingKind']).eq('NONE'),
              or([
                local.field(['valueKind']).eq('FIXED'),
                local.field(['valueKind']).eq('POOL')
              ])
            ]),
            and([
              local.field(['scalingKind']).eq('PER_LEVEL'),
              local.field(['valueKind']).eq('POOL')
            ])
          ])
        ])
      ])
    }))
    .set('multiplier', number(['multiplier'], 'Multiplier', {
      showIf: or([
        local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
        and([
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL),
          local.field(['valueKind']).eq('POOL')
        ])
      ])
    }))
    .set('min', number(['min'], 'Min', {
      showIf: and([
        or([
          local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
        ]),
        local.field(['scalingKind']).eq('PER_LEVEL'),
        local.field(['valueKind']).eq('POOL')
      ])
    }))
    .set('max', number(['max'], 'Max', {
      showIf: and([
        or([
          local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
        ]),
        local.field(['scalingKind']).eq('PER_LEVEL'),
        local.field(['valueKind']).eq('POOL')
      ])
    }))
    .set('diceConfig', text(['diceConfig'], 'Dice Config', {
      requiredIf: true,
      showIf: and([
        or([
          local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
        ]),
        local.field(['scalingKind']).eq('NONE'),
        local.field(['valueKind']).eq('DICE')
      ])
    }))
    .set('levels', groupArray(['levels'], 'Levels', () => DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP, {
      presentation: 'table',
      showIf: and([
        or([
          local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
        ]),
        local.field(['scalingKind']).eq('PER_LEVEL'),
        not(local.field(['valueKind']).eq('POOL'))
      ])
    }))
    .set('scalingSource', selectSingle(['scalingSource'], 'Scaling Source', {
      kind: 'INLINE_OPTIONS',
      options: [
        { code: 'CHARACTER_LEVEL', label: 'Character Level' },
        { code: 'CLASS_LEVEL', label: 'Class Level' },
        { code: 'PARENT_CLASS_LEVEL', label: 'Parent Class Level' },
        { code: 'SPELL_CAST_LEVEL', label: 'Spell Cast Level' }
      ]
    }, {
      requiredIf: true,
      showIf: and([
        or([
          local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
        ]),
        local.field(['scalingKind']).eq('PER_LEVEL'),
        not(local.field(['valueKind']).eq('POOL'))
      ])
    }))
    .set('classId', selectSingle(['classId'], 'Class', {
      kind: 'DATA',
      relationship: table('classes', {
        selectColumns: ['id', 'label']
      })
    }, {
      requiredIf: true,
      showIf: and([
        or([
          local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
        ]),
        local.field(['scalingKind']).eq('PER_LEVEL'),
        not(local.field(['valueKind']).eq('POOL')),
        local.field(['scalingSource']).eq('CLASS_LEVEL')
      ])
    }))
    .set('conditionId', selectSingle(['conditionId'], 'Condition', {
      kind: 'DATA',
      relationship: table('condition_types', {
        selectColumns: ['id', 'label', 'tooltip']
      })
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.CONDITION)
    }))
    .set('grants', groupObject(['grants'], 'Grants', () => APPLY_GRANTS_NODE_MAP, { presentation: 'inline',
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.APPLY_GRANT)
    }))
    .set('direction', selectSingle(['direction'], 'Direction', {
      kind: 'INLINE_OPTIONS',
      options: FORCED_MOVEMENT_DIRECTION_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT)
    }))
    .set('distanceMode', selectSingle(['distanceMode'], 'Distance Mode', {
      kind: 'INLINE_OPTIONS',
      options: FORCED_MOVEMENT_DISTANCE_MODE_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT)
    }))
    .set('movementAmount', number(['amount'], 'Distance Amount', {
      requiredIf: true,
      showIf: and([
        local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT),
        local.field(['distanceMode']).eq('FIXED_DISTANCE')
      ])
    }))
    .set('movementUnit', selectSingle(['unit'], 'Distance Unit', {
      kind: 'INLINE_OPTIONS',
      options: MEASUREMENT_UNIT_OPTIONS
    }, {
      requiredIf: true,
      showIf: or([
        and([
          local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT),
          local.field(['distanceMode']).eq('FIXED_DISTANCE')
        ]),
        local.field(['effectKind']).eq(EFFECT_KIND.MOVE_MANIFEST)
      ])
    }))
    .set('actionEconomy', selectSingle(['actionEconomy'], 'Action Economy', {
      kind: 'INLINE_OPTIONS',
      options: FORCED_MOVEMENT_ACTION_ECONOMY_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT)
    }))
    .set('targetKind', selectSingle(['targetKind'], 'Target', {
      kind: 'INLINE_OPTIONS',
      options: TELEPORT_TARGET_KIND_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPORT)
    }))
    .set('destinationKind', selectSingle(['destinationKind'], 'Destination', {
      kind: 'INLINE_OPTIONS',
      options: TELEPORT_DESTINATION_KIND_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPORT)
    }))
    .set('distance', groupObject(['distance'], 'Distance', () => RANGE_NODE_MAP, { presentation: 'inline',
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPORT)
    }))
    .set('manifestKind', selectSingle(['manifestKind'], 'Manifest Kind', {
      kind: 'INLINE_OPTIONS',
      options: MANIFEST_KIND_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
    }))
    .set('creatureId', selectSingle(['creatureId'], 'Creature', {
      kind: 'DATA',
      relationship: table('creatures', {
        selectColumns: ['id', 'label']
      })
    }, {
      showIf: and([
        local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST),
        local.field(['manifestKind']).eq(MANIFEST_KIND.CREATURE)
      ])
    }))
    .set('shape', groupObject(['shape'], 'Shape', () => SHAPE_NODE_MAP, { presentation: 'inline',
      showIf: and([
        local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST),
        not(local.field(['manifestKind']).eq(MANIFEST_KIND.CREATURE))
      ])
    }))
    .set('label', text(['label'], 'Label', {
      showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
    }))
    .set('statBlock', groupObject(['statBlock'], 'Summon Stat Block', () => SUMMON_STAT_BLOCK_NODE_MAP, { presentation: 'inline',
      showIf: and([
        local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST),
        local.field(['manifestKind']).eq(MANIFEST_KIND.SUMMON)
      ])
    }))
    .set('behaviors', groupArray(['behaviors'], 'Behaviors', () => MANIFEST_BEHAVIOR_NODE_MAP, { presentation: 'inline',
      showIf: and([
        local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST),
        not(local.field(['manifestKind']).eq(MANIFEST_KIND.CREATURE))
      ])
    }))
    .set('manifestId', text(['manifestId'], 'Manifest', {
      requiredIf: true,
      showIf: or([
        local.field(['effectKind']).eq(EFFECT_KIND.MOVE_MANIFEST),
        local.field(['effectKind']).eq(EFFECT_KIND.COMMAND_MANIFEST)
      ])
    }))
}

const OUTCOME_NODE_MAP: NodeMap<OutcomeNode> = outcome.define('outcome', ({ map, nodes, cond, logic, data }) => {
  registerOutcomeFields(map, nodes, cond, logic, data, EFFECT_KIND_OPTIONS)
}, {
  collection: {
    rowSummary: 'outcome'
  }
})

const NON_MANIFEST_OUTCOME_NODE_MAP: NodeMap<NonManifestOutcomeNode> = nonManifestOutcome.define('nonManifestOutcome', ({ map, nodes, cond, logic, data }) => {
  registerOutcomeFields(map as unknown as OutcomeNodeMapApi['map'], nodes as unknown as OutcomeNodeMapApi['nodes'], cond as unknown as OutcomeNodeMapApi['cond'], logic as unknown as OutcomeNodeMapApi['logic'], data as unknown as OutcomeNodeMapApi['data'], NON_MANIFEST_EFFECT_KIND_OPTIONS)
}, {
  collection: {
    rowSummary: 'outcome'
  }
})

const RESULT_BLOCK_NODE_MAP: NodeMap<ResultBlockAuthored> = resultBlock.define('resultBlock', ({ map, nodes }) => {
  const { text, selectSingle, groupObject, groupArray } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('resultKind', selectSingle(['resultKind'], 'Outcome Type', {
      kind: 'INLINE_OPTIONS',
      options: RESULT_KIND_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('duration', groupObject(['duration'], 'Duration', () => DURATION_NODE_MAP, { presentation: 'inline' }))
    .set('lifecycle', groupObject(['lifecycle'], 'Lifecycle', () => PATH_LIFECYCLE_NODE_MAP, { presentation: 'inline' }))
    .set('outcomes', groupArray(['outcomes'], 'Outcomes', () => OUTCOME_NODE_MAP, {
      presentation: 'summary'
    }))
})

const NON_MANIFEST_RESULT_BLOCK_NODE_MAP: NodeMap<ResultBlockAuthored<NonManifestOutcomeAuthored>> = nonManifestResultBlock.define('nonManifestResultBlock', ({ map, nodes }) => {
  const { text, selectSingle, groupObject, groupArray } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('resultKind', selectSingle(['resultKind'], 'Outcome Type', {
      kind: 'INLINE_OPTIONS',
      options: RESULT_KIND_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('duration', groupObject(['duration'], 'Duration', () => DURATION_NODE_MAP, { presentation: 'inline' }))
    .set('lifecycle', groupObject(['lifecycle'], 'Lifecycle', () => PATH_LIFECYCLE_NODE_MAP, { presentation: 'inline' }))
    .set('outcomes', groupArray(['outcomes'], 'Outcomes', () => NON_MANIFEST_OUTCOME_NODE_MAP, {
      presentation: 'summary'
    }))
})

const CHOICE_OPTION_NODE_MAP: NodeMap<PathChoiceOptionAuthored> = choiceOption.define('choiceOption', ({ map, nodes }) => {
  const { text, richText, number, groupObject } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order', {
      requiredIf: true
    }))
    .set('label', text(['label'], 'Label', {
      requiredIf: true
    }))
    .set('description', richText(['description'], 'Description', {
      requiredIf: true
    }))
    .set('resultBlock', groupObject(['resultBlock'], 'Result', () => RESULT_BLOCK_NODE_MAP, { presentation: 'inline',
      requiredIf: true
    }))
})

const NON_MANIFEST_CHOICE_OPTION_NODE_MAP: NodeMap<PathChoiceOptionAuthored<NonManifestOutcomeAuthored>> = nonManifestChoiceOption.define('nonManifestChoiceOption', ({ map, nodes }) => {
  const { text, richText, number, groupObject } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order', {
      requiredIf: true
    }))
    .set('label', text(['label'], 'Label', {
      requiredIf: true
    }))
    .set('description', richText(['description'], 'Description', {
      requiredIf: true
    }))
    .set('resultBlock', groupObject(['resultBlock'], 'Result', () => NON_MANIFEST_RESULT_BLOCK_NODE_MAP, { presentation: 'inline',
      requiredIf: true
    }))
})

const ROLL_TABLE_ROW_NODE_MAP: NodeMap<PathRollTableRowAuthored> = rollRow.define('rollTableRow', ({ map, nodes, cond }) => {
  const { text, number, groupObject } = nodes
  const parent = cond.parent<{ rollTableKind: 'RANGE' | 'EXACT' }>()

  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order', {
      requiredIf: true
    }))
    .set('rollRangeMin', number(['rollRange', 0], 'Roll Min', {
      requiredIf: true,
      showIf: parent.field(['rollTableKind']).eq('RANGE')
    }))
    .set('rollRangeMax', number(['rollRange', 1], 'Roll Max', {
      requiredIf: true,
      showIf: parent.field(['rollTableKind']).eq('RANGE')
    }))
    .set('rollValue', number(['rollValue'], 'Roll Value', {
      requiredIf: true,
      showIf: parent.field(['rollTableKind']).eq('EXACT')
    }))
    .set('resultBlock', groupObject(['resultBlock'], 'Result', () => RESULT_BLOCK_NODE_MAP, { presentation: 'inline',
      requiredIf: true
    }))
})

const NON_MANIFEST_ROLL_TABLE_ROW_NODE_MAP: NodeMap<PathRollTableRowAuthored<NonManifestOutcomeAuthored>> = nonManifestRollRow.define('nonManifestRollTableRow', ({ map, nodes, cond }) => {
  const { text, number, groupObject } = nodes
  const parent = cond.parent<{ rollTableKind: 'RANGE' | 'EXACT' }>()

  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order', {
      requiredIf: true
    }))
    .set('rollRangeMin', number(['rollRange', 0], 'Roll Min', {
      requiredIf: true,
      showIf: parent.field(['rollTableKind']).eq('RANGE')
    }))
    .set('rollRangeMax', number(['rollRange', 1], 'Roll Max', {
      requiredIf: true,
      showIf: parent.field(['rollTableKind']).eq('RANGE')
    }))
    .set('rollValue', number(['rollValue'], 'Roll Value', {
      requiredIf: true,
      showIf: parent.field(['rollTableKind']).eq('EXACT')
    }))
    .set('resultBlock', groupObject(['resultBlock'], 'Result', () => NON_MANIFEST_RESULT_BLOCK_NODE_MAP, { presentation: 'inline',
      requiredIf: true
    }))
})

export const PATH_NODE_MAP: NodeMap<EffectPathAuthored> = effectPath.define('effectPath', ({ map, nodes, cond }) => {
  const { text, number, selectSingle, groupObject, groupArray } = nodes
  const local = cond.local()

  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order', {
      requiredIf: true
    }))
    .set('pathCode', selectSingle(['pathCode'], 'Outcome Path', {
      kind: 'INLINE_OPTIONS',
      options: PATH_CODE_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('groupType', selectSingle(['groupType'], 'Outcome Group', {
      kind: 'INLINE_OPTIONS',
      options: PATH_GROUP_TYPE_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('selectionKind', selectSingle(['selectionKind'], 'Selection Model', {
      kind: 'INLINE_OPTIONS',
      options: PATH_SELECTION_KIND_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('originKind', selectSingle(['originKind'], 'Starts From', {
      kind: 'INLINE_OPTIONS',
      options: PATH_ORIGIN_KIND_OPTIONS
    }))
    .set('rangeOverride', groupObject(['rangeOverride'], 'Range Override', () => RANGE_NODE_MAP, { presentation: 'inline' }))
    .set('targetingOverride', groupObject(['targetingOverride'], 'Targeting Override', () => TARGETING_NODE_MAP, { presentation: 'inline' }))
    .set('resultBlock', groupObject(['resultBlock'], 'Result', () => RESULT_BLOCK_NODE_MAP, { presentation: 'inline',
      showIf: local.field(['selectionKind']).eq('FIXED')
    }))
    .set('dieConfig', text(['dieConfig'], 'Die Configuration', {
      requiredIf: true,
      showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
    }))
    .set('rollTableKind', selectSingle(['rollTableKind'], 'Match Rolls By', {
      kind: 'INLINE_OPTIONS',
      options: PATH_ROLL_TABLE_KIND_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
    }))
    .set('options', groupArray(['options'], 'Options', () => CHOICE_OPTION_NODE_MAP, {
      presentation: 'branch',
      showIf: local.field(['selectionKind']).eq('CHOICE')
    }))
    .set('rows', groupArray(['rows'], 'Rows', () => ROLL_TABLE_ROW_NODE_MAP, {
      presentation: 'table',
      showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
    }))
}, {
  collection: {
    rowSummary: 'effect-path'
  }
})

export const MANIFEST_BEHAVIOR_PATH_NODE_MAP: NodeMap<EffectPathAuthored<Trigger, NonManifestOutcomeAuthored>> = manifestNestedPath.define('manifestBehaviorPath', ({ map, nodes, cond }) => {
  const { text, number, selectSingle, groupObject, groupArray } = nodes
  const local = cond.local()

  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order', {
      requiredIf: true
    }))
    .set('pathCode', selectSingle(['pathCode'], 'Behavior Path', {
      kind: 'INLINE_OPTIONS',
      options: PATH_CODE_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('groupType', selectSingle(['groupType'], 'Outcome Group', {
      kind: 'INLINE_OPTIONS',
      options: PATH_GROUP_TYPE_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('selectionKind', selectSingle(['selectionKind'], 'Selection Model', {
      kind: 'INLINE_OPTIONS',
      options: PATH_SELECTION_KIND_OPTIONS
    }, {
      requiredIf: true
    }))
    .set('originKind', selectSingle(['originKind'], 'Starts From', {
      kind: 'INLINE_OPTIONS',
      options: PATH_ORIGIN_KIND_OPTIONS
    }))
    .set('rangeOverride', groupObject(['rangeOverride'], 'Range Override', () => RANGE_NODE_MAP, { presentation: 'inline' }))
    .set('targetingOverride', groupObject(['targetingOverride'], 'Targeting Override', () => TARGETING_NODE_MAP, { presentation: 'inline' }))
    .set('resultBlock', groupObject(['resultBlock'], 'Result', () => NON_MANIFEST_RESULT_BLOCK_NODE_MAP, { presentation: 'inline',
      showIf: local.field(['selectionKind']).eq('FIXED')
    }))
    .set('dieConfig', text(['dieConfig'], 'Die Configuration', {
      requiredIf: true,
      showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
    }))
    .set('rollTableKind', selectSingle(['rollTableKind'], 'Match Rolls By', {
      kind: 'INLINE_OPTIONS',
      options: PATH_ROLL_TABLE_KIND_OPTIONS
    }, {
      requiredIf: true,
      showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
    }))
    .set('options', groupArray(['options'], 'Options', () => NON_MANIFEST_CHOICE_OPTION_NODE_MAP, {
      presentation: 'branch',
      showIf: local.field(['selectionKind']).eq('CHOICE')
    }))
    .set('rows', groupArray(['rows'], 'Rows', () => NON_MANIFEST_ROLL_TABLE_ROW_NODE_MAP, {
      presentation: 'table',
      showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
    }))
}, {
  collection: {
    rowSummary: 'effect-path'
  }
})

export const MANIFEST_BEHAVIOR_NODE_MAP: NodeMap<ManifestBehaviorAuthored> = manifestBehavior.define('manifestBehavior', ({ map, nodes }) => {
  const { text, number, groupObject, groupArray } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order'))
    .set('invocation', groupObject(['invocation'], 'How It Starts', () => INVOCATION_NODE_MAP, { presentation: 'inline' }))
    .set('paths', groupArray(['paths'], 'Outcome Paths', () => MANIFEST_BEHAVIOR_PATH_NODE_MAP, { presentation: 'inline' }))
})




