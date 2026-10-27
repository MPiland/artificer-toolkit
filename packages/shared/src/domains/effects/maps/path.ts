import type {
  ApplyGrantAuthored,
  ConditionAuthored,
  FailureMarginRiderAuthored,
  FollowUpSaveAuthored,
  FollowUpSaveBranchAuthored,
  HitPointMaximumReductionAuthored,
  ManifestComponentAuthored,
  ManifestDestructionCriterionAuthored,
  ManifestOccupantSaveBonusAuthored,
  ManifestProximityRuleAuthored,
  PathLifecycleAuthored,
  PathChosenItemAuthored,
  EffectPathAuthored,
  ManifestBehaviorAuthored,
  NonManifestOutcomeAuthored,
  OutcomeAuthored,
  PathChoiceOptionAuthored,
  PathHitPointTierRowAuthored,
  PathRollTableRowAuthored,
  ResultBlockAuthored,
  DegradeEquipmentDestroyWhenAuthored,
  ScalarReductionAuthored,
  SummonStatBlockAuthored,
  TelepathicLinkAbilityFloorAuthored
} from '#authored'
import {
  MANIFEST_BLOCKING_RULE_OPTIONS,
  MANIFEST_PROPERTY_OPTIONS,
  MANIFEST_REQUIRED_SIGHT_OPTIONS,
  MANIFEST_SPELL_CAPABILITY_OPTIONS,
  MANIFEST_SUPPRESSION_IMMUNITY_OPTIONS,
  SUMMON_DAMAGEABILITY_KIND,
  SUMMON_VISIBILITY_KIND
} from '#authored'
import {
  PATH_ORIGIN_KIND_OPTIONS,
  PATH_RESULT_KIND_OPTIONS,
  PATH_SELECTION_KIND_OPTIONS,
  PATH_USAGE_OPTIONS,
  PATH_LIFECYCLE_RECURRING_KIND_OPTIONS,
  PATH_LIFECYCLE_EXCLUSIVITY_OPTIONS,
  PATH_LIFECYCLE_RETURNS_ON_OPTIONS,
  PATH_CODE_OPTIONS,
  PATH_GROUP_TYPE_OPTIONS,
  PATH_ROLL_TABLE_KIND_OPTIONS,
  DAMAGE_VALUE_OPTIONS,
  EFFECT_KIND,
  EFFECT_KIND_OPTIONS,
  FOLLOW_UP_SAVE_ATTEMPT_KIND_OPTIONS,
  FOLLOW_UP_SAVE_BRANCH_KIND_OPTIONS,
  FOLLOW_UP_SAVE_TIMING_OPTIONS,
  FOLLOW_UP_CHECK_ACTOR_OPTIONS,
  FORCED_MOVEMENT_ACTION_ECONOMY_OPTIONS,
  FORCED_MOVEMENT_DIRECTION_OPTIONS,
  FORCED_MOVEMENT_DISTANCE_MODE_OPTIONS,
  MANIFEST_KIND,
  MANIFEST_KIND_OPTIONS,
  MANUAL_ADJUDICATION_REASON_OPTIONS,
  LENGTH_UNIT_OPTIONS,
  MOVEMENT_RULE_KIND_OPTIONS,
  NON_MANIFEST_EFFECT_KIND_OPTIONS,
  SCALING_AMOUNT_OPTIONS,
  ACTION_ECONOMY_RULE_KIND_OPTIONS,
  CLOSED_RULE_KIND_OPTIONS,
  ACTIVATION_OPTIONS,
  EQUIPMENT_CATEGORY_OPTIONS,
  EQUIPMENT_PROPERTY_OPTIONS,
  type Trigger,
  type CoreMeta
} from '#core'
import {
  AUTHORED_LIMITS,
  AUTHORING_ACTION_PRESENTATIONS,
  buildNodeMap,
  type BuildNodeMap,
  type NodeEntry,
  type NodeMap
} from '#utils'
import type { AllUnionFields } from 'type-fest'
import {
  DURATION_NODE_MAP,
  FACET_NODE_MAP,
  NUMERIC_EXPR_NODE_MAP,
  RANGE_NODE_MAP,
  SAVING_THROW_NODE_MAP,
  SHAPE_NODE_MAP,
  SPEED_NODE_MAP,
  MEASUREMENT_NODE_MAP
} from '../../shared/maps/index.js'
import { MODIFIER_GRANT_NODE_MAP } from '../../grants/maps/modifier.js'
import { PROFICIENCY_NODE_MAP } from '../../grants/maps/proficiency.js'
import { SENSE_GRANT_NODE_MAP } from '../../grants/maps/sense.js'
import { ACTIVATION_NODE_MAP, INVOCATION_NODE_MAP } from './invocation.js'
import { OUTCOME_BONUS_NODE_MAP } from './outcomeBonus.js'
import { ATTACK_SLOT_CONDITION_NODE_MAP } from '../../features/maps/attackSlots.js'
import { ACTOR_RELATIONSHIP_MODULE_NODE_MAP } from './actorRelationshipModule.js'
import { PATH_LIFECYCLE_TURN_ANCHOR_NODE_MAP } from './pathLifecycleTurnAnchor.js'
import { ACTOR_RELATIONSHIP_RECURRENCE_NODE_MAP } from './actorRelationshipRecurrence.js'
import {
  FOLLOW_UP_SAVE_REPEAT_ATTEMPT_GATE_NODE_MAP,
  FOLLOW_UP_SAVE_REPEAT_ROLL_INFLUENCE_NODE_MAP,
  FOLLOW_UP_SAVE_REPEAT_TRIGGER_NODE_MAP
} from './followUpSaveRepeat.js'
import { MANIFEST_CAMOUFLAGE_NODE_MAP } from './manifestCamouflage.js'
import { MANIFEST_LIGHT_NODE_MAP } from './manifestLight.js'
import {
  PATH_LIFECYCLE_ESCAPE_NODE_MAP,
  PATH_LIFECYCLE_ON_END_NODE_MAP,
  PATH_LIFECYCLE_TURN_END_GATE_NODE_MAP
} from './pathLifecycleEnds.js'
import { registerCreatureFormOutcomeFields } from './creatureFormOutcomeFields.js'
import { registerOutcomeKindFields } from './outcomeKindFields.js'
import { PATH_LIFECYCLE_END_TRIGGER_NODE_MAP } from './lifecycleEndTrigger.js'
import { PATH_LIFECYCLE_EFFECT_OFFER_NODE_MAP } from './pathLifecycleEffectOffer.js'
import { RESULT_BLOCK_GATE_NODE_MAP } from './resultBlockGate.js'
import { CHOICE_OPTION_REQUIRED_RULE_NODE_MAP } from './choiceOptionRequiredRule.js'
import { FORCED_MOVEMENT_COLLISION_NODE_MAP } from './forcedMovementCollision.js'
import { TARGETING_NODE_MAP } from './targeting.js'
import { DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP } from './damage.js'

/** A select source listing fixed options. */
const inlineOptions = (options: readonly CoreMeta[]) => ({
  kind: 'INLINE_OPTIONS' as const,
  options
})

type OutcomeNode = AllUnionFields<OutcomeAuthored>
type NonManifestOutcomeNode = AllUnionFields<NonManifestOutcomeAuthored>
type OutcomeBreakpointNode = NonNullable<OutcomeNode['breakpoints']>[number]
type OutcomeBreakpointValueNode = AllUnionFields<OutcomeBreakpointNode['value']>
type ApplyGrantsNode = ApplyGrantAuthored['grants']
type SummonAbilityScoresNode = NonNullable<SummonStatBlockAuthored['abilityScores']>
type RollTableRerollValueNode = { id: string; order: number; value: number }
type FollowUpSaveBranchNode = AllUnionFields<FollowUpSaveBranchAuthored>
type FollowUpSaveAttemptsNode = AllUnionFields<FollowUpSaveAuthored['attempts']>
type ManifestDestructionCriterionNode = AllUnionFields<ManifestDestructionCriterionAuthored>
type ManifestProximityRuleNode = ManifestProximityRuleAuthored
type ManifestOccupantSaveBonusNode = AllUnionFields<ManifestOccupantSaveBonusAuthored>
type ManifestComponentRegionNode = NonNullable<ManifestComponentAuthored['region']>
type RollTableRepeatNode = NonNullable<AllUnionFields<PathRollTableRowAuthored>['repeat']>
type NodeMapBuildApi<NLocal extends object> = Parameters<
  BuildNodeMap<NLocal>['define']
>[1] extends (api: infer TApi) => void
  ? TApi
  : never
export type OutcomeNodeMapApi = NodeMapBuildApi<OutcomeNode>
type ScalarReductionNodeMapApi = NodeMapBuildApi<ScalarReductionAuthored>

/** The columns a select drawn from a System code list shows. */
const CODE_COLUMNS = ['id', 'label', 'description'] as const

const ROLL_TABLE_ROW_RESOLUTION_OPTIONS = [
  { code: 'RESULT', label: 'Result' },
  { code: 'REPEAT_TABLE', label: 'Repeat Table' }
] as const

