import type { prepareEncounterTurn } from '@artificer-toolkit/rules-runtime/encounterTurnPreparation'
import { prepareEncounterTurnEffects } from '@artificer-toolkit/rules-runtime/encounterTurnEffects'
import { prepareTurnLegendaryActions } from '@artificer-toolkit/rules-runtime/encounterTurnLegendaryAction'
import { discoverTurnLegendaryWindows } from '@artificer-toolkit/rules-runtime/encounterTurnLegendaryDiscovery'
import { prepareEncounterTurnRecharge } from '@artificer-toolkit/rules-runtime/encounterTurnRecharge'
import { prepareEncounterTurnInitiative } from '@artificer-toolkit/rules-runtime/encounterTurnInitiative'
import { prepareEncounterInitiativeSources } from '@artificer-toolkit/rules-runtime/encounterInitiativeSources'
import { prepareEncounterInitiativeDeclarationSources } from '@artificer-toolkit/rules-runtime/encounterInitiativeDeclarationSources'
import { toCharacterInitiativeActorFacts } from '@artificer-toolkit/rules-runtime/character/characterInitiativeFacts'
import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { lockedRelationshipActionFacts } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import {
  assertCharacterFactsBoundToActor,
  type MovementTarget
} from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type {
  LiveSessionEncounterRulesRequest,
  LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunCharacterActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'
import type { prepareNativeLiveCharacterSheet } from './nativeCharacterRules.js'
import { resolveNativeLiveTurnEffectPerception } from './nativeTurnEffectPerception.js'

type CharacterFacts = Awaited<ReturnType<typeof prepareNativeLiveCharacterSheet>>

/** Supplies private raw captures and DO facts to the shared ordered turn planner. */
export function createNativeLiveTurnStages(
  turn: Pick<Parameters<typeof prepareEncounterTurn<CharacterFacts>>[0], 'state' | 'actors'>,
  inputs: {
    system: SystemAuthoredDto
    activeEffectsByActorId: ReadonlyMap<string, ActiveRuleEffectRecord[]>
    capture(request: LiveSessionEncounterRulesRequest): Promise<LiveSessionEncounterRulesResponse>
    loadTarget(actorId: string): Promise<MovementTarget<CharacterFacts> | undefined>
    runtime: RulesRuntimeService
    random(maximum: number): number
    onSceneRead: Parameters<typeof resolveNativeLiveTurnEffectPerception>[0]['onSceneRead']
  }
) {
  const { state } = turn
  const { capture, loadTarget, system, runtime, random, activeEffectsByActorId } = inputs
  const definitions = {
    requireCurrent: async (definitionId: string) => {
      const response = await capture({ kind: 'DEFINITION', definitionId })
      if (
        response.kind !== 'DEFINITION' ||
        !response.definition ||
        response.definition.id !== definitionId ||
        response.definition.gameSystemId !== state.gameSystemId
      )
        throw new Error('Turn definition is unavailable.')
      return response.definition
    }
  }
  const createRuntime = async () => runtime
  const rollD20 = () => random(20) + 1
  const stages: Parameters<typeof prepareEncounterTurn<CharacterFacts>>[1] = {
    effects: (stage) =>
      prepareEncounterTurnEffects<CharacterFacts>({
        ...stage,
        listEffects: async (owner) => {
          const actor = turn.actors.find((candidate) =>
            owner.kind === 'CHARACTER'
              ? candidate.kind === 'CHARACTER' && candidate.sourceId === owner.characterId
              : candidate.id === owner.targetActorId && owner.encounterId === state.id
          )
          const effects = actor && activeEffectsByActorId.get(actor.id)
          if (!effects) throw new Error('Turn effect owner is unavailable.')
          return effects
        },
        loadMaintainedState: async (stateId) => {
          const response = await capture({ kind: 'MAINTENANCE_STATE', stateId })
          if (
            response.kind !== 'MAINTENANCE_STATE' ||
            (response.state &&
              (response.state.id !== stateId || response.state.encounterId !== state.id))
          )
            throw new Error('Turn maintenance state is unavailable.')
          return response.state
        },
        loadTarget,
        createRuntime,
        rollD20,
        resolvePerception: (perception) =>
          resolveNativeLiveTurnEffectPerception({
            ...perception,
            state,
            system,
            capture,
            loadTarget,
            onSceneRead: inputs.onSceneRead
          })
      }),
    legendary: (stage) =>
      prepareTurnLegendaryActions<CharacterFacts>({
        ...stage,
        definitions,
        createRuntime,
        random,
        discoverWindows: (discovery) =>
          discoverTurnLegendaryWindows({
            ...discovery,
            definitions,
            createRuntime,
            loadSystem: async () => system,
            loadTargets: async (actorIds) => {
              const entries = await Promise.all(
                actorIds.map(async (actorId) => {
                  const target = await loadTarget(actorId)
                  if (!target) throw new Error('Legendary Action target is unavailable.')
                  return [actorId, target] as const
                })
              )
              return new Map(entries)
            }
          }),
        prepareMechanics: async (mechanics) => {
          const targets = new Map(mechanics.movementTargets)
          for (const actor of [mechanics.actor, mechanics.target]) {
            if (targets.has(actor.id)) continue
            const target = await loadTarget(actor.id)
            if (!target) throw new Error('Legendary Action target is unavailable.')
            targets.set(actor.id, target)
          }
          return prepareEncounterActionMechanics<CharacterFacts>({
            ...mechanics,
            state,
            overridable: false,
            movementTargets: targets,
            loadSource: async (source) => resolveEncounterActionSource({ ...source, system }),
            loadRelationshipFacts: async (relation) =>
              lockedRelationshipActionFacts({
                ...relation,
                targets: { activeEffectsByActorId }
              })
          })
        }
      }),
    recharge: (stage) =>
      prepareEncounterTurnRecharge({
        ...stage,
        definitions,
        createRuntime,
        rollD6: () => random(6) + 1
      }),
    initiative: (stage) => {
      async function loadCharacter(actor: EncounterRunCharacterActorState) {
        const target = stage.movementTargets?.get(actor.id) ?? (await loadTarget(actor.id))
        const facts = target?.characterFacts
        assertCharacterFactsBoundToActor(
          facts,
          actor,
          state.gameSystemId,
          'Character initiative source is stale.'
        )
        return facts
      }
      return prepareEncounterTurnInitiative({
        ...stage,
        createRuntime,
        integerSource: ({ min, max }) => min + random(max - min + 1),
        createRequestId: () => crypto.randomUUID(),
        loadSources: () =>
          prepareEncounterInitiativeSources({
            state,
            campaignId: state.campaignId,
            actors: stage.actors,
            loadCharacter: async (actor) => {
              const facts = await loadCharacter(actor)
              const { snapshot, registry, output } = facts.ruleEvaluation
              return {
                streamVersion: facts.active.play.streamVersion,
                initiativeActorFacts: toCharacterInitiativeActorFacts({
                  snapshot,
                  registry,
                  rulePolicyOutput: output
                }),
                rulePolicyOutput: output
              }
            }
          }),
        loadDeclarations: () =>
          prepareEncounterInitiativeDeclarationSources({
            state,
            campaignId: state.campaignId,
            actors: stage.actors,
            system,
            loadCharacter,
            readPublishedSpell: async (spellId, facts) => {
              const version = facts.sourceVersions.find(
                (source) => source.subjectId === spellId && source.subjectKind === 'SPELL'
              )
              const spell = facts.evaluationInput.spellDocumentsById?.get(spellId)
              if (!version || !spell) throw new Error('The declared spell source is unavailable.')
              return { publication: { subjectKind: 'SPELL', document: spell }, version }
            }
          })
      })
    }
  }
  return stages
}
