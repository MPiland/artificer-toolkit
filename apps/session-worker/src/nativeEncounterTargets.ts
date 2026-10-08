import type {
  LiveSessionEncounterRulesInput,
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { liveSessionCharacterRulesScope } from '@artificer-toolkit/schema/api/liveSessionEncounterCaptureBundle'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_ACTIVE_RULE_EFFECTS_PER_OWNER } from '@artificer-toolkit/schema/shared/activeRuleEffects'
import { buildMovementTarget } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import {
  encounterBasicActionEffects,
  withEncounterBasicActionDefense
} from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { withEncounterConditionMechanics } from '@artificer-toolkit/rules-runtime/encounterConditionMechanics'
import { liveSessionEncounterRulesInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'

export async function readNativeLiveActorsAndEffects(input: {
  state: EncounterRunState
  capture: (request: LiveSessionEncounterRulesRequest) => Promise<LiveSessionEncounterRulesResponse>
}) {
  const { state, capture } = input
  const capturedActors = await Promise.all(
    state.actorIds.map(async (actorId) => {
      const response = await capture({ kind: 'ACTOR', actorId })
      if (
        response.kind !== 'ACTOR' ||
        response.actor.id !== actorId ||
        response.actor.encounterId !== state.id ||
        response.actor.systemId !== state.gameSystemId ||
        !state.sides.some((side) => side.id === response.actor.sideId)
      )
        throw new Error('Encounter actor binding mismatch.')
      return response
    })
  )
  const actors = capturedActors
    .map((entry) => entry.actor)
    .sort((left, right) => left.id.localeCompare(right.id))
  const characterIds = actors.flatMap((actor) =>
    actor.kind === 'CHARACTER' ? [actor.sourceId] : []
  )
  if (new Set(characterIds).size !== characterIds.length)
    throw new Error('Encounter Character source binding mismatch.')

  const activeEffectsByActorId = new Map(
    await Promise.all(
      capturedActors.map(async (firstPage) => {
        const { actor } = firstPage
        const effects: ActiveRuleEffectRecord[] = []
        let afterEffectId: string | null = null
        let response = { effects: firstPage.effects, continueAfter: firstPage.continueAfter }
        for (;;) {
          let lastId: string | null = afterEffectId
          for (const effect of response.effects) {
            if (
              (lastId !== null && effect.id <= lastId) ||
              (actor.kind === 'CHARACTER'
                ? effect.owner.kind !== 'CHARACTER' || effect.owner.characterId !== actor.sourceId
                : effect.owner.kind !== 'ENCOUNTER_ACTOR' ||
                  effect.owner.encounterId !== state.id ||
                  effect.owner.targetActorId !== actor.id)
            )
              throw new Error('Encounter effect page identity mismatch.')
            lastId = effect.id
            effects.push(effect)
          }
          if (effects.length > MAX_ACTIVE_RULE_EFFECTS_PER_OWNER)
            throw new Error('Active rule effects exceed the supported bound.')
          if (response.continueAfter === null) break
          if (
            response.effects.length !== 4 ||
            response.continueAfter !== lastId ||
            lastId === afterEffectId
          )
            throw new Error('Encounter effect page cursor mismatch.')
          afterEffectId = response.continueAfter
          const next = await capture({ kind: 'EFFECTS', actorId: actor.id, afterEffectId })
          if (next.kind !== 'EFFECTS' || next.actorId !== actor.id)
            throw new Error('Encounter effect owner mismatch.')
          response = next
        }
        effects.sort(
          (left, right) =>
            left.createdOrdinal - right.createdOrdinal || left.id.localeCompare(right.id)
        )
        return [actor.id, effects] as const
      })
    )
  )
  return { actors, activeEffectsByActorId }
}

export async function prepareNativeLiveMovementTarget(input: {
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>
  state: EncounterRunState
  actor: EncounterRunActorState
  activeEffectsByActorId: Map<string, ActiveRuleEffectRecord[]>
  captures: LiveCaptureReads
}) {
  const { actor, state, scope } = input
  const characterFacts =
    actor.kind === 'CHARACTER'
      ? await input.captures.prepareCharacter(liveSessionCharacterRulesScope(scope, actor))
      : null
  const activeEffects = input.activeEffectsByActorId.get(actor.id)
  if (!activeEffects) throw new Error('Encounter actor effects are unavailable.')
  let revisions = characterFacts?.revisions ?? []
  const capture = async (request: LiveSessionEncounterRulesRequest) => {
    const response = await input.captures.encounterRules(
      liveSessionEncounterRulesInputSchema.parse({ ...scope, request })
    )
    revisions = mergeNativeRulesRevisions(revisions, response.revisions)
    return response
  }
  const definitions = {
    requireCurrent: async (definitionId: string) => {
      const response = await capture({ kind: 'DEFINITION', definitionId })
      if (response.kind !== 'DEFINITION' || !response.definition)
        throw new Error('Encounter target definition is unavailable.')
      return response.definition
    }
  }
  const target = await withEncounterConditionMechanics({
    target: buildMovementTarget({
      actor,
      activeEffects,
      gameSystemId: state.gameSystemId,
      campaignId: state.campaignId,
      characterFacts,
      includeReactionSources: true
    }),
    gameSystemId: state.gameSystemId,
    definitions
  })
  // Only an actor with a defensive basic-action effect (Dodge) reads its capability definitions.
  const defended = encounterBasicActionEffects(actor).some(
    (effect) =>
      effect.mechanic === 'DISADVANTAGE_ON_ATTACKS_AGAINST' || effect.mechanic === 'SAVE_ADVANTAGE'
  )
    ? await withEncounterBasicActionDefense({
        target,
        gameSystemId: state.gameSystemId,
        definitions
      })
    : target
  return { target: defended, revisions }
}
