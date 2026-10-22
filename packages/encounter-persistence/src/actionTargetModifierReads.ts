import { CharacterRuleActionTargetDefenseUnavailableError } from '@artificer-toolkit/rules-runtime/characterRuleActionSystemAdapter'
import { resolveEncounterBelievedAttackPerception } from '@artificer-toolkit/rules-runtime/encounterAttackPerception'
import { playerSeesActor } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import { systemCoreCodeRegistry } from '@artificer-toolkit/rules-runtime/platformSystemCoreCodes'
import {
  encounterActionTargetModifiersDtoSchema,
  type EncounterActionTargetModifiersDto,
  type GetEncounterActionTargetModifiersInputDto
} from '@artificer-toolkit/schema/api/encounterActionTargetModifiers'
import { readActionChoicesRun, type ActionChoiceReadInput } from './actionChoiceReads.js'
import { prepareActionMechanics, readActionSceneContext } from './actionPreparationReads.js'
import { readRunActors } from './documents.js'
import { loadMovementTargets } from './movementTargetReads.js'
import { readEncounterPlayerViewer } from './playerViewer.js'
import type { EncounterTurnReadTransaction } from './ports.js'
import { withEncounterRollModeReasons } from './rollModeReasons.js'

/**
 * What the acting Character believes about attacking each creature the member can see, with one
 * action (ATTACK-10.1, D100). Each target is prepared as the roll prompt prepares it, with the
 * believed sight standing in for the true sight, so the mode and reasons are the prompt's own
 * before the server applies the true mode. A read: it never writes.
 */
export async function readEncounterActionTargetModifiers(
  tx: EncounterTurnReadTransaction,
  input: ActionChoiceReadInput<GetEncounterActionTargetModifiersInputDto>
): Promise<EncounterActionTargetModifiersDto> {
  const { request } = input
  const current = await readActionChoicesRun(tx, input)
  if (!current) throw new Error('Encounter action choices are stale or unavailable.')
  const { state, actor, campaign, membership } = current
  const actors = await readRunActors(tx, state)
  const others = actors.filter((entry) => entry.id !== actor.id)
  const viewer =
    membership.role === 'OWNER'
      ? null
      : await readEncounterPlayerViewer(tx, { id: state.id, actors: others }, membership)
  const listed = others.filter((entry) => !viewer || playerSeesActor(entry, viewer))
  const [movementTargets, system] = await Promise.all([
    loadMovementTargets(tx, {
      state,
      campaign,
      targetActorIds: [actor.id, ...listed.map((entry) => entry.id)],
      includeReactionSources: true
    }),
    tx.ports.requireSystem(state.gameSystemId)
  ])
  const tokenIdOf = async (actorId: string) => {
    const row = await tx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) =>
        q.eq('encounterId', state.id).eq('actorId', actorId)
      )
      .unique()
    return row && row.sceneId === request.scene?.sceneId ? row.tokenId : null
  }
  const sourceTokenId = request.scene ? await tokenIdOf(actor.id) : null
  const prepared = await Promise.all(
    listed.map(async (target) => {
      const targetTokenId = sourceTokenId ? await tokenIdOf(target.id) : null
      const sceneContext =
        request.scene && sourceTokenId && targetTokenId
          ? await readActionSceneContext(tx, state, {
              actorId: actor.id,
              targetActorId: target.id,
              sceneContext: {
                sceneId: request.scene.sceneId,
                expectedSceneVersion: request.scene.expectedSceneVersion,
                sourceTokenId,
                targetTokenId
              }
            })
          : null
      const attack = await prepareActionMechanics(tx, {
        state,
        campaign,
        actor,
        target,
        actors,
        actionId: request.actionId,
        wieldConflictAcceptance: { kind: 'UNPROMPTED' },
        overridable: true,
        // The pick is made at cast; the attack this read shows is the test every option shares.
        readsSharedTest: true,
        movementTargets,
        sceneContext,
        // The prompt's belief is what this read shows, so believed sight is both sights here.
        loadAttackPerception: async ({ sourceFacts, targetFacts, roller }) => {
          const believed = await resolveEncounterBelievedAttackPerception({
            gameSystemId: state.gameSystemId,
            loadDefinition: async (definitionId) => {
              const definition = await tx.ports.readCurrentDefinition(
                definitionId,
                campaign.ownerUserId
              )
              return (
                definition && {
                  definitionFamilyKey: definition.definitionFamilyKey,
                  gameSystemId: definition.gameSystemId,
                  current: definition
                }
              )
            },
            loadSystem: async () => system,
            attacker: sourceFacts,
            target: targetFacts,
            roller
          })
          return { actual: believed, believed }
        }
      })
      const published =
        attack.plan.kind === 'SINGLE_GRAPH' ? attack.plan.published : attack.plan.test.published
      let bound: ReturnType<typeof attack.adapter.bindFacts> | null = null
      if (attack.makesAttackRoll) {
        try {
          bound = attack.adapter.bindFacts({ ...attack.binding, published })
        } catch (error) {
          // A creature with no defense (a custom creature) shows no modifiers here; naming it in
          // the command still refuses it. Any other bind failure is a real error.
          if (!(error instanceof CharacterRuleActionTargetDefenseUnavailableError)) throw error
        }
      }
      return {
        actorId: target.id,
        d20:
          bound?.d20Roller === 'SOURCE' && bound.d20RollMode && bound.d20Keep && bound.d20Audit
            ? {
                rollMode: bound.d20RollMode,
                keep: bound.d20Keep,
                contributors: bound.d20Audit.contributors
              }
            : null
      }
    })
  )
  const targets = await withEncounterRollModeReasons(tx, input.run, membership, (reasons) =>
    prepared.map(({ actorId, d20 }) => ({
      actorId,
      attack: d20 && {
        rollMode: d20.rollMode,
        rollModeLabel: systemCoreCodeRegistry.requireCode(
          state.gameSystemId,
          'rollMode',
          d20.rollMode
        ).label,
        keep: d20.keep,
        reasons: reasons(d20)
      }
    }))
  )
  return encounterActionTargetModifiersDtoSchema.parse({
    encounterId: state.id,
    encounterVersion: state.version,
    actorId: actor.id,
    actionId: request.actionId,
    targets
  })
}
