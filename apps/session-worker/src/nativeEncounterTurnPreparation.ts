import type { prepareEncounterTurn } from '@artificer-toolkit/rules-runtime/encounterTurnPreparation'
import { prepareEncounterTurnEffects } from '@artificer-toolkit/rules-runtime/encounterTurnEffects'
import { prepareEncounterTurnZoneEffects } from '@artificer-toolkit/rules-runtime/encounterTurnZoneEffects'
import { encounterSightHolds } from '@artificer-toolkit/rules-runtime/encounterAttackPerception'
import {
  planEncounterPassiveZones,
  type EncounterPassiveZoneCharacterRules
} from '@artificer-toolkit/rules-runtime/encounterPassiveZones'
import { plannedSpatialEffectRecord } from '@artificer-toolkit/rules-runtime/encounterPlacedZone'
import { prepareTurnLegendaryActions } from '@artificer-toolkit/rules-runtime/encounterTurnLegendaryAction'
import { deadCharacterIdsOfTargets } from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { discoverTurnLegendaryWindows } from '@artificer-toolkit/rules-runtime/encounterTurnLegendaryDiscovery'
import { prepareEncounterTurnRecharge } from '@artificer-toolkit/rules-runtime/encounterTurnRecharge'
import { prepareEncounterTurnDeathSave } from '@artificer-toolkit/rules-runtime/encounterTurnDeathSave'
import { prepareEncounterTurnInitiative } from '@artificer-toolkit/rules-runtime/encounterTurnInitiative'
import { prepareEncounterInitiativeSources } from '@artificer-toolkit/rules-runtime/encounterInitiativeSources'
import { prepareEncounterInitiativeDeclarationSources } from '@artificer-toolkit/rules-runtime/encounterInitiativeDeclarationSources'
import { toCharacterInitiativeActorFacts } from '@artificer-toolkit/rules-runtime/character/characterInitiativeFacts'
import { evaluateCharacterActiveGrantRules } from '@artificer-toolkit/rules-runtime/character/characterRuleEvaluation'
import { prepareEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import { prepareAttackBehindDecoys } from '@artificer-toolkit/rules-runtime/encounterAttackDecoys'
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
import type { PreparedLiveCharacterSheet } from './nativeCharacterRules.js'
import { readNativeLiveAttackPerception } from './nativeAttackPerception.js'
import { planNativeLiveMeleeRetaliation } from './nativeMeleeRetaliation.js'
import { readNativeLiveSpellPins } from './nativeEncounterTargets.js'
import { readNativeLiveTurnStarted } from './nativeTurnUses.js'
import {
  readNativeLivePerceptionScene,
  readNativeLiveSpatialEffects,
  resolveNativeLiveTurnEffectPerception
} from './nativeTurnEffectPerception.js'

type CharacterFacts = PreparedLiveCharacterSheet

/** Supplies private raw captures and DO facts to the shared ordered turn planner. */
export function createNativeLiveTurnStages(
  turn: Pick<
    Parameters<typeof prepareEncounterTurn<CharacterFacts>>[0],
    'state' | 'actors' | 'deadCharacterIds'
  >,
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
  const loadCharacterRules = async () => {
    const rules = new Map<string, EncounterPassiveZoneCharacterRules>()
    for (const actor of turn.actors) {
      if (actor.kind !== 'CHARACTER') continue
      const ruleEvaluation = (await loadTarget(actor.id))?.characterFacts?.ruleEvaluation
      if (ruleEvaluation) rules.set(actor.sourceId, ruleEvaluation)
    }
    return rules
  }
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
        random,
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
    zones: (stage) => {
      let sceneContext: Parameters<typeof readNativeLiveAttackPerception>[0]['sceneContext'] = null
      return prepareEncounterTurnZoneEffects<CharacterFacts>({
        ...stage,
        loadSourceSight: async ({ sourceActorId, occupantActorId }) => {
          const [source, occupant] = await Promise.all([
            loadTarget(sourceActorId),
            loadTarget(occupantActorId)
          ])
          if (!source || !occupant) throw new Error('Turn zone sight actors are unavailable.')
          const { actual } = await readNativeLiveAttackPerception({
            state,
            system,
            attacker: source,
            target: occupant,
            roller: 'ATTACKER',
            sceneContext,
            capture
          })
          return {
            occupantSeesSource: encounterSightHolds(actual, 'TARGET_SEES_ACTOR'),
            sourceSeesOccupant: encounterSightHolds(actual, 'ACTOR_SEES_TARGET')
          }
        },
        loadScene: async () => {
          const actorId = stage.boundary.actorId
          if (actorId === null) return null
          const loaded = await readNativeLivePerceptionScene({
            observerActorId: actorId,
            subjectActorId: actorId,
            campaignId: state.campaignId,
            capture
          })
          if (!loaded) return null
          inputs.onSceneRead({
            sceneId: loaded.id,
            sceneVersion: loaded.version,
            definitionSaveId: loaded.definitionSaveId
          })
          sceneContext = {
            sceneId: loaded.id,
            sceneVersion: loaded.version,
            grid: loaded.scene.grid
          }
          // A zone acting at its source's turn catches every creature token in the Scene (D144).
          const bindings = await capture({ kind: 'ACTOR_TOKEN_BINDINGS' })
          if (
            bindings.kind !== 'ACTOR_TOKEN_BINDINGS' ||
            !bindings.bindings.some(
              (binding) => binding.actorId === actorId && binding.tokenId === loaded.subjectTokenId
            )
          )
            throw new Error('Turn zone token bindings are unavailable.')
          const effects = await readNativeLiveSpatialEffects({
            encounterId: state.id,
            sceneId: loaded.id,
            sceneVersion: loaded.version,
            capture
          })
          const actorIdByTokenId = new Map(
            bindings.bindings.map((binding) => [binding.tokenId, binding.actorId])
          )
          // The Encounter's start places passive zones before its first turn (D144, D155).
          const placing =
            stage.root.commandType === 'START'
              ? planEncounterPassiveZones({
                  state,
                  occurrenceId: stage.occurrenceId,
                  rootCommandId: stage.root.rootCommandId,
                  actors: turn.actors,
                  system,
                  sceneGrid: loaded.scene.grid,
                  tokens: loaded.scene.tokens,
                  actorIdByTokenId,
                  characterRules: await loadCharacterRules()
                }).filter((zone) => !effects.some((effect) => effect.id === zone.id))
              : []
          const lastOrdinal = Math.max(0, ...effects.map((effect) => effect.createdOrdinal))
          return {
            effects: [
              ...effects,
              ...placing.map((zone, index) =>
                plannedSpatialEffectRecord(zone, {
                  encounterId: state.id,
                  sceneId: loaded.id,
                  createdOrdinal: lastOrdinal + index + 1,
                  createdAt: state.updatedAt
                })
              )
            ],
            tokens: loaded.scene.tokens,
            actorIdByTokenId
          }
        },
        loadTarget,
        createRuntime,
        definitions,
        random
      })
    },
    legendary: (stage) =>
      prepareTurnLegendaryActions<CharacterFacts>({
        ...stage,
        definitions,
        createRuntime,
        random,
        meleeRetaliation: async (retaliation) => {
          const attackerActorId = retaliation.attacker.actor.id
          const loaded = await readNativeLivePerceptionScene({
            observerActorId: attackerActorId,
            subjectActorId: retaliation.hitActorId,
            campaignId: state.campaignId,
            capture
          })
          if (!loaded) return null
          inputs.onSceneRead({
            sceneId: loaded.id,
            sceneVersion: loaded.version,
            definitionSaveId: loaded.definitionSaveId
          })
          const tokenOf = (actorId: string, tokenId: string) => {
            const token = loaded.scene.tokens.find(({ id }) => id === tokenId)
            if (!token) throw new Error('Melee retaliation token is unavailable.')
            return { ...token, tokenId, actorId }
          }
          return planNativeLiveMeleeRetaliation({
            ...retaliation,
            state,
            attackerToken: tokenOf(attackerActorId, loaded.observerTokenId),
            hitToken: tokenOf(retaliation.hitActorId, loaded.subjectTokenId),
            effects: await readNativeLiveSpatialEffects({
              encounterId: state.id,
              sceneId: loaded.id,
              sceneVersion: loaded.version,
              capture
            }),
            occurrenceId: stage.occurrenceId,
            userId: stage.userId,
            runtime,
            random
          })
        },
        discoverWindows: async (discovery) =>
          discoverTurnLegendaryWindows({
            ...discovery,
            spells: await readNativeLiveSpellPins(capture),
            tokenBoundActorIds: await (async () => {
              const response = await capture({ kind: 'ACTOR_TOKEN_BINDINGS' })
              if (response.kind !== 'ACTOR_TOKEN_BINDINGS')
                throw new Error('Legendary Action token bindings are unavailable.')
              return new Set(response.bindings.map((binding) => binding.actorId))
            })(),
            deadCharacterIds: deadCharacterIdsOfTargets(
              discovery.movementTargets?.values() ?? [],
              turn.deadCharacterIds
            ),
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
        prepareMechanics: async ({ decoyOccurrenceId, ...mechanics }) => {
          const targets = new Map(mechanics.movementTargets)
          for (const actor of [mechanics.actor, mechanics.target]) {
            if (targets.has(actor.id)) continue
            const target = await loadTarget(actor.id)
            if (!target) throw new Error('Legendary Action target is unavailable.')
            targets.set(actor.id, target)
          }
          return prepareAttackBehindDecoys({
            occurrenceId: decoyOccurrenceId,
            effects: targets.get(mechanics.target.id)?.activeEffects ?? [],
            system,
            prepare: (attackDecoy) =>
              prepareEncounterActionMechanics<CharacterFacts>({
                ...mechanics,
                attackDecoy,
                state,
                overridable: false,
                movementTargets: targets,
                loadSource: async (source) =>
                  resolveEncounterActionSource({
                    ...source,
                    system,
                    spells: await readNativeLiveSpellPins(capture)
                  }),
                loadRelationshipFacts: async (relation) =>
                  lockedRelationshipActionFacts({
                    ...relation,
                    targets: { activeEffectsByActorId }
                  })
              }),
            // The window falls on another creature's turn, so the attacker's sight of its target
            // is read from the Scene they share, not from the action's own preparation.
            perceive: async ({ sourceFacts, targetFacts }) => {
              const loaded = await readNativeLivePerceptionScene({
                observerActorId: targetFacts.actor.id,
                subjectActorId: sourceFacts.actor.id,
                campaignId: state.campaignId,
                capture
              })
              if (loaded)
                inputs.onSceneRead({
                  sceneId: loaded.id,
                  sceneVersion: loaded.version,
                  definitionSaveId: loaded.definitionSaveId
                })
              const { actual } = await readNativeLiveAttackPerception({
                state,
                system,
                attacker: sourceFacts,
                target: targetFacts,
                roller: 'ATTACKER',
                sceneContext: loaded && {
                  sceneId: loaded.id,
                  sceneVersion: loaded.version,
                  grid: loaded.scene.grid
                },
                capture
              })
              return actual
            }
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
    turnStarted: (turn) => readNativeLiveTurnStarted(capture, turn),
    deathSave: (stage) =>
      prepareEncounterTurnDeathSave<CharacterFacts>({
        ...stage,
        loadTarget,
        createRuntime,
        random
      }),
    initiative: (stage) => {
      async function loadCharacter(actor: EncounterRunCharacterActorState) {
        const target = stage.movementTargets?.get(actor.id) ?? (await loadTarget(actor.id))
        if (!target) throw new Error('Character initiative source is stale.')
        const facts = target.characterFacts
        assertCharacterFactsBoundToActor(
          facts,
          actor,
          state.gameSystemId,
          'Character initiative source is stale.'
        )
        // Initiative and its declarations read the actor's active grants, as its Sheet does.
        return {
          ...facts,
          ruleEvaluation: evaluateCharacterActiveGrantRules({
            gameSystemId: state.gameSystemId,
            evaluation: facts.ruleEvaluation,
            activeEffects: target.activeEffects,
            vocabularySnapshot: facts.prepared.context.vocabularySnapshot
          })
        }
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
        loadDeclarations: async () =>
          prepareEncounterInitiativeDeclarationSources({
            state,
            spells: await readNativeLiveSpellPins(capture),
            campaignId: state.campaignId,
            actors: stage.actors,
            system,
            loadCharacter,
            readPublishedSpell: async (spellId, facts) => {
              const pin = facts.sourceVersions.get(spellId)
              const spell = facts.prepared.context.currentSpellsById?.get(spellId)
              if (pin?.identity.subjectKind !== 'SPELL' || !spell)
                throw new Error('The declared spell source is unavailable.')
              return {
                publication: spell,
                version: { ...pin.identity, version: pin.version }
              }
            }
          })
      })
    }
  }
  return stages
}