const MANIFEST_DESTRUCTION_KIND_OPTIONS = [
  { code: 'DAMAGE_THRESHOLD', label: 'Damage Threshold' },
  { code: 'STRONG_WIND', label: 'Strong Wind' },
  { code: 'WIND_SPEED', label: 'Wind Speed' },
  { code: 'SPELL_CAPABILITY', label: 'Spell Capability' },
  { code: 'NAMED_OBJECT', label: 'Named Object' }
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

const pathLifecycle = buildNodeMap<PathLifecycleAuthored>()
const pathChosenItem = buildNodeMap<PathChosenItemAuthored>()
const pathLifecycleHolderEnd = buildNodeMap<NonNullable<PathLifecycleAuthored['holderEnd']>>()
const pathLifecycleGrantedAction =
  buildNodeMap<NonNullable<PathLifecycleAuthored['grantedActions']>[number]>()
const applyGrants = buildNodeMap<ApplyGrantsNode>()
const summonAbilityScores = buildNodeMap<SummonAbilityScoresNode>()
const telepathicLinkAbilityFloor = buildNodeMap<TelepathicLinkAbilityFloorAuthored>()
const summonStatBlock = buildNodeMap<SummonStatBlockAuthored>()
const outcome = buildNodeMap<OutcomeNode>()
const nonManifestOutcome = buildNodeMap<NonManifestOutcomeNode>()
const outcomeBreakpoint = buildNodeMap<OutcomeBreakpointNode>()
const outcomeBreakpointValue = buildNodeMap<OutcomeBreakpointValueNode>()
const followUpSaveBranch = buildNodeMap<FollowUpSaveBranchNode>()
const followUpSaveAttempts = buildNodeMap<FollowUpSaveAttemptsNode>()
const manifestComponent = buildNodeMap<ManifestComponentAuthored>()
const manifestComponentRegion = buildNodeMap<ManifestComponentRegionNode>()
const manifestDestructionCriterion = buildNodeMap<ManifestDestructionCriterionNode>()
const manifestProximityRule = buildNodeMap<ManifestProximityRuleNode>()
const manifestOccupantSaveBonus = buildNodeMap<ManifestOccupantSaveBonusNode>()
const resultBlock = buildNodeMap<ResultBlockAuthored>()
const nonManifestResultBlock = buildNodeMap<ResultBlockAuthored<NonManifestOutcomeAuthored>>()
const hitPointTierRow = buildNodeMap<PathHitPointTierRowAuthored>()
const nonManifestHitPointTierRow =
  buildNodeMap<PathHitPointTierRowAuthored<NonManifestOutcomeAuthored>>()
const choiceOption = buildNodeMap<PathChoiceOptionAuthored>()
const nonManifestChoiceOption = buildNodeMap<PathChoiceOptionAuthored<NonManifestOutcomeAuthored>>()
const rollRow = buildNodeMap<PathRollTableRowAuthored>()
const nonManifestRollRow = buildNodeMap<PathRollTableRowAuthored<NonManifestOutcomeAuthored>>()
const rollTableRerollValue = buildNodeMap<RollTableRerollValueNode>()
const rollTableRepeat = buildNodeMap<RollTableRepeatNode>()
const effectPath = buildNodeMap<EffectPathAuthored>()
const manifestNestedPath = buildNodeMap<EffectPathAuthored<Trigger, NonManifestOutcomeAuthored>>()
const manifestBehavior = buildNodeMap<ManifestBehaviorAuthored>()
const hitPointMaximumReductionAmountSource =
  buildNodeMap<HitPointMaximumReductionAuthored['amountSource']>()
const degradeEquipmentDestroyWhen = buildNodeMap<DegradeEquipmentDestroyWhenAuthored>()
const scalarReductionAmount = buildNodeMap<ScalarReductionAuthored['amount']>()
/** The rider's conditions are edited as outcome rows; the schema admits only CONDITION outcomes. */
type FollowUpSaveFailureMarginRiderNode = Omit<FailureMarginRiderAuthored, 'outcomes'> & {
  outcomes: OutcomeNode[]
}
const followUpSaveFailureMarginRider = buildNodeMap<FollowUpSaveFailureMarginRiderNode>()
const followUpSaveFailureMarginRiderLifecycle =
  buildNodeMap<FollowUpSaveFailureMarginRiderNode['lifecycle']>()

const OUTCOME_BREAKPOINT_VALUE_NODE_MAP: NodeMap<OutcomeBreakpointValueNode> =
  outcomeBreakpointValue.define('outcomeBreakpointValue', ({ map, nodes, cond }) => {
    const { number, text } = nodes
    const outcome = cond.ancestor<OutcomeNode>(2)

    map
      .set(
        'amount',
        number(['amount'], 'Amount', {
          constraints: { minimum: 0 },
          requiredIf: true,
          showIf: outcome.field(['valueKind']).eq('FIXED')
        })
      )
      .set(
        'diceConfig',
        text(['diceConfig'], 'Dice Config', {
          requiredIf: true,
          showIf: outcome.field(['valueKind']).eq('DICE')
        })
      )
  })

const OUTCOME_BREAKPOINT_NODE_MAP: NodeMap<OutcomeBreakpointNode> = outcomeBreakpoint.define(
  'outcomeBreakpoint',
  ({ map, nodes }) => {
    const { number, groupObject } = nodes

    map.set('level', number(['level'], 'Level', { requiredIf: true })).set(
      'value',
      groupObject(['value'], 'Value', () => OUTCOME_BREAKPOINT_VALUE_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true
      })
    )
  }
)

const PATH_LIFECYCLE_HOLDER_END_NODE_MAP: NodeMap<NonNullable<PathLifecycleAuthored['holderEnd']>> =
  pathLifecycleHolderEnd.define('pathLifecycleHolderEnd', ({ map, nodes }) => {
    const { selectSingle } = nodes

    map.set(
      'activation',
      selectSingle(['activation'], 'Costs', inlineOptions(ACTIVATION_OPTIONS), { requiredIf: true })
    )
  })

const PATH_LIFECYCLE_GRANTED_ACTION_NODE_MAP: NodeMap<
  NonNullable<PathLifecycleAuthored['grantedActions']>[number]
> = pathLifecycleGrantedAction.define(
  'pathLifecycleGrantedAction',
  ({ map, nodes, data, cond }) => {
    const { selectSingle, selectMulti, number, toggle } = nodes
    const { table } = data
    const isFree = cond.local().field(['activation']).eq('FREE')

    map
      .set(
        'activation',
        selectSingle(
          ['activation'],
          'Costs',
          {
            kind: 'INLINE_OPTIONS',
            options: ACTIVATION_OPTIONS.filter(({ code }) => code !== 'REACTION')
          },
          { requiredIf: true }
        )
      )
      .set(
        'usesPerTurn',
        number(['usesPerTurn'], 'Uses Per Turn', {
          requiredIf: isFree,
          showIf: isFree,
          constraints: { minimum: 1, maximum: 10 }
        })
      )
      .set(
        'actionDefinitionIds',
        selectMulti(
          ['actionDefinitionIds'],
          'Actions',
          {
            kind: 'DATA',
            relationship: table('reusable_definitions', { selectColumns: ['id', 'label'] })
          },
          { requiredIf: true }
        )
      )
      .set('weaponAttack', toggle(['weaponAttack'], 'Includes One Weapon Attack'))
  }
)

