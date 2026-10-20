import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { planCharacterInitiativeRestores } from '@artificer-toolkit/rules-runtime/encounterInitiativeRestores'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { CharacterRuleEvaluationResult } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { readCharacterMaximumHitPoints } from './characterMaximumHitPoints.js'
import type { EncounterDocument } from './store.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'

/** The rules a Character's initiative restores are discovered from and resolved against. */
export type EncounterInitiativeRestoreCharacterRules = Pick<
  CharacterRuleEvaluationResult,
  'initiativeRestoreSources'
> & { output: Pick<CharacterRuleEvaluationResult['output'], 'resources'> }

/**
 * Raises the empty feature charges of every Character that rolled initiative in this settlement
 * (Perfect Self, Superior Inspiration): the passive effects a Character carries for `ROLL_INITIATIVE`
 * read its live pools after the commit's earlier writes, and each raise is one Character mechanics
 * batch under a command id fixed by the occurrence, so a replayed commit never raises twice. An
 * actor that is not a Character, or one whose rules are unavailable, restores nothing.
 */
export async function persistEncounterInitiativeRestores(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    campaign: EncounterDocument<'campaigns'>
    actors: readonly EncounterRunActorState[]
    orderedActorIds: readonly string[]
    rootCommandId: string
    occurrenceId: string
    occurredAt: string
  },
  callbacks: {
    readCharacterRules(
      campaign: EncounterDocument<'campaigns'>,
      characterId: string
    ): Promise<EncounterInitiativeRestoreCharacterRules | null>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
  }
): Promise<void> {
  const { state, occurrenceId } = input
  for (const [ordinal, actorId] of input.orderedActorIds.entries()) {
    const actor = input.actors.find(({ id }) => id === actorId)
    if (actor?.kind !== 'CHARACTER') continue
    const rules = await callbacks.readCharacterRules(input.campaign, actor.sourceId)
    if (!rules) continue
    const restores = planCharacterInitiativeRestores({
      sources: rules.initiativeRestoreSources,
      resources: rules.output.resources
    })
    if (restores.length === 0) continue
    const row = await ctx.ports.readCharacterRow(actor.sourceId)
    if (!row) throw new Error('Live Session initiative restore Character is missing.')
    await callbacks.applyMechanics({
      encounterId: state.id,
      targetActorId: actor.id,
      expectedEncounterVersion: state.version,
      occurrenceId,
      sourceCommandId: input.rootCommandId,
      commandId: deriveEncounterCharacterMechanicsEventCommandId({
        occurrenceId,
        sourceCommandId: input.rootCommandId,
        phase: 'INITIATIVE_RESTORE',
        ordinal,
        targetCharacterId: actor.sourceId
      }),
      occurredAt: input.occurredAt,
      applications: [],
      characterResourceRestores: restores,
      effectiveMaximumHitPoints: await readCharacterMaximumHitPoints(ctx, row.play),
      forceVersionAdvance: false
    })
  }
}
