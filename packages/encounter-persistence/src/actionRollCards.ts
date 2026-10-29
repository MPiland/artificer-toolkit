import { encounterBasicActionCheckLabel } from '@artificer-toolkit/rules-runtime/encounterMovementPassagePreparation'
import {
  actionD20RollRecord,
  actionDamageRollRecord,
  basicActionCheckRollRecord,
  ruleCheckRollId
} from '@artificer-toolkit/rules-runtime/encounterRuleCheckRolls'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { EncounterCounterCheckEvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import { damageAddedDieOfNode } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { actionSystemRollAnswers, readAppCardedDice, type SettledDie } from './appCardedDice.js'
import type {
  CampaignAuthority,
  EncounterCharacterWriteTransaction,
  EncounterWritePorts
} from './ports.js'
import { recordRuleRollCard } from './ruleRollCards.js'

type MechanicsBatch = Extract<
  Extract<
    LiveSessionEncounterActionCommitInput['execution'],
    { applicationOutputs: unknown }
  >['applicationOutputs'],
  { kind: 'CHARACTER_MECHANICS_BATCH' | 'ENCOUNTER_ACTOR_MECHANICS_BATCH' }
>

/** A batch's d20 and nested d20 as settled dice, indexed as `recordActionRollCards` checks them. */
export function settledD20s(
  batch: Pick<MechanicsBatch, 'd20' | 'nestedD20'>
): (SettledDie | null)[] {
  return [batch.d20, batch.nestedD20].map((d20) =>
    d20 ? { requestId: d20.requestId, value: d20.selectedNatural } : null
  )
}

/**
 * Cards the d20 of each spellcasting check a reactor rolled to counter a higher-level cast (D127), one
 * card per check, from the reactor. A die the app rolled for a `SYSTEM_ROLL` answer was carded as its
 * app attempt; an entered or auto-rolled die is carded here.
 */
export async function recordCounterCheckRollCards(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: {
    campaign: CampaignAuthority['campaign']
    encounterId: string
    gameSystemId: string
    /** The cast's occurrence, which seeds the card ids and holds the answers that rolled the dice. */
    occurrenceId: string
    checks: readonly { reactor: EncounterRunActorState; check: EncounterCounterCheckEvidenceDto }[]
    response: ResolveRuleOccurrenceInputDto | null | undefined
    responderUserId: string
    initiatorUserId: string
    visibility: Parameters<typeof recordRuleRollCard>[1]['visibility']
    createdAt: string
  }
): Promise<void> {
  if (input.checks.length === 0) return
  const system = await ctx.ports.requireSystem(input.gameSystemId)
  const ruleset = { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion }
  const appCarded = await readAppCardedDice(ctx, {
    occurrenceId: input.occurrenceId,
    answers: await actionSystemRollAnswers(ctx, {
      occurrenceId: input.occurrenceId,
      response: input.response,
      responderUserId: input.responderUserId
    }),
    dice: input.checks.map(({ check }) => ({
      requestId: check.d20.requestId,
      value: check.d20.selectedNatural
    }))
  })
  for (const [index, { reactor, check }] of input.checks.entries()) {
    if (appCarded.has(index)) continue
    const roll = basicActionCheckRollRecord({
      occurrenceId: input.occurrenceId,
      rollId: ruleCheckRollId(input.occurrenceId, index, 'counter-check'),
      d20: check.d20,
      actionLabel: 'Counter',
      checkLabel: encounterBasicActionCheckLabel(system, check.checkDefinitionId),
      rollerLabel: reactor.label,
      ruleset,
      createdAt: input.createdAt
    })
    await recordRuleRollCard(ctx, {
      campaign: input.campaign,
      encounterId: input.encounterId,
      roller: reactor,
      initiatorUserId: input.initiatorUserId,
      visibility: input.visibility,
      clientNonce: roll.id,
      roll
    })
  }
}

/**
 * Cards the dice a settled action (or Legendary Action) rolled, one card per die: an attack d20 is
 * the source's, a save d20 the target's, and each requested damage a total-only card from the
 * source. A d20 in `appCardedD20s` (from `readAppCardedDice` over `settledD20s`) is skipped,
 * because its app attempt already posted the card; an auto-rolled or entered d20 is carded here.
 */
export async function recordActionRollCards(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: {
    campaign: CampaignAuthority['campaign']
    encounterId: string
    gameSystemId: string
    /** Seeds the card ids: an occurrence that cards several actions gives each its own scope. */
    rollScope: string
    batch: Pick<MechanicsBatch, 'd20' | 'nestedD20' | 'applications' | 'damageAddedDice'>
    actionLabel: string
    source: EncounterRunActorState
    target: EncounterRunActorState
    initiatorUserId: string
    visibility: Parameters<typeof recordRuleRollCard>[1]['visibility']
    createdAt: string
    appCardedD20s: ReadonlySet<number>
  }
): Promise<void> {
  const { batch, source, target } = input
  const system = await ctx.ports.requireSystem(input.gameSystemId)
  const ruleset = { systemId: system.id, code: system.rulesetCode, version: system.rulesetVersion }
  for (const [checkIndex, d20] of [batch.d20, batch.nestedD20].entries()) {
    // A d20 the server adjusted for sight, or failed automatically, is always carded here: the app
    // attempt's card showed only the dice as rolled.
    const autoFailConditionIds = d20?.autoFailConditionIds ?? []
    if (
      !d20 ||
      (input.appCardedD20s.has(checkIndex) && !d20.modeAdjustment && !autoFailConditionIds.length)
    )
      continue
    const roller = d20.resultPath.startsWith('ON_SAVE_') ? target : source
    const record = (reader: 'PLAYER' | 'GM') =>
      actionD20RollRecord({
        occurrenceId: input.rollScope,
        checkIndex,
        d20,
        actionLabel: input.actionLabel,
        rollerLabel: roller.label,
        ruleset,
        createdAt: input.createdAt,
        reader,
        autoFailLabels: autoFailConditionIds.map(
          (id) =>
            system.conditionTypes.find((condition) => condition.id === id)?.label ?? 'A condition'
        )
      })
    const roll = record('PLAYER')
    await recordRuleRollCard(ctx, {
      campaign: input.campaign,
      encounterId: input.encounterId,
      roller,
      initiatorUserId: input.initiatorUserId,
      visibility: input.visibility,
      clientNonce: roll.id,
      roll,
      ...(d20.modeAdjustment ? { gmRoll: record('GM') } : {})
    })
  }
  for (const application of batch.applications) {
    if (application.kind !== 'DAMAGE') continue
    const roll = actionDamageRollRecord({
      occurrenceId: input.rollScope,
      checkIndex: 2 + application.ordinal,
      total: application.requestedAmount,
      // An added die's damage is carded under its source ("Hunter's Mark"), the rest the action's.
      actionLabel:
        damageAddedDieOfNode(batch.damageAddedDice, application.sourceNodeId)?.label ??
        input.actionLabel,
      damageTypeLabel:
        system.damageTypes?.find((damageType) => damageType.id === application.damageTypeId)
          ?.label ?? null,
      rollerLabel: source.label,
      ruleset,
      createdAt: input.createdAt
    })
    await recordRuleRollCard(ctx, {
      campaign: input.campaign,
      encounterId: input.encounterId,
      roller: source,
      initiatorUserId: input.initiatorUserId,
      visibility: input.visibility,
      clientNonce: roll.id,
      roll
    })
  }
}
