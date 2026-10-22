import type {
  FollowUpSaveRepeatAttemptGateAuthored,
  FollowUpSaveRepeatPerceptionAuthored,
  FollowUpSaveRepeatRollInfluenceAuthored,
  FollowUpSaveRepeatTriggerAuthored
} from '#authored'
import { buildNodeMap } from '#utils'

const followUpSaveRepeatRollInfluence = buildNodeMap<FollowUpSaveRepeatRollInfluenceAuthored>()
const followUpSaveRepeatAttemptGate = buildNodeMap<FollowUpSaveRepeatAttemptGateAuthored>()
const followUpSaveRepeatPerception = buildNodeMap<FollowUpSaveRepeatPerceptionAuthored>()
const followUpSaveRepeatTrigger = buildNodeMap<FollowUpSaveRepeatTriggerAuthored>()

const FOLLOW_UP_SAVE_REPEAT_PERCEPTION_NODE_MAP = followUpSaveRepeatPerception.define(
  'followUpSaveRepeatPerception',
  ({ map, nodes }) => {
    const { selectSingle } = nodes
    map
      .set(
        'kind',
        selectSingle(['kind'], 'Condition', {
          kind: 'INLINE_OPTIONS',
          options: [{ code: 'PERCEPTION', label: 'Perception' }]
        })
      )
      .set(
        'observer',
        selectSingle(['observer'], 'Observer', {
          kind: 'INLINE_OPTIONS',
          options: [{ code: 'TARGET', label: 'Target' }]
        })
      )
      .set(
        'subject',
        selectSingle(['subject'], 'Subject', {
          kind: 'INLINE_OPTIONS',
          options: [{ code: 'SOURCE', label: 'Source' }]
        })
      )
      .set(
        'requirement',
        selectSingle(['requirement'], 'Requirement', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'DETECT', label: 'Detect' },
            { code: 'LOCATE', label: 'Locate' },
            { code: 'PRECISE', label: 'Precisely Locate' },
            { code: 'SEE', label: 'See' }
          ]
        })
      )
  }
)

export const FOLLOW_UP_SAVE_REPEAT_ROLL_INFLUENCE_NODE_MAP = followUpSaveRepeatRollInfluence.define(
  'followUpSaveRepeatRollInfluence',
  ({ map, nodes }) => {
    const { selectSingle, groupObject } = nodes
    map
      .set(
        'influence',
        selectSingle(['influence'], 'Influence', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'ADVANTAGE', label: 'Advantage' },
            { code: 'DISADVANTAGE', label: 'Disadvantage' }
          ]
        })
      )
      .set(
        'when',
        groupObject(['when'], 'When', () => FOLLOW_UP_SAVE_REPEAT_PERCEPTION_NODE_MAP, {
          presentation: 'inline'
        })
      )
  }
)

export const FOLLOW_UP_SAVE_REPEAT_TRIGGER_NODE_MAP = followUpSaveRepeatTrigger.define(
  'followUpSaveRepeatTrigger',
  ({ map, nodes, data }) => {
    const { selectSingle, selectMulti } = nodes
    const { table } = data
    map
      .set(
        'kind',
        selectSingle(['kind'], 'Repeats When', {
          kind: 'INLINE_OPTIONS',
          options: [{ code: 'DAMAGE_TAKEN', label: 'The holder takes damage' }]
        })
      )
      .set(
        'by',
        selectSingle(['by'], 'Damage From', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'ANYONE', label: 'Anyone' },
            { code: 'SOURCE_SIDE', label: 'The effect source or its allies' }
          ]
        })
      )
      .set(
        'damageTypeIds',
        selectMulti(['damageTypeIds'], 'Damage Types (any when empty)', {
          kind: 'DATA',
          relationship: table('damage_types', { selectColumns: ['id', 'label', 'description'] })
        })
      )
      .set(
        'rollInfluence',
        selectSingle(['rollInfluence'], 'Roll Influence', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'ADVANTAGE', label: 'Advantage' },
            { code: 'DISADVANTAGE', label: 'Disadvantage' }
          ]
        })
      )
  }
)

export const FOLLOW_UP_SAVE_REPEAT_ATTEMPT_GATE_NODE_MAP = followUpSaveRepeatAttemptGate.define(
  'followUpSaveRepeatAttemptGate',
  ({ map, nodes }) => {
    const { selectSingle, groupObject } = nodes
    map
      .set(
        'allow',
        selectSingle(['allow'], 'Attempt', {
          kind: 'INLINE_OPTIONS',
          options: [
            { code: 'WHEN_MET', label: 'Only When Met' },
            { code: 'WHEN_UNMET', label: 'Only When Unmet' }
          ]
        })
      )
      .set(
        'when',
        groupObject(['when'], 'When', () => FOLLOW_UP_SAVE_REPEAT_PERCEPTION_NODE_MAP, {
          presentation: 'inline'
        })
      )
  }
)
