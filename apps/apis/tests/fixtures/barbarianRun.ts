import { readCharacterSheetState } from '@artificer-toolkit/schema/projections/characterStoredState'
import { discoverCharacterActionCapabilities } from '@artificer-toolkit/rules-runtime/characterActionCapabilityDiscovery'
import { compileCharacterActionEntryPoints } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import { barbarian } from '@artificer-toolkit/source-data/srd/classes/barbarian.js'
import { greataxe } from '@artificer-toolkit/source-data/srd/equipment/greataxe.js'
import { loadCharacterSheetFacts } from '../../convex/characters/sheetFacts'
import { readCharacterRecord, readCharacterRow } from '../../convex/characters/stateDocuments'
import { checkpointLiveRoom } from './localRoomWorker'
import { homebrewCopy } from './homebrewCopy'
import { actOnRun, executeOnRun, setupWolfRun } from './srdWolfRun'

/**
 * The two Barbarians every journey runs: the SRD Class, and the same document as a homebrew author
 * owns it (fresh ids, different copy; D113's authored parity). Behavior must not tell them apart.
 */
export const srdBarbarian = {
  ...barbarian,
  features: barbarian.features?.filter(({ label }) => label === 'Rage')
}
export const BARBARIANS = [
  { name: 'an SRD Barbarian', source: srdBarbarian },
  { name: 'a homebrew Barbarian with the same options', source: homebrewCopy(srdBarbarian) }
]

/**
 * A level-1 SRD Barbarian with an equipped Greataxe, acting first in an Assisted (or Manual) Run
 * against the seeded SRD Wolf. Its Rage is the real SRD Feature, compiled from the seeded
 * Barbarian Class.
 */
export async function setupBarbarianRun(
  source: typeof srdBarbarian,
  automationMode: 'ASSISTED' | 'MANUAL' = 'ASSISTED',
  enemy?: Parameters<typeof setupWolfRun>[0]['enemy']
) {
  const base = await setupWolfRun({
    character: { base: source, features: source.features },
    equipment: greataxe,
    name: 'Rage journey fixture',
    automationMode,
    enemy
  })
  const actions = await base.t.run(async (ctx) => {
    const facts = await loadCharacterSheetFacts(
      ctx,
      base.player.userId,
      base.character.id,
      base.campaign.id
    )
    if (!facts) throw new Error('The Rage fixture Character facts are missing.')
    const { actionCandidates } = facts.ruleEvaluation.facts
    const rage = actionCandidates.find(
      (candidate) => candidate.resourceUse?.chargeId === source.resources?.charges?.id
    )
    const axe = actionCandidates.find((candidate) => candidate.equipment?.grip === 'TWO_HANDED')
    if (!rage || !axe) throw new Error('The Barbarian offers no Rage or Greataxe action.')
    const entry = compileCharacterActionEntryPoints({
      gameSystemId: base.character.systemId,
      candidates: actionCandidates,
      descriptors: discoverCharacterActionCapabilities({
        gameSystemId: base.character.systemId,
        candidates: actionCandidates,
        conditionDefinitionIds: (facts.prepared.context.registry.system?.conditionTypes ?? []).map(
          ({ id }) => id
        ),
        abilityDefinitions: facts.ruleEvaluation.facts.abilityDefinitions,
        entryPoints: facts.ruleEvaluation.actionEntryPoints
      })
    }).find((value) => value.kind === 'CHARACTER_ACTION' && value.actionId === rage.actionId)
    const damage = facts.ruleEvaluation.output.actionDecisions
      .find((decision) => decision.actionId === axe.actionId)
      ?.mechanic.outcomes.find((outcome) => outcome.kind === 'DAMAGE')
    const rageDecision = facts.ruleEvaluation.output.actionDecisions.find(
      (decision) => decision.actionId === rage.actionId
    )
    if (damage?.kind !== 'DAMAGE') throw new Error('The Greataxe attack has no damage.')
    return {
      rage: {
        actionId: rage.actionId,
        entry,
        activation: rageDecision?.mechanic.activation
      },
      axe: { actionId: axe.actionId, expression: damage.expression }
    }
  })
  return { ...base, actions }
}

export type BarbarianRun = Awaited<ReturnType<typeof setupBarbarianRun>>

export type RunResult = Awaited<ReturnType<typeof executeOnRun>>

export function rages(fixture: BarbarianRun) {
  return actOnRun(fixture, null, {
    actorId: fixture.actor.id,
    actionId: fixture.actions.rage.actionId,
    targetActorId: fixture.actor.id
  })
}

/** What the Barbarian holds after the room publishes: the Rage charge spent, its grants, its hit points. */
export async function barbarianState(fixture: BarbarianRun) {
  await checkpointLiveRoom(fixture.campaign.id)
  return fixture.t.run(async (ctx) => {
    const row = await readCharacterRow(ctx, fixture.character.id)
    if (!row) throw new Error('The Barbarian is missing.')
    const grants = await ctx.db
      .query('characterActiveRuleEffects')
      .withIndex('by_characterId_createdOrdinal_id', (q) =>
        q.eq('characterId', fixture.character.id)
      )
      .collect()
    return {
      rageChargesUsed: readCharacterSheetState(row).resourceUsage.reduce(
        (total, { used }) => total + used,
        0
      ),
      hitPoints: readCharacterRecord(row).state.hitpoints.current,
      grantIds: grants.map(({ id }) => id)
    }
  })
}