const PATH_LIFECYCLE_NODE_MAP: NodeMap<PathLifecycleAuthored> = pathLifecycle.define(
  'pathLifecycle',
  ({ map, nodes, data: { table } }) => {
    const { selectSingle, selectMulti, groupObject, groupArray, toggle, number, text } = nodes

    map
      .set(
        'recurringKind',
        selectSingle(
          ['recurringKind'],
          'Recurring',
          inlineOptions(PATH_LIFECYCLE_RECURRING_KIND_OPTIONS)
        )
      )
      .set(
        'turnAnchor',
        groupObject(['turnAnchor'], 'Turn Anchor', () => PATH_LIFECYCLE_TURN_ANCHOR_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'consumeOnFirstEvents',
        selectMulti(['consumeOnFirstEvents'], 'Consume On First Event', {
          kind: 'DATA',
          relationship: table('effect_consume_events', { selectColumns: CODE_COLUMNS })
        })
      )
      .set(
        'endOnEvents',
        selectMulti(['endOnEvents'], 'End On Events', {
          kind: 'DATA',
          relationship: table('effect_end_events', { selectColumns: CODE_COLUMNS })
        })
      )
      .set(
        'endOnTriggers',
        groupArray(['endOnTriggers'], 'End On', () => PATH_LIFECYCLE_END_TRIGGER_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'endOnConditionIds',
        selectMulti(['endOnConditionIds'], 'End While Holder Has', {
          kind: 'DATA',
          relationship: table('condition_types', {
            selectColumns: ['id', 'label', 'description']
          })
        })
      )
      .set(
        'returnsOn',
        selectSingle(['returnsOn'], 'Returns On', inlineOptions(PATH_LIFECYCLE_RETURNS_ON_OPTIONS))
      )
      .set(
        'holderEnd',
        groupObject(['holderEnd'], 'Holder Can End', () => PATH_LIFECYCLE_HOLDER_END_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set('endsWithHeldEffectId', text(['endsWithHeldEffectId'], 'Ends With Held Effect ID'))
      .set('fromSourceOnly', toggle(['fromSourceOnly'], 'From Source Only'))
      .set(
        'exclusivity',
        selectSingle(
          ['exclusivity'],
          'Exclusivity',
          inlineOptions(PATH_LIFECYCLE_EXCLUSIVITY_OPTIONS)
        )
      )
      .set(
        'uses',
        number(['uses'], 'Uses before it ends', { constraints: { minimum: 1, maximum: 255 } })
      )
      .set(
        'activeOnlyOnFinalAnchorTurn',
        toggle(['activeOnlyOnFinalAnchorTurn'], 'Active Only On Final Anchor Turn')
      )
      .set('heldBySource', toggle(['heldBySource'], 'Held By Zone'))
      .set(
        'escape',
        groupObject(['escape'], 'Escape', () => PATH_LIFECYCLE_ESCAPE_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'onEnd',
        groupObject(['onEnd'], 'When It Ends', () => PATH_LIFECYCLE_ON_END_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'turnEndGate',
        groupObject(['turnEndGate'], 'Turn-End Roll', () => PATH_LIFECYCLE_TURN_END_GATE_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'grantedActions',
        groupArray(
          ['grantedActions'],
          'Actions Granted While Held',
          () => PATH_LIFECYCLE_GRANTED_ACTION_NODE_MAP,
          { presentation: 'inline' }
        )
      )
      .set(
        'effectOffers',
        groupArray(
          ['effectOffers'],
          'Offers Beside The Holder',
          () => PATH_LIFECYCLE_EFFECT_OFFER_NODE_MAP,
          { presentation: 'inline' }
        )
      )
  }
)

const APPLY_GRANTS_NODE_MAP: NodeMap<ApplyGrantsNode> = applyGrants.define(
  'applyGrants',
  ({ map, nodes }) => {
    const { groupArray } = nodes

    map
      .set(
        'modifiers',
        groupArray(['modifiers'], 'Modifier Grants', () => MODIFIER_GRANT_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'proficiencies',
        groupArray(['proficiencies'], 'Proficiency Grants', () => PROFICIENCY_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'senses',
        groupArray(['senses'], 'Sense Grants', () => SENSE_GRANT_NODE_MAP, {
          presentation: 'inline'
        })
      )
  }
)

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

const SUMMON_STAT_BLOCK_NODE_MAP: NodeMap<SummonStatBlockAuthored> = summonStatBlock.define(
  'summonStatBlock',
  ({ map, nodes, data }) => {
    const { selectSingle, text, toggle, groupObject, groupArray, selectMulti } = nodes
    const { table } = data

    map
      .set(
        'size',
        selectSingle(['size'], 'Size', {
          kind: 'DATA',
          relationship: table('sizes', { selectColumns: CODE_COLUMNS })
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
        selectSingle(
          ['damageabilityKind'],
          'Damageability',
          inlineOptions(SUMMON_DAMAGEABILITY_OPTIONS)
        )
      )
      .set(
        'visibilityKind',
        selectSingle(['visibilityKind'], 'Visibility', inlineOptions(SUMMON_VISIBILITY_OPTIONS))
      )
  }
)

const MANIFEST_DESTRUCTION_CRITERION_NODE_MAP: NodeMap<ManifestDestructionCriterionNode> =
  manifestDestructionCriterion.define(
    'manifestDestructionCriterion',
    ({ map, nodes, cond, data }) => {
      const { text, number, selectSingle, selectMulti } = nodes
      const local = cond.local()
      const { table } = data

      map
        .set('id', text(['id'], 'ID'))
        .set('order', number(['order'], 'Order', { requiredIf: true }))
        .set(
          'kind',
          selectSingle(['kind'], 'Criterion', inlineOptions(MANIFEST_DESTRUCTION_KIND_OPTIONS), {
            requiredIf: true
          })
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
            {
              requiredIf: true,
              showIf: local.field(['kind']).eq('DAMAGE_THRESHOLD')
            }
          )
        )
        .set(
          'amount',
          number(['amount'], 'Minimum Damage', {
            constraints: { minimum: 0 },
            requiredIf: true,
            showIf: local.field(['kind']).eq('DAMAGE_THRESHOLD')
          })
        )
        .set(
          'minimumMilesPerHour',
          number(['minimumMilesPerHour'], 'Minimum Wind Speed (mph)', {
            constraints: { minimum: 0.01 },
            requiredIf: true,
            showIf: local.field(['kind']).eq('WIND_SPEED')
          })
        )
        .set(
          'afterRounds',
          number(['afterRounds'], 'Disperses After Rounds', {
            constraints: { minimum: 1 },
            requiredIf: true,
            showIf: local.field(['kind']).eq('WIND_SPEED')
          })
        )
        .set(
          'capability',
          selectSingle(
            ['capability'],
            'Spell Capability',
            inlineOptions(MANIFEST_SPELL_CAPABILITY_OPTIONS),
            {
              requiredIf: true,
              showIf: local.field(['kind']).eq('SPELL_CAPABILITY')
            }
          )
        )
        .set(
          'minimumSpellLevel',
          number(['minimumSpellLevel'], 'Minimum Spell Level', {
            constraints: { minimum: 0, maximum: 9 },
            requiredIf: true,
            showIf: local.field(['kind']).eq('SPELL_CAPABILITY')
          })
        )
        .set(
          'exampleSpellIds',
          selectMulti(
            ['exampleSpellIds'],
            'Example Spells',
            {
              kind: 'DATA',
              relationship: table('spells', { selectColumns: ['id', 'label'] })
            },
            { showIf: local.field(['kind']).eq('SPELL_CAPABILITY') }
          )
        )
        .set(
          'objectLabel',
          text(['objectLabel'], 'Object', {
            requiredIf: true,
            showIf: local.field(['kind']).eq('NAMED_OBJECT')
          })
        )
    }
  )

const MANIFEST_OCCUPANT_SAVE_BONUS_NODE_MAP: NodeMap<ManifestOccupantSaveBonusNode> =
  manifestOccupantSaveBonus.define('manifestOccupantSaveBonus', ({ map, nodes, cond, data }) => {
    const { text, number, selectSingle } = nodes
    const local = cond.local()
    const isAbilityModifier = local.field(['amountKind']).eq('SOURCE_ABILITY_MODIFIER')

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'domain',
        selectSingle(
          ['domain'],
          'Applies To',
          {
            kind: 'INLINE_OPTIONS',
            options: [{ code: 'EVERY_SAVING_THROW', label: 'Every Saving Throw' }]
          },
          { requiredIf: true }
        )
      )
      .set(
        'amountKind',
        selectSingle(
          ['amountKind'],
          'Amount',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'FIXED', label: 'Fixed' },
              { code: 'SOURCE_ABILITY_MODIFIER', label: 'Source Ability Modifier' }
            ]
          },
          { requiredIf: true }
        )
      )
      .set(
        'amount',
        number(['amount'], 'Bonus', {
          requiredIf: true,
          showIf: local.field(['amountKind']).eq('FIXED'),
          constraints: { minimum: 1 }
        })
      )
      .set(
        'ability',
        selectSingle(
          ['ability'],
          'Ability',
          { kind: 'DATA', relationship: data.table('abilities', { selectColumns: CODE_COLUMNS }) },
          { requiredIf: true, showIf: isAbilityModifier }
        )
      )
      .set('minimum', number(['minimum'], 'Minimum Bonus', { showIf: isAbilityModifier }))
      .set(
        'dispositionFilter',
        selectSingle(
          ['dispositionFilter'],
          'Benefits',
          {
            kind: 'INLINE_OPTIONS',
            options: [{ code: 'ALLIES_AND_SOURCE', label: 'Source and Its Allies' }]
          },
          { requiredIf: true }
        )
      )
  })

const MANIFEST_COMPONENT_REGION_NODE_MAP: NodeMap<ManifestComponentRegionNode> =
  manifestComponentRegion.define('manifestComponentRegion', ({ map, nodes }) => {
    const { selectSingle, groupObject } = nodes

    map
      .set(
        'kind',
        selectSingle(['kind'], 'Region', {
          kind: 'INLINE_OPTIONS',
          options: [{ code: 'SIDE_BAND', label: 'Band on the Chosen Side' }]
        })
      )
      .set(
        'distance',
        groupObject(['distance'], 'Band Distance', () => MEASUREMENT_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
  })

const MANIFEST_COMPONENT_NODE_MAP: NodeMap<ManifestComponentAuthored> = manifestComponent.define(
  'manifestComponent',
  ({ map, nodes, data }) => {
    const { text, number, selectSingle, selectMulti, toggle, groupArray, groupObject } = nodes
    const { table } = data

    map
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order', { requiredIf: true }))
      .set('label', text(['label'], 'Label', { requiredIf: true }))
      .set(
        'region',
        groupObject(['region'], 'Region', () => MANIFEST_COMPONENT_REGION_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'interactionKinds',
        selectMulti(['interactionKinds'], 'Interactions', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'ENTER_OR_PASS_THROUGH', label: 'Enter or Pass Through' },
            { code: 'MOVE_ACROSS', label: 'Move Across' },
            { code: 'ENTER_SPACE', label: 'Enter Space' },
            { code: 'LEAVE_SPACE', label: 'Leave Space' },
            { code: 'START_TURN_IN_SPACE', label: 'Start Turn in Space' },
            { code: 'END_TURN_IN_SPACE', label: 'End Turn in Space' },
            { code: 'START_OF_SOURCE_TURN', label: 'Start of Source Turn' },
            { code: 'MELEE_HIT_ON_SOURCE', label: 'Melee Hit on Source' },
            { code: 'SOURCE_HIT', label: 'Source Hits' },
            { code: 'TARGET_TAKES_FIRE_DAMAGE', label: 'Target Takes Fire Damage' },
            { code: 'START_OF_ATTACHED_TARGET_TURN', label: 'Start of Attached Target Turn' },
            { code: 'END_OF_ATTACHED_TARGET_NEXT_TURN', label: 'End of Attached Target Next Turn' }
          ]
        })
      )
      .set('bypassAtHalfSpeed', toggle(['bypassAtHalfSpeed'], 'Bypass at Half Speed'))
      .set(
        'choosesUnaffected',
        toggle(['choosesUnaffected'], 'Caster Chooses Unaffected Creatures')
      )
      .set(
        'movementCostMultiplier',
        number(['movementCostMultiplier'], 'Movement Cost Multiplier', {
          constraints: { minimum: 0.01 }
        })
      )
      .set(
        'perDistanceMoved',
        groupObject(
          ['perDistanceMoved'],
          'Applies per Distance Moved',
          () => MEASUREMENT_NODE_MAP,
          {
            presentation: 'inline'
          }
        )
      )
      .set('requiresFullyWithin', toggle(['requiresFullyWithin'], 'Requires Fully Within'))
      .set(
        'requiredSight',
        selectMulti(
          ['requiredSight'],
          'Requires Sight',
          inlineOptions(MANIFEST_REQUIRED_SIGHT_OPTIONS)
        )
      )
      .set(
        'automaticSaveSuccessImmunityDamageTypeId',
        selectSingle(
          ['automaticSaveSuccessImmunityDamageTypeId'],
          'Automatic Save Success on Damage Immunity',
          {
            kind: 'DATA',
            relationship: table('damage_types', {
              selectColumns: ['id', 'label', 'description']
            })
          }
        )
      )
      .set(
        'occupantSaveBonus',
        groupObject(
          ['occupantSaveBonus'],
          'Occupant Save Bonus',
          () => MANIFEST_OCCUPANT_SAVE_BONUS_NODE_MAP,
          {
            presentation: 'inline'
          }
        )
      )
      .set('requiresIgnition', toggle(['requiresIgnition'], 'Requires Ignition'))
      .set(
        'maxApplicationsPerTurn',
        number(['maxApplicationsPerTurn'], 'Maximum Applications per Turn', {
          constraints: { minimum: 1 }
        })
      )
      .set(
        'maxApplicationsTotal',
        number(['maxApplicationsTotal'], 'Maximum Total Applications', {
          constraints: { minimum: 1 }
        })
      )
      .set('armorClass', number(['armorClass'], 'Armor Class', { constraints: { minimum: 0 } }))
      .set('hitPoints', number(['hitPoints'], 'Hit Points', { constraints: { minimum: 0 } }))
      .set(
        'blockingRules',
        selectMulti(['blockingRules'], 'Blocks', inlineOptions(MANIFEST_BLOCKING_RULE_OPTIONS))
      )
      .set(
        'destructionCriteria',
        groupArray(
          ['destructionCriteria'],
          'Destruction Criteria',
          () => MANIFEST_DESTRUCTION_CRITERION_NODE_MAP,
          { presentation: 'summary' }
        )
      )
      .set(
        'releaseCriteria',
        groupArray(
          ['releaseCriteria'],
          'Release Criteria',
          () => MANIFEST_DESTRUCTION_CRITERION_NODE_MAP,
          { presentation: 'summary' }
        )
      )
      .set(
        'behaviors',
        groupArray(['behaviors'], 'Behaviors', () => MANIFEST_BEHAVIOR_NODE_MAP, {
          presentation: 'summary'
        })
      )
  }
)

const MANIFEST_PROXIMITY_RULE_NODE_MAP: NodeMap<ManifestProximityRuleNode> =
  manifestProximityRule.define('manifestProximityRule', ({ map, nodes }) => {
    const { text, selectMulti, toggle, groupObject } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'events',
        selectMulti(['events'], 'Events', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'MOVE_WITHIN', label: 'Move Within Range' },
            { code: 'START_TURN', label: 'Start Turn Within Range' }
          ]
        })
      )
      .set(
        'distance',
        groupObject(['distance'], 'Distance', () => MEASUREMENT_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
      .set('requiresSight', toggle(['requiresSight'], 'Requires Sight'))
      .set(
        'behavior',
        groupObject(['behavior'], 'Behavior', () => MANIFEST_BEHAVIOR_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
  })

const HIT_POINT_MAXIMUM_REDUCTION_AMOUNT_SOURCE_NODE_MAP =
  hitPointMaximumReductionAmountSource.define(
    'hitPointMaximumReductionAmountSource',
    ({ map, nodes }) => {
      const { text, selectSingle } = nodes
      map
        .set(
          'kind',
          selectSingle(['kind'], 'Amount Source', {
            kind: 'INLINE_OPTIONS',
            options: [{ code: 'DAMAGE_TAKEN', label: 'Damage Taken' }]
          })
        )
        .set('damageOutcomeId', text(['damageOutcomeId'], 'Damage Outcome ID'))
    }
  )

const DEGRADE_EQUIPMENT_DESTROY_WHEN_NODE_MAP = degradeEquipmentDestroyWhen.define(
  'degradeEquipmentDestroyWhen',
  ({ map, nodes }) => {
    const { number, selectSingle } = nodes
    map
      .set(
        'kind',
        selectSingle(['kind'], 'Destroyed When', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'ARMOR_CLASS_OFFERED_AT_MOST', label: 'Armor Class offered is at most' },
            { code: 'PENALTY_REACHES', label: 'Penalty reaches' }
          ]
        })
      )
      .set('value', number(['value'], 'Value', { constraints: { minimum: 0 } }))
  }
)

const SCALAR_REDUCTION_AMOUNT_NODE_MAP = scalarReductionAmount.define(
  'scalarReductionAmount',
  ({ map, nodes }) => {
    const { text, selectSingle } = nodes
    map
      .set(
        'kind',
        selectSingle(['kind'], 'Amount Kind', {
          kind: 'INLINE_OPTIONS',
          options: [{ code: 'DICE', label: 'Dice' }]
        })
      )
      .set('diceConfig', text(['diceConfig'], 'Dice Config'))
  }
)

const FOLLOW_UP_SAVE_FAILURE_MARGIN_RIDER_LIFECYCLE_NODE_MAP =
  followUpSaveFailureMarginRiderLifecycle.define(
    'followUpSaveFailureMarginRiderLifecycle',
    ({ map, nodes }) => {
      map.set(
        'endOnTriggers',
        nodes.groupArray(['endOnTriggers'], 'End On', () => PATH_LIFECYCLE_END_TRIGGER_NODE_MAP, {
          presentation: 'inline'
        })
      )
    }
  )

const FOLLOW_UP_SAVE_FAILURE_MARGIN_RIDER_NODE_MAP = followUpSaveFailureMarginRider.define(
  'followUpSaveFailureMarginRider',
  ({ map, nodes }) => {
    const { number, text, groupArray, groupObject } = nodes
    map
      .set(
        'failedBy',
        number(['failedBy'], 'Fails By at Least', {
          constraints: { minimum: 1, maximum: 30 },
          requiredIf: true
        })
      )
      .set(
        'outcomes',
        groupArray(['outcomes'], 'Conditions', () => OUTCOME_NODE_MAP, {
          presentation: 'summary',
          requiredIf: true
        })
      )
      .set('endsWithOutcomeId', text(['endsWithOutcomeId'], 'Ends With Condition Outcome ID'))
      .set(
        'lifecycle',
        groupObject(
          ['lifecycle'],
          'Lifecycle',
          () => FOLLOW_UP_SAVE_FAILURE_MARGIN_RIDER_LIFECYCLE_NODE_MAP,
          { presentation: 'inline', requiredIf: true }
        )
      )
  }
)

const TELEPATHIC_LINK_ABILITY_FLOOR_NODE_MAP = telepathicLinkAbilityFloor.define(
  'telepathicLinkAbilityFloor',
  ({ map, nodes, data }) => {
    const { number, selectSingle } = nodes

    map
      .set(
        'ability',
        selectSingle(
          ['ability'],
          'Ability',
          { kind: 'DATA', relationship: data.table('abilities', { selectColumns: CODE_COLUMNS }) },
          { requiredIf: true }
        )
      )
      .set(
        'score',
        number(['score'], 'At or Below', { constraints: { minimum: 0 }, requiredIf: true })
      )
  }
)

function registerOutcomeFields(
  map: OutcomeNodeMapApi['map'],
  nodes: OutcomeNodeMapApi['nodes'],
  cond: OutcomeNodeMapApi['cond'],
  logic: OutcomeNodeMapApi['logic'],
  data: OutcomeNodeMapApi['data'],
  effectKindOptions: readonly { code: string; label: string }[]
) {
  const { text, richText, number, selectSingle, selectMulti, toggle, groupArray, groupObject } =
    nodes
  const { and, or, not } = logic
  const local = cond.local()
  const manifestsOther = and([
    local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST),
    not(local.field(['manifestKind']).eq(MANIFEST_KIND.CREATURE))
  ])
  const { table } = data
  const scalarReductionGroupObject =
    groupObject as unknown as ScalarReductionNodeMapApi['nodes']['groupObject']

  map
    .set('id', text(['id'], 'ID'))
    .set(
      'effectKind',
      selectSingle(['effectKind'], 'Effect Kind', inlineOptions(effectKindOptions), {
        requiredIf: true
      })
    )
    .set(
      'hitPointMaximumReductionAmountSource',
      groupObject(
        ['amountSource'],
        'Amount Source',
        () => HIT_POINT_MAXIMUM_REDUCTION_AMOUNT_SOURCE_NODE_MAP,
        {
          presentation: 'inline',
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION)
        }
      )
    )
    .set(
      'hitPointMaximumReductionRecoveryTags',
      selectMulti(
        ['recoveryTags'],
        'Recovery',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'RESTORE_HIT_POINT_MAXIMUM', label: 'Restore Hit Point Maximum' },
            { code: 'LONG_REST', label: 'Long Rest' }
          ]
        },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION) }
      )
    )
    .set(
      'scalarReductionValueDefinitionId',
      selectSingle(
        ['valueDefinitionId'],
        'Value',
        {
          kind: 'DATA',
          relationship: table('ability_definitions', {
            selectColumns: ['id', 'label', 'description']
          })
        },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.SCALAR_REDUCTION) }
      )
    )
    .set(
      'scalarReductionAmount',
      scalarReductionGroupObject(['amount'], 'Reduction', () => SCALAR_REDUCTION_AMOUNT_NODE_MAP, {
        presentation: 'inline',
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.SCALAR_REDUCTION)
      }) as unknown as NodeEntry<OutcomeNode>
    )
    .set(
      'scalarReductionStacking',
      selectSingle(
        ['stacking'],
        'Stacking',
        { kind: 'INLINE_OPTIONS', options: [{ code: 'ADDITIVE', label: 'Additive' }] },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.SCALAR_REDUCTION) }
      )
    )
    .set(
      'scalarReductionFloor',
      number(['floor'], 'Floor', {
        constraints: { minimum: 0, maximum: 0 },
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.SCALAR_REDUCTION)
      })
    )
    .set(
      'scalarReductionRecoveryTriggers',
      selectMulti(
        ['recoveryTriggers'],
        'Recovery Triggers',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'SHORT_REST', label: 'Short Rest' },
            { code: 'LONG_REST', label: 'Long Rest' }
          ]
        },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.SCALAR_REDUCTION) }
      )
    )
    .set(
      'scalarReductionTerminalConsequence',
      selectSingle(
        ['terminalConsequence'],
        'Terminal Consequence',
        { kind: 'INLINE_OPTIONS', options: [{ code: 'TARGET_DIED', label: 'Target Dies' }] },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.SCALAR_REDUCTION) }
      )
    )
    .set(
      'followUpSaveRepeatRollInfluence',
      groupObject(
        ['repeatRollInfluence'],
        'Repeat Roll Influence',
        () => FOLLOW_UP_SAVE_REPEAT_ROLL_INFLUENCE_NODE_MAP,
        {
          presentation: 'inline',
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE)
        }
      )
    )
    .set(
      'followUpSaveRepeatAttemptGate',
      groupObject(
        ['repeatAttemptGate'],
        'Repeat Attempt Gate',
        () => FOLLOW_UP_SAVE_REPEAT_ATTEMPT_GATE_NODE_MAP,
        {
          presentation: 'inline',
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE)
        }
      )
    )
    .set(
      'followUpSaveRepeatTriggers',
      groupArray(
        ['repeatTriggers'],
        'Repeat Triggers',
        () => FOLLOW_UP_SAVE_REPEAT_TRIGGER_NODE_MAP,
        {
          presentation: 'summary',
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE)
        }
      )
    )
    .set(
      'followUpSaveFailureMarginRider',
      groupObject(
        ['failureMarginRider'],
        'Failure Margin Rider',
        () => FOLLOW_UP_SAVE_FAILURE_MARGIN_RIDER_NODE_MAP,
        {
          presentation: 'inline',
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE)
        }
      )
    )
    .set(
      'actorRelationshipHeldAtOnce',
      number(['heldAtOnce'], 'Held at Once', {
        constraints: { minimum: 1 },
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.ACTOR_RELATIONSHIP)
      })
    )
    .set(
      'actorRelationshipAppliesWhen',
      groupObject(['appliesWhen'], 'Applies Only When', () => ATTACK_SLOT_CONDITION_NODE_MAP, {
        presentation: 'inline',
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.ACTOR_RELATIONSHIP)
      })
    )
    .set(
      'actorRelationshipModules',
      groupArray(['modules'], 'Relationship Modules', () => ACTOR_RELATIONSHIP_MODULE_NODE_MAP, {
        presentation: 'summary',
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.ACTOR_RELATIONSHIP)
      })
    )
    .set(
      'actorRelationshipConditions',
      groupArray(
        ['conditions'],
        'Conditions',
        () => OUTCOME_NODE_MAP as unknown as NodeMap<ConditionAuthored>,
        {
          presentation: 'summary',
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.ACTOR_RELATIONSHIP)
        }
      )
    )
    .set(
      'actorRelationshipRecurrence',
      groupObject(['recurrence'], 'Recurrence', () => ACTOR_RELATIONSHIP_RECURRENCE_NODE_MAP, {
        presentation: 'inline',
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.ACTOR_RELATIONSHIP)
      })
    )
    .set(
      'bonuses',
      groupArray(['bonuses'], 'Bonuses', () => OUTCOME_BONUS_NODE_MAP, {
        presentation: 'inline',
        showIf: or([
          local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
        ])
      })
    )
    .set(
      'temporary',
      toggle(['temporary'], 'Temporary', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
      })
    )
    .set(
      'usesTriggeringWeaponDamageType',
      toggle(['usesTriggeringWeaponDamageType'], "Use the triggering weapon's damage type", {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE)
      })
    )
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
        {
          requiredIf: and([
            local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
            not(local.field(['usesTriggeringWeaponDamageType']).eq(true))
          ]),
          showIf: and([
            local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
            not(local.field(['usesTriggeringWeaponDamageType']).eq(true))
          ])
        }
      )
    )
    .set(
      'valueKind',
      selectSingle(['valueKind'], 'Value Kind', inlineOptions(DAMAGE_VALUE_OPTIONS), {
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE)
      })
    )
    .set(
      'scalingKind',
      selectSingle(
        ['scalingKind'],
        'Scaling Kind',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'NONE', label: 'None' },
            { code: 'PER_LEVEL', label: 'Per Level' },
            { code: 'BREAKPOINTS', label: 'Breakpoints' }
          ]
        },
        {
          requiredIf: true,
          showIf: or([
            local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
            local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
          ])
        }
      )
    )
    .set(
      'amountKind',
      selectSingle(['amountKind'], 'Amount Modifier', inlineOptions(SCALING_AMOUNT_OPTIONS), {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE)
      })
    )
    .set(
      'damageAmount',
      number(['amount'], 'Amount', {
        constraints: { minimum: 0 },
        requiredIf: not(
          and([local.field(['valueKind']).eq('POOL'), local.field(['scalingKind']).eq('PER_LEVEL')])
        ),
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
          or([
            and([
              local.field(['scalingKind']).eq('NONE'),
              or([local.field(['valueKind']).eq('FIXED'), local.field(['valueKind']).eq('POOL')])
            ]),
            and([
              local.field(['scalingKind']).eq('PER_LEVEL'),
              local.field(['valueKind']).eq('POOL')
            ])
          ])
        ])
      })
    )
    .set(
      'amount',
      number(['amount'], 'Amount', {
        requiredIf: not(
          and([local.field(['valueKind']).eq('POOL'), local.field(['scalingKind']).eq('PER_LEVEL')])
        ),
        showIf: or([
          and([
            local.field(['effectKind']).eq(EFFECT_KIND.HEAL),
            or([
              and([
                local.field(['scalingKind']).eq('NONE'),
                or([local.field(['valueKind']).eq('FIXED'), local.field(['valueKind']).eq('POOL')])
              ]),
              and([
                local.field(['scalingKind']).eq('PER_LEVEL'),
                local.field(['valueKind']).eq('POOL')
              ])
            ])
          ])
        ])
      })
    )
    .set(
      'damageMultiplier',
      number(['multiplier'], 'Multiplier', {
        constraints: { minimum: 0 },
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE)
      })
    )
    .set(
      'multiplier',
      number(['multiplier'], 'Multiplier', {
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL),
          local.field(['valueKind']).eq('POOL')
        ])
      })
    )
    .set(
      'damageMin',
      number(['min'], 'Min', {
        constraints: { minimum: 0 },
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
          local.field(['scalingKind']).eq('PER_LEVEL'),
          local.field(['valueKind']).eq('POOL')
        ])
      })
    )
    .set(
      'min',
      number(['min'], 'Min', {
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL),
          local.field(['scalingKind']).eq('PER_LEVEL'),
          local.field(['valueKind']).eq('POOL')
        ])
      })
    )
    .set(
      'damageMax',
      number(['max'], 'Max', {
        constraints: { minimum: 0 },
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
          local.field(['scalingKind']).eq('PER_LEVEL'),
          local.field(['valueKind']).eq('POOL')
        ])
      })
    )
    .set(
      'max',
      number(['max'], 'Max', {
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.HEAL),
          local.field(['scalingKind']).eq('PER_LEVEL'),
          local.field(['valueKind']).eq('POOL')
        ])
      })
    )
    .set(
      'diceConfig',
      text(['diceConfig'], 'Dice Config', {
        requiredIf: true,
        showIf: and([
          or([
            local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
            local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
          ]),
          local.field(['scalingKind']).eq('NONE'),
          local.field(['valueKind']).eq('DICE')
        ])
      })
    )
    .set(
      'levels',
      groupArray(['levels'], 'Levels', () => DAMAGE_LEVEL_SCALING_ENTRY_NODE_MAP, {
        presentation: 'table',
        showIf: and([
          or([
            local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
            local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
          ]),
          local.field(['scalingKind']).eq('PER_LEVEL'),
          not(local.field(['valueKind']).eq('POOL'))
        ])
      })
    )
    .set(
      'breakpoints',
      groupArray(['breakpoints'], 'Breakpoints', () => OUTCOME_BREAKPOINT_NODE_MAP, {
        presentation: 'table',
        showIf: and([
          or([
            local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
            local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
          ]),
          local.field(['scalingKind']).eq('BREAKPOINTS')
        ])
      })
    )
    .set(
      'scalingSource',
      selectSingle(
        ['scalingSource'],
        'Scaling Source',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'CHARACTER_LEVEL', label: 'Character Level' },
            { code: 'CLASS_LEVEL', label: 'Class Level' },
            { code: 'PARENT_CLASS_LEVEL', label: 'Parent Class Level' },
            { code: 'SPELL_CAST_LEVEL', label: 'Spell Cast Level' }
          ]
        },
        {
          requiredIf: true,
          showIf: and([
            or([
              local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
              local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
            ]),
            or([
              and([
                local.field(['scalingKind']).eq('PER_LEVEL'),
                not(local.field(['valueKind']).eq('POOL'))
              ]),
              local.field(['scalingKind']).eq('BREAKPOINTS')
            ])
          ])
        }
      )
    )
    .set(
      'classId',
      selectSingle(
        ['classId'],
        'Class',
        {
          kind: 'DATA',
          relationship: table('classes', {
            selectColumns: ['id', 'label']
          })
        },
        {
          requiredIf: true,
          showIf: and([
            or([
              local.field(['effectKind']).eq(EFFECT_KIND.DAMAGE),
              local.field(['effectKind']).eq(EFFECT_KIND.HEAL)
            ]),
            or([
              and([
                local.field(['scalingKind']).eq('PER_LEVEL'),
                not(local.field(['valueKind']).eq('POOL'))
              ]),
              local.field(['scalingKind']).eq('BREAKPOINTS')
            ]),
            local.field(['scalingSource']).eq('CLASS_LEVEL')
          ])
        }
      )
    )
    .set(
      'conditionId',
      selectSingle(
        ['conditionId'],
        'Condition',
        {
          kind: 'DATA',
          relationship: table('condition_types', {
            selectColumns: ['id', 'label', 'description']
          })
        },
        {
          requiredIf: true,
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.CONDITION)
        }
      )
    )
  registerOutcomeKindFields(map, nodes, cond, logic, data)
  map
    .set(
      'grants',
      groupObject(['grants'], 'Grants', () => APPLY_GRANTS_NODE_MAP, {
        presentation: 'inline',
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.APPLY_GRANT)
      })
    )
    .set(
      'bindsChosenItem',
      toggle(['bindsChosenItem'], 'Grants Apply Only to the Chosen Item', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.APPLY_GRANT),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'unlessChosenItemReleased',
      toggle(['unlessChosenItemReleased'], 'Only If the Chosen Item Is Not Released', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.APPLY_GRANT),
        hiddenBehavior: 'CLEAR'
      })
    )
    .set(
      'direction',
      selectSingle(['direction'], 'Direction', inlineOptions(FORCED_MOVEMENT_DIRECTION_OPTIONS), {
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT)
      })
    )
    .set(
      'distanceMode',
      selectSingle(
        ['distanceMode'],
        'Distance Mode',
        inlineOptions(FORCED_MOVEMENT_DISTANCE_MODE_OPTIONS),
        {
          requiredIf: true,
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT)
        }
      )
    )
    .set(
      'movementAmount',
      number(['amount'], 'Distance Amount', {
        requiredIf: true,
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT),
          or([local.field(['distanceMode']).eq('EXACT'), local.field(['distanceMode']).eq('UP_TO')])
        ])
      })
    )
    .set(
      'movementUnit',
      selectSingle(['unit'], 'Distance Unit', inlineOptions(LENGTH_UNIT_OPTIONS), {
        requiredIf: true,
        showIf: or([
          and([
            local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT),
            or([
              local.field(['distanceMode']).eq('EXACT'),
              local.field(['distanceMode']).eq('UP_TO')
            ])
          ])
        ])
      })
    )
    .set(
      'actionEconomy',
      selectSingle(
        ['actionEconomy'],
        'Action Economy',
        inlineOptions(FORCED_MOVEMENT_ACTION_ECONOMY_OPTIONS),
        {
          requiredIf: true,
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT)
        }
      )
    )
    .set(
      'collision',
      groupObject(['collision'], 'Collision', () => FORCED_MOVEMENT_COLLISION_NODE_MAP, {
        presentation: 'inline',
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.FORCED_MOVEMENT)
      })
    )
    .set(
      'targetKind',
      selectSingle(['targetKind'], 'Target', inlineOptions(TELEPORT_TARGET_KIND_OPTIONS), {
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPORT)
      })
    )
    .set(
      'destinationKind',
      selectSingle(
        ['destinationKind'],
        'Destination',
        inlineOptions(TELEPORT_DESTINATION_KIND_OPTIONS),
        {
          requiredIf: true,
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPORT)
        }
      )
    )
    .set(
      'distance',
      groupObject(['distance'], 'Distance', () => RANGE_NODE_MAP, {
        presentation: 'inline',
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPORT)
      })
    )
    .set(
      'manifestKind',
      selectSingle(['manifestKind'], 'Manifest Kind', inlineOptions(MANIFEST_KIND_OPTIONS), {
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'manifestMaxApplicationsPerTurn',
      number(['maxApplicationsPerTurn'], 'Maximum Applications per Turn', {
        constraints: { minimum: 1 },
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'placementSurfaceKind',
      selectSingle(
        ['placementSurfaceKind'],
        'Placement Surface',
        { kind: 'INLINE_OPTIONS', options: [{ code: 'LEVEL', label: 'Level Surface' }] },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST) }
      )
    )
    .set(
      'applicationTargetKind',
      selectSingle(
        ['applicationTargetKind'],
        'Application Target',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'WEAPON', label: 'Weapon' },
            { code: 'AMMUNITION', label: 'Ammunition' }
          ]
        },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST) }
      )
    )
    .set(
      'applicationCount',
      number(['applicationCount'], 'Application Count', {
        constraints: { minimum: 1 },
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'qualifyingDamageTypeIds',
      selectMulti(
        ['qualifyingDamageTypeIds'],
        'Qualifying Damage Types',
        {
          kind: 'DATA',
          relationship: table('damage_types', {
            selectColumns: ['id', 'label', 'description']
          })
        },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST) }
      )
    )
  registerCreatureFormOutcomeFields(map, nodes, cond, logic, data)
  map
    .set(
      'shape',
      groupObject(['shape'], 'Shape', () => SHAPE_NODE_MAP, {
        presentation: 'inline',
        showIf: manifestsOther
      })
    )
    .set(
      'label',
      text(['label'], 'Label', {
        requiredIf: or([
          local.field(['effectKind']).eq(EFFECT_KIND.MANUAL_ADJUDICATION),
          local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK)
        ]),
        showIf: or([
          local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST),
          local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK),
          local.field(['effectKind']).eq(EFFECT_KIND.MANUAL_ADJUDICATION)
        ])
      })
    )
    .set(
      'reasonCode',
      selectSingle(['reasonCode'], 'Reason', inlineOptions(MANUAL_ADJUDICATION_REASON_OPTIONS), {
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANUAL_ADJUDICATION)
      })
    )
    .set(
      'instructions',
      richText(['instructions'], 'Instructions', {
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANUAL_ADJUDICATION)
      })
    )
    .set(
      'followUpTiming',
      selectSingle(['timing'], 'Timing', inlineOptions(FOLLOW_UP_SAVE_TIMING_OPTIONS), {
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE)
      })
    )
    .set(
      'savingThrow',
      groupObject(['savingThrow'], 'Saving Throw', () => SAVING_THROW_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE)
      })
    )
    .set(
      'attempts',
      groupObject(['attempts'], 'Attempts', () => FOLLOW_UP_SAVE_ATTEMPTS_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE)
      })
    )
    .set(
      'onSuccess',
      groupObject(['onSuccess'], 'On Success', () => FOLLOW_UP_SAVE_BRANCH_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: or([
          local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE),
          local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK)
        ])
      })
    )
    .set(
      'onFailure',
      groupObject(['onFailure'], 'On Failure', () => FOLLOW_UP_SAVE_BRANCH_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: or([
          local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE),
          local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK)
        ])
      })
    )
    .set(
      'onDurationComplete',
      groupObject(
        ['onDurationComplete'],
        'When Duration Completes',
        () => FOLLOW_UP_SAVE_BRANCH_NODE_MAP,
        {
          presentation: 'inline',
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE)
        }
      )
    )
    .set(
      'repeatTiming',
      selectSingle(
        ['repeatTiming'],
        'Repeat Timing',
        // ON_TRIGGERS_ONLY is the last option and is never a repeat timing.
        { kind: 'INLINE_OPTIONS', options: FOLLOW_UP_SAVE_TIMING_OPTIONS.slice(0, -1) },
        {
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_SAVE)
        }
      )
    )
    .set(
      'activation',
      groupObject(['activation'], 'Activation', () => ACTIVATION_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK)
      })
    )
    .set(
      'ability',
      selectSingle(
        ['ability'],
        'Ability',
        { kind: 'DATA', relationship: data.table('abilities', { selectColumns: CODE_COLUMNS }) },
        {
          requiredIf: true,
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK)
        }
      )
    )
    .set(
      'fixedDc',
      number(['fixedDc'], 'DC', {
        constraints: { minimum: 1 },
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK)
      })
    )
    .set(
      'skillId',
      selectSingle(
        ['skillId'],
        'Skill',
        {
          kind: 'DATA',
          relationship: table('skills', { selectColumns: ['id', 'label', 'description'] })
        },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK) }
      )
    )
    .set(
      'toolEquipmentId',
      selectSingle(
        ['toolEquipmentId'],
        'Required Tool',
        { kind: 'DATA', relationship: table('equipment', { selectColumns: ['id', 'label'] }) },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK) }
      )
    )
    .set(
      'actorKinds',
      selectMulti(['actorKinds'], 'Who Can Attempt', inlineOptions(FOLLOW_UP_CHECK_ACTOR_OPTIONS), {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK)
      })
    )
    .set(
      'repeatable',
      toggle(['repeatable'], 'Repeatable', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.FOLLOW_UP_CHECK)
      })
    )
    .set(
      'ruleKind',
      selectSingle(['ruleKind'], 'Movement Rule', inlineOptions(MOVEMENT_RULE_KIND_OPTIONS), {
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MOVEMENT_RULE)
      })
    )
    .set(
      'movementRuleDistance',
      groupObject(['limitDistance'], 'Distance', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.MOVEMENT_RULE),
          not(local.field(['ruleKind']).eq('STOP_CURRENT_MOVEMENT')),
          not(local.field(['ruleKind']).eq('MOVEMENT_COST_MULTIPLIER')),
          not(local.field(['ruleKind']).eq('ADD_SPEED_TO_MOVEMENT'))
        ])
      })
    )
    .set(
      'movementRuleMultiplier',
      number(['multiplier'], 'Multiplier', {
        constraints: { minimum: 0.01 },
        requiredIf: true,
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.MOVEMENT_RULE),
          local.field(['ruleKind']).eq('MOVEMENT_COST_MULTIPLIER')
        ])
      })
    )
    .set(
      'requiresZeroHitPoints',
      toggle(['requiresZeroHitPoints'], 'Requires 0 Hit Points', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.STABILIZE)
      })
    )
    .set(
      'minimum',
      number(['minimum'], 'Minimum Armor Class', {
        constraints: { minimum: 0 },
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.ARMOR_CLASS_FLOOR)
      })
    )
    .set(
      'restoreChargeId',
      text(['chargeId'], 'Charge ID', {
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.RESTORE_RESOURCE)
      })
    )
    .set(
      'restoreFloor',
      number(['floor'], 'Restore To At Least', {
        constraints: { minimum: 1 },
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.RESTORE_RESOURCE)
      })
    )
    .set(
      'restoreWhenAtOrBelow',
      number(['whenAtOrBelow'], 'When Remaining Is At Most', {
        constraints: { minimum: 0 },
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.RESTORE_RESOURCE)
      })
    )
    .set(
      'degradeSubject',
      selectSingle(
        ['subject'],
        'Whose Item',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'TARGET_ITEM', label: "The target's item" },
            { code: 'ATTACKER_WEAPON', label: 'The weapon that hit' }
          ]
        },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.DEGRADE_EQUIPMENT) }
      )
    )
    .set(
      'degradeCategory',
      selectSingle(
        ['category'],
        'Degrades',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'ARMOR', label: 'Armor' },
            { code: 'SHIELD', label: 'Shield' },
            { code: 'WEAPON', label: 'Weapon' }
          ]
        },
        { requiredIf: true, showIf: local.field(['effectKind']).eq(EFFECT_KIND.DEGRADE_EQUIPMENT) }
      )
    )
    .set(
      'degradeNonmagical',
      toggle(['nonmagical'], 'Nonmagical Only', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.DEGRADE_EQUIPMENT)
      })
    )
    .set(
      'degradeMaterials',
      selectMulti(
        ['materials'],
        'Materials (any when empty)',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'METAL', label: 'Metal' },
            { code: 'WOOD', label: 'Wood' }
          ]
        },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.DEGRADE_EQUIPMENT) }
      )
    )
    .set(
      'degradeStep',
      number(['step'], 'Penalty Per Hit', {
        constraints: { minimum: 1 },
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.DEGRADE_EQUIPMENT)
      })
    )
    .set(
      'degradeDestroyWhen',
      groupObject(['destroyWhen'], 'Destruction', () => DEGRADE_EQUIPMENT_DESTROY_WHEN_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.DEGRADE_EQUIPMENT)
      })
    )
    .set(
      'observers',
      selectSingle(
        ['observers'],
        'Hidden From',
        {
          kind: 'INLINE_OPTIONS',
          options: [{ code: 'NON_ALLIES', label: 'Creatures not on its side' }]
        },
        {
          requiredIf: true,
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.CONCEAL_FROM_OBSERVERS)
        }
      )
    )
    .set(
      'maximumCreatures',
      number(['maximumCreatures'], 'Maximum Creatures', {
        constraints: { minimum: 1 },
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPATHIC_LINK)
      })
    )
    .set(
      'excludesAbilityAtOrBelow',
      groupObject(
        ['excludesAbilityAtOrBelow'],
        'Excludes Ability Score',
        () => TELEPATHIC_LINK_ABILITY_FLOOR_NODE_MAP,
        {
          presentation: 'inline',
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPATHIC_LINK)
        }
      )
    )
    .set(
      'anyDistance',
      toggle(['anyDistance'], 'Any Distance', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPATHIC_LINK)
      })
    )
    .set(
      'crossesPlanes',
      toggle(['crossesPlanes'], 'Crosses Planes', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPATHIC_LINK)
      })
    )
    .set(
      'requiresSharedLanguage',
      toggle(['requiresSharedLanguage'], 'Requires Shared Language', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TELEPATHIC_LINK)
      })
    )
    .set(
      'minimumPlantSize',
      selectSingle(
        ['minimumPlantSize'],
        'Minimum Plant Size',
        { kind: 'DATA', relationship: table('sizes', { selectColumns: CODE_COLUMNS }) },
        {
          requiredIf: true,
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.PLANT_PORTAL)
        }
      )
    )
    .set(
      'requiresInanimatePlant',
      toggle(['requiresInanimatePlant'], 'Requires Inanimate Plant', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.PLANT_PORTAL)
      })
    )
    .set(
      'samePlaneOnly',
      toggle(['samePlaneOnly'], 'Same Plane Only', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.PLANT_PORTAL)
      })
    )
    .set(
      'destinationMustBeSeenOrTouched',
      toggle(['destinationMustBeSeenOrTouched'], 'Destination Previously Seen or Touched', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.PLANT_PORTAL)
      })
    )
    .set(
      'movementCost',
      groupObject(['movementCost'], 'Movement Cost', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.PLANT_PORTAL)
      })
    )
    .set(
      'destinationDistance',
      groupObject(['destinationDistance'], 'Destination Distance', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TREE_STRIDE)
      })
    )
    .set(
      'entryMovementCost',
      groupObject(['entryMovementCost'], 'Entry Movement Cost', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TREE_STRIDE)
      })
    )
    .set(
      'exitMovementCost',
      groupObject(['exitMovementCost'], 'Exit Movement Cost', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TREE_STRIDE)
      })
    )
    .set(
      'sameTreeKind',
      toggle(['sameTreeKind'], 'Same Tree Kind', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TREE_STRIDE)
      })
    )
    .set(
      'livingTreesOnly',
      toggle(['livingTreesOnly'], 'Living Trees Only', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TREE_STRIDE)
      })
    )
    .set(
      'minimumTreeSizeRelativeToTraveler',
      toggle(['minimumTreeSizeRelativeToTraveler'], 'Tree At Least Traveler Size', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TREE_STRIDE)
      })
    )
    .set(
      'usesPerRound',
      number(['usesPerRound'], 'Uses per Round', {
        constraints: { minimum: 1 },
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TREE_STRIDE)
      })
    )
    .set(
      'mustEndTurnOutside',
      toggle(['mustEndTurnOutside'], 'Must End Turn Outside Tree', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.TREE_STRIDE)
      })
    )
    .set(
      'closedRuleKind',
      selectSingle(['ruleKind'], 'Closed Rule', inlineOptions(CLOSED_RULE_KIND_OPTIONS), {
        requiredIf: true,
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.CLOSED_RULE)
      })
    )
    .set(
      'actionEconomyRuleKind',
      selectSingle(
        ['ruleKind'],
        'Action Economy Rule',
        inlineOptions(ACTION_ECONOMY_RULE_KIND_OPTIONS),
        {
          requiredIf: true,
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.ACTION_ECONOMY_RULE)
        }
      )
    )
    .set(
      'maximum',
      number(['maximum'], 'Maximum', {
        constraints: { minimum: 0 },
        requiredIf: true,
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.ACTION_ECONOMY_RULE),
          not(local.field(['ruleKind']).eq('LOSE_ACTION'))
        ])
      })
    )
    .set(
      'statBlock',
      groupObject(['statBlock'], 'Summon Stat Block', () => SUMMON_STAT_BLOCK_NODE_MAP, {
        presentation: 'inline',
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST),
          local.field(['manifestKind']).eq(MANIFEST_KIND.SUMMON)
        ])
      })
    )
    .set(
      'behaviors',
      groupArray(['behaviors'], 'Behaviors', () => MANIFEST_BEHAVIOR_NODE_MAP, {
        presentation: 'inline',
        showIf: manifestsOther
      })
    )
    .set(
      'components',
      groupArray(['components'], 'Components', () => MANIFEST_COMPONENT_NODE_MAP, {
        presentation: 'summary',
        showIf: manifestsOther
      })
    )
    .set(
      'componentsMustResolveInOrder',
      toggle(['componentsMustResolveInOrder'], 'Resolve Components in Order', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'attachmentKind',
      selectSingle(
        ['attachmentKind'],
        'Attachment',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'SOURCE', label: 'Source' },
            { code: 'PRIMARY_TARGET', label: 'Primary Target' },
            { code: 'PLACED_SPACE', label: 'Placed Space' },
            { code: 'TOUCHED_OBJECT', label: 'Touched Object' }
          ]
        },
        {
          requiredIf: local.field(['manifestKind']).eq(MANIFEST_KIND.ZONE),
          showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
        }
      )
    )
    .set(
      'camouflage',
      groupObject(['camouflage'], 'Camouflage', () => MANIFEST_CAMOUFLAGE_NODE_MAP, {
        presentation: 'inline',
        showIf: and([
          local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST),
          local.field(['manifestKind']).eq(MANIFEST_KIND.ZONE)
        ])
      })
    )
    .set(
      'destructionMustResolveInOrder',
      toggle(['destructionMustResolveInOrder'], 'Destroy Components in Order', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'destroyedComponentsRemainDestroyed',
      toggle(['destroyedComponentsRemainDestroyed'], 'Destroyed Components Stay Destroyed', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'placementMustBeUnoccupied',
      toggle(['placementMustBeUnoccupied'], 'Placement Must Be Unoccupied', {
        showIf: manifestsOther
      })
    )
    .set(
      'invalidPlacementConsumesInvocation',
      toggle(['invalidPlacementConsumesInvocation'], 'Invalid Placement Consumes Use', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'designatedCreatureImmunity',
      toggle(['designatedCreatureImmunity'], 'Caster-Designated Creature Immunity', {
        showIf: manifestsOther
      })
    )
    .set(
      'maximumTargetSize',
      selectSingle(
        ['maximumTargetSize'],
        'Maximum Target Size',
        { kind: 'DATA', relationship: table('sizes', { selectColumns: CODE_COLUMNS }) },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST) }
      )
    )
    .set(
      'excludesFormlessTargets',
      toggle(['excludesFormlessTargets'], 'Excludes Formless Targets', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'light',
      groupObject(['light'], 'Light', () => MANIFEST_LIGHT_NODE_MAP, {
        presentation: 'inline',
        showIf: manifestsOther
      })
    )
    .set(
      'hollow',
      toggle(['hollow'], 'Hollow', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'wallThickness',
      groupObject(['wallThickness'], 'Wall Thickness', () => MEASUREMENT_NODE_MAP, {
        presentation: 'inline',
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'spreadsAroundCorners',
      toggle(['spreadsAroundCorners'], 'Spreads Around Corners', {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'obscurementKind',
      selectSingle(
        ['obscurementKind'],
        'Obscurement',
        {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'LIGHT', label: 'Lightly Obscured' },
            { code: 'HEAVY', label: 'Heavily Obscured' }
          ]
        },
        { showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST) }
      )
    )
    .set(
      'properties',
      selectMulti(['properties'], 'Properties', inlineOptions(MANIFEST_PROPERTY_OPTIONS), {
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'proximityRule',
      groupObject(['proximityRule'], 'Proximity Rule', () => MANIFEST_PROXIMITY_RULE_NODE_MAP, {
        presentation: 'inline',
        showIf: local.field(['effectKind']).eq(EFFECT_KIND.MANIFEST)
      })
    )
    .set(
      'destructionCriteria',
      groupArray(
        ['destructionCriteria'],
        'Destruction Criteria',
        () => MANIFEST_DESTRUCTION_CRITERION_NODE_MAP,
        {
          presentation: 'summary',
          showIf: manifestsOther
        }
      )
    )
    .set(
      'suppressionImmunities',
      selectMulti(
        ['suppressionImmunities'],
        'Suppression Immunities',
        inlineOptions(MANIFEST_SUPPRESSION_IMMUNITY_OPTIONS),
        { showIf: manifestsOther }
      )
    )
}

const FOLLOW_UP_SAVE_ATTEMPTS_NODE_MAP: NodeMap<FollowUpSaveAttemptsNode> =
  followUpSaveAttempts.define('followUpSaveAttempts', ({ map, nodes, cond }) => {
    const { selectSingle, number, toggle } = nodes
    const local = cond.local()

    map
      .set(
        'kind',
        selectSingle(['kind'], 'Attempts', inlineOptions(FOLLOW_UP_SAVE_ATTEMPT_KIND_OPTIONS), {
          requiredIf: true
        })
      )
      .set(
        'successesToEnd',
        number(['successesToEnd'], 'Successes to End', {
          constraints: { minimum: 1 },
          requiredIf: true,
          showIf: local.field(['kind']).eq('THRESHOLDS')
        })
      )
      .set(
        'failuresToResolve',
        number(['failuresToResolve'], 'Failures to Resolve', {
          constraints: { minimum: 1 },
          requiredIf: true,
          showIf: local.field(['kind']).eq('THRESHOLDS')
        })
      )
      .set(
        'consecutive',
        toggle(['consecutive'], 'Must Be Consecutive', {
          showIf: local.field(['kind']).eq('THRESHOLDS')
        })
      )
      .set(
        'repeatOnFailure',
        toggle(['repeatOnFailure'], 'Repeat On Failure', {
          showIf: local.field(['kind']).eq('ONCE')
        })
      )
  })

const FOLLOW_UP_SAVE_BRANCH_NODE_MAP: NodeMap<FollowUpSaveBranchNode> = followUpSaveBranch.define(
  'followUpSaveBranch',
  ({ map, nodes, cond }) => {
    const { selectSingle, toggle, groupArray, groupObject } = nodes
    const local = cond.local()

    map
      .set(
        'kind',
        selectSingle(['kind'], 'Result', inlineOptions(FOLLOW_UP_SAVE_BRANCH_KIND_OPTIONS), {
          requiredIf: true
        })
      )
      .set(
        'endCurrent',
        toggle(['endCurrent'], 'End Current Result', {
          showIf: local.field(['kind']).eq('OUTCOMES')
        })
      )
      .set(
        'resultKind',
        selectSingle(['resultKind'], 'Outcome Type', inlineOptions(PATH_RESULT_KIND_OPTIONS), {
          requiredIf: true,
          showIf: local.field(['kind']).eq('OUTCOMES')
        })
      )
      .set(
        'gate',
        groupObject(['gate'], 'Gate', () => RESULT_BLOCK_GATE_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['kind']).eq('OUTCOMES')
        })
      )
      .set(
        'outcomes',
        groupArray(['outcomes'], 'Outcomes', () => OUTCOME_NODE_MAP, {
          presentation: 'summary',
          showIf: local.field(['kind']).eq('OUTCOMES')
        })
      )
  }
)

const OUTCOME_NODE_MAP: NodeMap<OutcomeNode> = outcome.define(
  'outcome',
  ({ map, nodes, cond, logic, data }) => {
    registerOutcomeFields(map, nodes, cond, logic, data, EFFECT_KIND_OPTIONS)
  },
  {
    collection: {
      rowSummary: 'outcome'
    }
  }
)

const NON_MANIFEST_OUTCOME_NODE_MAP: NodeMap<NonManifestOutcomeNode> = nonManifestOutcome.define(
  'nonManifestOutcome',
  ({ map, nodes, cond, logic, data }) => {
    registerOutcomeFields(
      map as unknown as OutcomeNodeMapApi['map'],
      nodes as unknown as OutcomeNodeMapApi['nodes'],
      cond as unknown as OutcomeNodeMapApi['cond'],
      logic as unknown as OutcomeNodeMapApi['logic'],
      data as unknown as OutcomeNodeMapApi['data'],
      NON_MANIFEST_EFFECT_KIND_OPTIONS
    )
  },
  {
    collection: {
      rowSummary: 'outcome'
    }
  }
)

const RESULT_BLOCK_NODE_MAP: NodeMap<ResultBlockAuthored> = resultBlock.define(
  'resultBlock',
  ({ map, nodes, data }) => {
    const { table } = data
    const { text, selectSingle, selectMulti, groupObject, groupArray } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'resultKind',
        selectSingle(['resultKind'], 'Outcome Type', inlineOptions(PATH_RESULT_KIND_OPTIONS), {
          requiredIf: true
        })
      )
      .set(
        'duration',
        groupObject(['duration'], 'Duration', () => DURATION_NODE_MAP, { presentation: 'inline' })
      )
      .set(
        'lifecycle',
        groupObject(['lifecycle'], 'Lifecycle', () => PATH_LIFECYCLE_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'failureMarginRider',
        groupObject(
          ['failureMarginRider'],
          'Failure Margin Rider',
          () => FOLLOW_UP_SAVE_FAILURE_MARGIN_RIDER_NODE_MAP,
          { presentation: 'inline' }
        )
      )
      .set(
        'gate',
        groupObject(['gate'], 'Gate', () => RESULT_BLOCK_GATE_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'suppressedByDamageTypeIds',
        selectMulti(['suppressedByDamageTypeIds'], 'Suppressed By Damage Types', {
          kind: 'DATA',
          relationship: table('damage_types', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set(
        'outcomes',
        groupArray(['outcomes'], 'Outcomes', () => OUTCOME_NODE_MAP, {
          presentation: 'summary'
        })
      )
  }
)

const NON_MANIFEST_RESULT_BLOCK_NODE_MAP: NodeMap<ResultBlockAuthored<NonManifestOutcomeAuthored>> =
  nonManifestResultBlock.define('nonManifestResultBlock', ({ map, nodes, data }) => {
    const { table } = data
    const { text, selectSingle, selectMulti, groupObject, groupArray } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'resultKind',
        selectSingle(['resultKind'], 'Outcome Type', inlineOptions(PATH_RESULT_KIND_OPTIONS), {
          requiredIf: true
        })
      )
      .set(
        'duration',
        groupObject(['duration'], 'Duration', () => DURATION_NODE_MAP, { presentation: 'inline' })
      )
      .set(
        'lifecycle',
        groupObject(['lifecycle'], 'Lifecycle', () => PATH_LIFECYCLE_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'failureMarginRider',
        groupObject(
          ['failureMarginRider'],
          'Failure Margin Rider',
          () => FOLLOW_UP_SAVE_FAILURE_MARGIN_RIDER_NODE_MAP,
          { presentation: 'inline' }
        )
      )
      .set(
        'gate',
        groupObject(['gate'], 'Gate', () => RESULT_BLOCK_GATE_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'suppressedByDamageTypeIds',
        selectMulti(['suppressedByDamageTypeIds'], 'Suppressed By Damage Types', {
          kind: 'DATA',
          relationship: table('damage_types', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set(
        'outcomes',
        groupArray(['outcomes'], 'Outcomes', () => NON_MANIFEST_OUTCOME_NODE_MAP, {
          presentation: 'summary'
        })
      )
  })

const HIT_POINT_TIER_ROW_NODE_MAP: NodeMap<PathHitPointTierRowAuthored> = hitPointTierRow.define(
  'hitPointTierRow',
  ({ map, nodes }) => {
    const { text, number, groupObject } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order', { requiredIf: true }))
      .set(
        'atMost',
        number(['atMost'], 'Hit Points At Most', { constraints: { minimum: 1 }, requiredIf: true })
      )
      .set(
        'resultBlock',
        groupObject(['resultBlock'], 'Result', () => RESULT_BLOCK_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
  }
)

const NON_MANIFEST_HIT_POINT_TIER_ROW_NODE_MAP: NodeMap<
  PathHitPointTierRowAuthored<NonManifestOutcomeAuthored>
> = nonManifestHitPointTierRow.define('nonManifestHitPointTierRow', ({ map, nodes }) => {
  const { text, number, groupObject } = nodes

  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order', { requiredIf: true }))
    .set(
      'atMost',
      number(['atMost'], 'Hit Points At Most', { constraints: { minimum: 1 }, requiredIf: true })
    )
    .set(
      'resultBlock',
      groupObject(['resultBlock'], 'Result', () => NON_MANIFEST_RESULT_BLOCK_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true
      })
    )
})

const CHOICE_OPTION_NODE_MAP: NodeMap<PathChoiceOptionAuthored> = choiceOption.define(
  'choiceOption',
  ({ map, nodes, data }) => {
    const { text, richText, number, selectSingle, groupObject } = nodes
    const { table } = data

    map
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order', { requiredIf: true }))
      .set('label', text(['label'], 'Label', { requiredIf: true }))
      .set('description', richText(['description'], 'Description', { requiredIf: true }))
      .set(
        'initiatorCheckInfluence',
        selectSingle(['initiatorCheckInfluence'], 'Initiator check influence', {
          kind: 'DATA',
          relationship: table('roll_influences', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set(
        'requiresOptionalRule',
        groupObject(
          ['requiresOptionalRule'],
          'Requires Optional Rule',
          () => CHOICE_OPTION_REQUIRED_RULE_NODE_MAP,
          { presentation: 'inline' }
        )
      )
      .set(
        'resultBlock',
        groupObject(['resultBlock'], 'Result', () => RESULT_BLOCK_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true
        })
      )
  }
)

const NON_MANIFEST_CHOICE_OPTION_NODE_MAP: NodeMap<
  PathChoiceOptionAuthored<NonManifestOutcomeAuthored>
> = nonManifestChoiceOption.define('nonManifestChoiceOption', ({ map, nodes, data }) => {
  const { text, richText, number, selectSingle, groupObject } = nodes
  const { table } = data

  map
    .set('id', text(['id'], 'ID'))
    .set('order', number(['order'], 'Order', { requiredIf: true }))
    .set('label', text(['label'], 'Label', { requiredIf: true }))
    .set('description', richText(['description'], 'Description', { requiredIf: true }))
    .set(
      'initiatorCheckInfluence',
      selectSingle(['initiatorCheckInfluence'], 'Initiator check influence', {
        kind: 'DATA',
        relationship: table('roll_influences', { selectColumns: ['id', 'label', 'description'] })
      })
    )
    .set(
      'requiresOptionalRule',
      groupObject(
        ['requiresOptionalRule'],
        'Requires Optional Rule',
        () => CHOICE_OPTION_REQUIRED_RULE_NODE_MAP,
        { presentation: 'inline' }
      )
    )
    .set(
      'resultBlock',
      groupObject(['resultBlock'], 'Result', () => NON_MANIFEST_RESULT_BLOCK_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true
      })
    )
})

const ROLL_TABLE_REROLL_VALUE_NODE_MAP: NodeMap<RollTableRerollValueNode> =
  rollTableRerollValue.define('rollTableRerollValue', ({ map, nodes }) => {
    const { text, number } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order', { requiredIf: true }))
      .set('value', number(['value'], 'Reroll Value', { requiredIf: true }))
  })

const ROLL_TABLE_REPEAT_NODE_MAP: NodeMap<RollTableRepeatNode> = rollTableRepeat.define(
  'rollTableRepeat',
  ({ map, nodes }) => {
    const { number, groupArray } = nodes

    map
      .set(
        'count',
        number(['count'], 'Repeat Count', {
          constraints: { minimum: 1, maximum: 100 },
          requiredIf: true
        })
      )
      .set(
        'rerollValues',
        groupArray(['rerollValues'], 'Reroll Values', () => ROLL_TABLE_REROLL_VALUE_NODE_MAP, {
          presentation: 'inline'
        })
      )
  }
)

const ROLL_TABLE_ROW_NODE_MAP: NodeMap<PathRollTableRowAuthored> = rollRow.define(
  'rollTableRow',
  ({ map, nodes, cond }) => {
    const { text, number, selectSingle, groupObject } = nodes
    const local = cond.local()
    const parent = cond.parent<{ rollTableKind: 'RANGE' | 'EXACT' }>()

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'order',
        number(['order'], 'Order', {
          requiredIf: true
        })
      )
      .set(
        'resolutionKind',
        selectSingle(
          ['resolutionKind'],
          'Resolution',
          inlineOptions(ROLL_TABLE_ROW_RESOLUTION_OPTIONS),
          { requiredIf: true }
        )
      )
      .set(
        'rollRangeMin',
        number(['rollRange', 0], 'Roll Min', {
          requiredIf: true,
          showIf: parent.field(['rollTableKind']).eq('RANGE')
        })
      )
      .set(
        'rollRangeMax',
        number(['rollRange', 1], 'Roll Max', {
          requiredIf: true,
          showIf: parent.field(['rollTableKind']).eq('RANGE')
        })
      )
      .set(
        'rollValue',
        number(['rollValue'], 'Roll Value', {
          requiredIf: true,
          showIf: parent.field(['rollTableKind']).eq('EXACT')
        })
      )
      .set(
        'resultBlock',
        groupObject(['resultBlock'], 'Result', () => RESULT_BLOCK_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true,
          showIf: local.field(['resolutionKind']).eq('RESULT')
        })
      )
      .set(
        'repeat',
        groupObject(['repeat'], 'Repeat Table', () => ROLL_TABLE_REPEAT_NODE_MAP, {
          presentation: 'inline',
          requiredIf: true,
          showIf: local.field(['resolutionKind']).eq('REPEAT_TABLE')
        })
      )
  }
)

const NON_MANIFEST_ROLL_TABLE_ROW_NODE_MAP: NodeMap<
  PathRollTableRowAuthored<NonManifestOutcomeAuthored>
> = nonManifestRollRow.define('nonManifestRollTableRow', ({ map, nodes, cond }) => {
  const { text, number, selectSingle, groupObject } = nodes
  const local = cond.local()
  const parent = cond.parent<{ rollTableKind: 'RANGE' | 'EXACT' }>()

  map
    .set('id', text(['id'], 'ID'))
    .set(
      'order',
      number(['order'], 'Order', {
        requiredIf: true
      })
    )
    .set(
      'resolutionKind',
      selectSingle(
        ['resolutionKind'],
        'Resolution',
        inlineOptions(ROLL_TABLE_ROW_RESOLUTION_OPTIONS),
        { requiredIf: true }
      )
    )
    .set(
      'rollRangeMin',
      number(['rollRange', 0], 'Roll Min', {
        requiredIf: true,
        showIf: parent.field(['rollTableKind']).eq('RANGE')
      })
    )
    .set(
      'rollRangeMax',
      number(['rollRange', 1], 'Roll Max', {
        requiredIf: true,
        showIf: parent.field(['rollTableKind']).eq('RANGE')
      })
    )
    .set(
      'rollValue',
      number(['rollValue'], 'Roll Value', {
        requiredIf: true,
        showIf: parent.field(['rollTableKind']).eq('EXACT')
      })
    )
    .set(
      'resultBlock',
      groupObject(['resultBlock'], 'Result', () => NON_MANIFEST_RESULT_BLOCK_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: local.field(['resolutionKind']).eq('RESULT')
      })
    )
    .set(
      'repeat',
      groupObject(['repeat'], 'Repeat Table', () => ROLL_TABLE_REPEAT_NODE_MAP, {
        presentation: 'inline',
        requiredIf: true,
        showIf: local.field(['resolutionKind']).eq('REPEAT_TABLE')
      })
    )
})

const PATH_CHOSEN_ITEM_NODE_MAP: NodeMap<PathChosenItemAuthored> = pathChosenItem.define(
  'pathChosenItem',
  ({ map, nodes, data }) => {
    const { selectSingle, selectMulti } = nodes
    const { table } = data

    map
      .set(
        'category',
        selectSingle(['category'], 'Category', inlineOptions(EQUIPMENT_CATEGORY_OPTIONS))
      )
      .set(
        'requiredProperties',
        selectMulti(
          ['requiredProperties'],
          'Required Properties',
          inlineOptions(EQUIPMENT_PROPERTY_OPTIONS)
        )
      )
      .set(
        'excludedProperties',
        selectMulti(
          ['excludedProperties'],
          'Excluded Properties',
          inlineOptions(EQUIPMENT_PROPERTY_OPTIONS)
        )
      )
      .set(
        'equipmentIds',
        selectMulti(['equipmentIds'], 'Equipment', {
          kind: 'DATA',
          relationship: table('equipment', { selectColumns: ['id', 'label'] })
        })
      )
  }
)

export const PATH_NODE_MAP: NodeMap<EffectPathAuthored> = effectPath.define(
  'effectPath',
  ({ map, nodes, cond }) => {
    const { text, number, selectSingle, groupObject, groupArray } = nodes
    const local = cond.local()

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'order',
        number(['order'], 'Order', {
          requiredIf: true
        })
      )
      .set(
        'pathCode',
        selectSingle(['pathCode'], 'Outcome Path', inlineOptions(PATH_CODE_OPTIONS), {
          requiredIf: true
        })
      )
      .set(
        'groupType',
        selectSingle(['groupType'], 'Outcome Group', inlineOptions(PATH_GROUP_TYPE_OPTIONS), {
          requiredIf: true
        })
      )
      .set(
        'selectionKind',
        selectSingle(
          ['selectionKind'],
          'Selection Model',
          inlineOptions(PATH_SELECTION_KIND_OPTIONS),
          {
            requiredIf: true
          }
        )
      )
      .set(
        'originKind',
        selectSingle(['originKind'], 'Starts From', inlineOptions(PATH_ORIGIN_KIND_OPTIONS))
      )
      .set(
        'restrictions',
        groupObject(['restrictions'], 'Restrictions', () => FACET_NODE_MAP, {
          presentation: 'inline',
          authoring: {
            actions: [
              {
                type: 'collection.add',
                label: 'Add',
                presentation: AUTHORING_ACTION_PRESENTATIONS.button
              }
            ]
          }
        })
      )
      .set('usage', selectSingle(['usage'], 'Usage Limit', inlineOptions(PATH_USAGE_OPTIONS)))
      .set(
        'rangeOverride',
        groupObject(['rangeOverride'], 'Range Override', () => RANGE_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'targetingOverride',
        groupObject(['targetingOverride'], 'Targeting Override', () => TARGETING_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'chosenItem',
        groupObject(['chosenItem'], 'Chosen Item', () => PATH_CHOSEN_ITEM_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'resultBlock',
        groupObject(['resultBlock'], 'Result', () => RESULT_BLOCK_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['selectionKind']).eq('FIXED')
        })
      )
      .set(
        'dieConfig',
        text(['dieConfig'], 'Die Configuration', {
          requiredIf: true,
          showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
        })
      )
      .set(
        'rollTableKind',
        selectSingle(
          ['rollTableKind'],
          'Match Rolls By',
          inlineOptions(PATH_ROLL_TABLE_KIND_OPTIONS),
          {
            requiredIf: true,
            showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
          }
        )
      )
      .set(
        'options',
        groupArray(['options'], 'Options', () => CHOICE_OPTION_NODE_MAP, {
          presentation: 'branch',
          showIf: local.field(['selectionKind']).eq('CHOICE')
        })
      )
      .set(
        'rows',
        groupArray(['rows'], 'Rows', () => ROLL_TABLE_ROW_NODE_MAP, {
          presentation: 'table',
          showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
        })
      )
      .set(
        'hitPointTierRows',
        groupArray(['rows'], 'Tiers', () => HIT_POINT_TIER_ROW_NODE_MAP, {
          presentation: 'table',
          showIf: local.field(['selectionKind']).eq('HIT_POINT_TIERS')
        })
      )
  },
  {
    collection: {
      rowSummary: 'effect-path'
    }
  }
)

export const MANIFEST_BEHAVIOR_PATH_NODE_MAP: NodeMap<
  EffectPathAuthored<Trigger, NonManifestOutcomeAuthored>
> = manifestNestedPath.define(
  'manifestBehaviorPath',
  ({ map, nodes, cond }) => {
    const { text, number, selectSingle, groupObject, groupArray } = nodes
    const local = cond.local()

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'order',
        number(['order'], 'Order', {
          requiredIf: true
        })
      )
      .set(
        'pathCode',
        selectSingle(['pathCode'], 'Behavior Path', inlineOptions(PATH_CODE_OPTIONS), {
          requiredIf: true
        })
      )
      .set(
        'groupType',
        selectSingle(['groupType'], 'Outcome Group', inlineOptions(PATH_GROUP_TYPE_OPTIONS), {
          requiredIf: true
        })
      )
      .set(
        'selectionKind',
        selectSingle(
          ['selectionKind'],
          'Selection Model',
          inlineOptions(PATH_SELECTION_KIND_OPTIONS),
          {
            requiredIf: true
          }
        )
      )
      .set(
        'originKind',
        selectSingle(['originKind'], 'Starts From', inlineOptions(PATH_ORIGIN_KIND_OPTIONS))
      )
      .set(
        'restrictions',
        groupObject(['restrictions'], 'Restrictions', () => FACET_NODE_MAP, {
          presentation: 'inline',
          authoring: {
            actions: [
              {
                type: 'collection.add',
                label: 'Add',
                presentation: AUTHORING_ACTION_PRESENTATIONS.button
              }
            ]
          }
        })
      )
      .set('usage', selectSingle(['usage'], 'Usage Limit', inlineOptions(PATH_USAGE_OPTIONS)))
      .set(
        'rangeOverride',
        groupObject(['rangeOverride'], 'Range Override', () => RANGE_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'targetingOverride',
        groupObject(['targetingOverride'], 'Targeting Override', () => TARGETING_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'resultBlock',
        groupObject(['resultBlock'], 'Result', () => NON_MANIFEST_RESULT_BLOCK_NODE_MAP, {
          presentation: 'inline',
          showIf: local.field(['selectionKind']).eq('FIXED')
        })
      )
      .set(
        'dieConfig',
        text(['dieConfig'], 'Die Configuration', {
          requiredIf: true,
          showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
        })
      )
      .set(
        'rollTableKind',
        selectSingle(
          ['rollTableKind'],
          'Match Rolls By',
          inlineOptions(PATH_ROLL_TABLE_KIND_OPTIONS),
          {
            requiredIf: true,
            showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
          }
        )
      )
      .set(
        'options',
        groupArray(['options'], 'Options', () => NON_MANIFEST_CHOICE_OPTION_NODE_MAP, {
          presentation: 'branch',
          showIf: local.field(['selectionKind']).eq('CHOICE')
        })
      )
      .set(
        'rows',
        groupArray(['rows'], 'Rows', () => NON_MANIFEST_ROLL_TABLE_ROW_NODE_MAP, {
          presentation: 'table',
          showIf: local.field(['selectionKind']).eq('ROLL_TABLE')
        })
      )
      .set(
        'hitPointTierRows',
        groupArray(['rows'], 'Tiers', () => NON_MANIFEST_HIT_POINT_TIER_ROW_NODE_MAP, {
          presentation: 'table',
          showIf: local.field(['selectionKind']).eq('HIT_POINT_TIERS')
        })
      )
  },
  {
    collection: {
      rowSummary: 'effect-path'
    }
  }
)

export const MANIFEST_BEHAVIOR_NODE_MAP: NodeMap<ManifestBehaviorAuthored> =
  manifestBehavior.define('manifestBehavior', ({ map, nodes }) => {
    const { text, number, groupObject, groupArray } = nodes

    map
      .set('id', text(['id'], 'ID'))
      .set('order', number(['order'], 'Order'))
      .set(
        'invocation',
        groupObject(['invocation'], 'How It Starts', () => INVOCATION_NODE_MAP, {
          presentation: 'inline'
        })
      )
      .set(
        'paths',
        groupArray(['paths'], 'Outcome Paths', () => MANIFEST_BEHAVIOR_PATH_NODE_MAP, {
          presentation: 'inline'
        })
      )
  })
