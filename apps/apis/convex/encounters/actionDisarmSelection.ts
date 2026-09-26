import type { GetEncounterOptionalActionChoicesInputDto } from '@artificer-toolkit/schema/api/encounterActionChoices'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  readEncounterDisarmSelection,
  requireEncounterDisarmDefinition
} from '@artificer-toolkit/rules-runtime/encounterDisarmPreparation'
import type { QueryCtx } from '../_generated/server'
import { prepareNativeEncounterActionMechanics } from './actionMechanicsPreparation'
import { prepareNativeActionEconomy } from './actionEconomy'
import { readNativeActionSceneContext } from './actionSceneContext'
import { rejectDomain } from '../lib/domainRejections'

/** The current Disarm choices for the optional-action drawer, from stored facts. */
export async function readNativeDisarmSelection(
  ctx: QueryCtx,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    actor: EncounterRunActorState
    target: EncounterRunActorState
    command: GetEncounterOptionalActionChoicesInputDto
    campaignOwnerUserId: string
  }
) {
  const { state, actor, target, command } = input
  const definition = requireEncounterDisarmDefinition(input)
  const prepared = await prepareNativeEncounterActionMechanics(ctx, {
    state,
    actors: input.actors,
    actor,
    target,
    actionId: command.actionId,
    wieldConflictAcceptance: { kind: 'UNPROMPTED' },
    overridable: false,
    campaignOwnerUserId: input.campaignOwnerUserId
  })
  const selection = readEncounterDisarmSelection({
    actor,
    target,
    actionId: command.actionId,
    definition,
    prepared,
    sceneContext: await readNativeActionSceneContext(ctx, state, command, 'MEMBER'),
    rejectTarget: () => rejectDomain('TARGET_UNAVAILABLE', 'Optional combat target is unavailable.')
  })
  await prepareNativeActionEconomy(ctx, {
    state,
    actor,
    userId: input.campaignOwnerUserId,
    activation: { code: 'ACTION', amount: 1 },
    target: prepared.sourceFacts
  })
  // The drawer labels held items from the defender's own Character facts.
  return { ...selection, definition, targetCharacter: prepared.targetFacts.characterFacts }
}
