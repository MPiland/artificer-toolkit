import {
  contestCheckD20Request,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { InitiativeDeclarationAdjudicationFieldDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import type { RollModeKeep } from '@artificer-toolkit/schema/shared/systemCoreCode'
import type { D20AddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import type { EncounterRuleRollTriggerDto } from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  concentrationPromptText,
  concentrationTriggerText,
  deathSavePromptText
} from '../ruleCheckCopy'

export type InitiativeDeclarationAdjudicationValues = Partial<
  Record<InitiativeDeclarationAdjudicationFieldDto['key'], string | string[] | number | null>
>

export function adjudicationSelectionValues(
  fields: readonly InitiativeDeclarationAdjudicationFieldDto[],
  values: InitiativeDeclarationAdjudicationValues
): Record<string, string | string[] | number | null> {
  return Object.fromEntries(
    fields.map((field) => [
      field.key,
      values[field.key] ?? (field.kind === 'MULTI_SELECT' ? [] : null)
    ])
  )
}

/**
 * The face a d20 row keeps, matching the server's selection: the higher for HIGHER, the lower for
 * LOWER (the first on a tie), otherwise the only face.
 */
export function keptFaceIndex(
  keep: RollModeKeep,
  faces: readonly (number | string)[]
): number | null {
  if (keep === 'FIRST') return 0
  const [first, second] = faces
  if (typeof first !== 'number' || typeof second !== 'number') return null
  return (keep === 'HIGHER' ? second > first : second < first) ? 1 : 0
}

/**
 * One entry per added die a d20 row rolls (D156), in the request's order, labelled "+d4 Bless" or
 * "−d4 Bane" with the die's size. A source adding several dice repeats once per die.
 */
export function addedDieEntries(
  addedDice: readonly D20AddedDieDto[]
): { label: string; faces: number }[] {
  return addedDice.flatMap(({ count, faces, sign, label }) =>
    Array.from({ length: count }, () => ({
      label: `${sign === 'ADD' ? '+' : '−'}d${faces} ${label}`,
      faces
    }))
  )
}

type MovementPassageOption = Extract<
  PendingEncounterRuleOccurrenceSummaryDto,
  { kind: 'MOVEMENT_PASSAGE_CHOICE' }
>['options'][number]

const MOVEMENT_PASSAGE_RULE_LABELS: Record<MovementPassageOption['ruleKind'], string> = {
  OVERRUN: 'Overrun',
  TUMBLE: 'Tumble',
  CLIMB_ONTO_LARGER_CREATURE: 'Climb onto'
}

/** "Climb onto · Strength (Athletics) · Action": the rule, the mover's check and its cost. */
export function movementPassageOptionLabel(option: MovementPassageOption): string {
  const economy = option.economy === 'ACTION' ? 'Action' : 'Bonus action'
  return `${MOVEMENT_PASSAGE_RULE_LABELS[option.ruleKind]} · ${option.initiatorCheckLabel} · ${economy}`
}

export function decisionTitle(kind: PendingEncounterRuleOccurrenceSummaryDto['kind']): string {
  if (kind === 'D20_EVIDENCE') return 'Roll required'
  if (kind === 'MOVEMENT_REACTION') return 'Reaction available'
  if (kind === 'MOVEMENT_PASSAGE_CHOICE') return 'Passage choice'
  if (kind === 'LEGENDARY_RESISTANCE_CHOICE') return 'Legendary Resistance'
  if (kind === 'REACTION_CHOICE') return 'Reaction available'
  if (kind === 'ON_HIT_CHOICE') return 'Add an on-hit effect'
  if (kind === 'ATTACK_RETARGET_CHOICE') return 'Choose a new target'
  if (kind === 'FORCED_MOVEMENT_DESTINATION') return 'Forced movement'
  if (kind === 'LEGENDARY_ACTION_CHOICE') return 'Legendary Action'
  if (kind === 'INITIATIVE_EVIDENCE') return 'Initiative roll required'
  if (kind === 'INITIATIVE_DECLARATION') return 'Initiative declaration required'
  if (kind === 'RECHARGE_EVIDENCE') return 'Recharge roll required'
  if (kind === 'ACTION_OUTCOME_EVIDENCE') return 'Action outcome required'
  if (kind === 'AREA_SAVES') return 'Area saves'
  if (kind === 'CONTEST_CHECK') return 'Contest check'
  if (kind === 'D20_WINDOW') return 'Add a die to the roll?'
  return 'Initiative order required'
}

type OnHitChoice = Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'ON_HIT_CHOICE' }>

/** "Stunning Strike?" when one rider is offered; riders told apart by name need the generic title. */
export function onHitChoiceTitle(options: OnHitChoice['options']): string {
  const labels = new Set(options.map(({ riderLabel }) => riderLabel))
  const [only] = labels
  return only && labels.size === 1 ? `${only}?` : 'Add an on-hit effect'
}

/** "Stunning Strike: spend 1 from a resource pool": the rider and what it costs. */
export function onHitOptionLabel(option: OnHitChoice['options'][number]): string {
  return `${option.riderLabel}: ${
    option.kind === 'SPELL_SLOT'
      ? `spend a level ${option.slotLevel} slot`
      : `spend ${option.cost} from a resource pool`
  }`
}

/** Names who a prompted roll is for and, when a rule raised it, why. */
export function rollPromptText(
  actorLabel: string,
  trigger: EncounterRuleRollTriggerDto | undefined
) {
  if (trigger?.kind === 'CONCENTRATION') return concentrationPromptText(actorLabel, trigger)
  if (trigger?.kind === 'EFFECT_REPEAT_SAVE')
    return `Repeat save for ${actorLabel}: ${concentrationTriggerText(trigger)}`
  if (trigger?.kind === 'MASSIVE_DAMAGE')
    return `Massive damage save for ${actorLabel}: ${concentrationTriggerText(trigger)}`
  if (trigger?.kind === 'DEATH_SAVE') return deathSavePromptText(actorLabel, trigger)
  if (trigger?.kind === 'BASIC_ACTION_CHECK')
    return `${trigger.actionLabel}: ${trigger.checkLabel}${trigger.dc === null ? '' : ` DC ${trigger.dc}`}`
  return `Roll for ${actorLabel}`
}

/**
 * The d20 a contest check asks for, in the chosen check's mode, as the evidence row's request. Every
 * check shares the contest's one request.
 */
export function contestCheckEvidence(
  pending: Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'CONTEST_CHECK' }>,
  check: (typeof pending.checks)[number]
): Extract<PendingEncounterRuleOccurrenceSummaryDto, { kind: 'D20_EVIDENCE' }> {
  return {
    kind: 'D20_EVIDENCE',
    occurrenceId: pending.occurrenceId,
    occurrenceVersion: pending.occurrenceVersion,
    encounterVersion: pending.encounterVersion,
    rollerActorId: pending.rollerActorId,
    request: contestCheckD20Request(pending, check),
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
  }
}
