import type { EncounterExecuteInput } from '@artificer-toolkit/schema/api/encounters'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { discoverEncounterFeatureActionCapabilities } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID,
  SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_RULE_STATE_DEFINITIONS
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api, internal } from '../../convex/_generated/api'
import { createConvexEncounterStoreReader } from '../../convex/lib/convexEncounterStore'
import { activateFixtureRun } from './activeInitiative'
import { equipAllCharacterItems, setupCharacterRun } from './encounterCharacter'
import { attachRoomWorker, executeInRoom, seedRoomContentSnapshots } from './localRoomWorker'
import { importedSubject, importSeededSubjects } from './publication'
import { setAutoRollDice } from './rollPreferences'
import { srdWolf } from './srdCreatures'

/**
 * An Assisted (or Manual) Run in a live room: the Character acts first against the seeded SRD Wolf,
 * with every item equipped and the table's roll cards enabled. The Character's own features are
 * whatever the caller's Class provides.
 */
export async function setupWolfRun(input: {
  character: Parameters<typeof setupCharacterRun>[0]
  equipment: Parameters<typeof setupCharacterRun>[1]
  name: string
  automationMode?: 'ASSISTED' | 'MANUAL'
  /** Another Creature to fight in place of the Wolf; `prepare` imports whatever its stat block needs. */
  enemy?: {
    creature: CreatureAuthored
    prepare: (base: Awaited<ReturnType<typeof setupCharacterRun>>) => Promise<void>
  }
}) {
  const base = await setupCharacterRun(input.character, input.equipment)
  await attachRoomWorker(base.t)
  await equipAllCharacterItems(base)
  // Table roll cards post to the opened Table chat, which needs a username.
  await base.player.caller.mutation(api.account.updateProfile, {
    username: 'FixtureHero',
    bio: null
  })
  await base.owner.caller.mutation(api.account.updateProfile, { username: 'FixtureGm', bio: null })
  await base.owner.caller.mutation(api.campaigns.conversations.open, {
    campaignId: base.campaign.id,
    kind: 'TABLE'
  })
  for (const { userId } of [base.player, base.owner]) await setAutoRollDice(base.t, userId, true)
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: SRD_RULE_STATE_DEFINITIONS.filter(
      (definition) =>
        definition.id === SRD_ACTION_ALLOWANCE_DEFINITION_ID ||
        definition.id === SRD_ACTOR_ACTION_CAPABILITY_DEFINITION_ID ||
        definition.id === SRD_BONUS_ACTION_ALLOWANCE_DEFINITION_ID
    )
  })
  const enemy = input.enemy?.creature ?? srdWolf
  if (input.enemy) await input.enemy.prepare(base)
  else
    await importSeededSubjects(base.t, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      subjects: [importedSubject({ ...srdWolf, subjectKind: 'CREATURE', document: srdWolf })]
    })
  await seedRoomContentSnapshots(base.campaign.id)
  const blueprint = await base.owner.caller.mutation(api.encounters.blueprints.create, {
    gameSystemId: base.campaign.gameSystemId,
    name: input.name,
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CREATURE', sourceId: enemy.id }]
  })
  const run = await base.owner.caller.mutation(api.encounters.runs.create, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const actor = run.actors.find((candidate) => candidate.kind === 'CHARACTER')
  const wolf = run.actors.find((candidate) => candidate.kind === 'CREATURE')
  if (!actor || !wolf) throw new Error('The Wolf Run fixture actors are missing.')
  const biteActionId = await base.t.run(async (ctx) => {
    await activateFixtureRun(
      ctx,
      run.id,
      { automationMode: input.automationMode ?? 'ASSISTED', round: 1, currentActorId: actor.id },
      [actor.id, wolf.id]
    )
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', run.id))
      .unique()
    if (!row) throw new Error('The Wolf Run fixture Run is missing.')
    const bite = discoverEncounterFeatureActionCapabilities({
      actor: await readRunActor(
        { db: createConvexEncounterStoreReader(ctx) },
        readRunState(row),
        wolf.id
      ),
      conditionDefinitionIds: srdSystemRecord.conditionTypes.map(({ id }) => id),
      abilityDefinitions: (srdSystemRecord.abilities ?? []).map(({ id, code }) => ({ id, code }))
    }).find(
      (capability) => capability.mechanicFacts.invocation.triggerCode === 'MELEE_WEAPON_ATTACK'
    )
    if (!bite) throw new Error('The Wolf offers no Bite.')
    return bite.actionId
  })
  return { ...base, run, actor, wolf, biteActionId }
}

type WolfRun = Awaited<ReturnType<typeof setupWolfRun>>

/** The GM executes one Encounter command on the Run's room. */
export function executeOnRun(
  fixture: Pick<WolfRun, 'owner' | 'run'>,
  command: (base: { encounterId: string; commandId: string }) => EncounterExecuteInput['command']
) {
  return executeInRoom(fixture.owner.caller, {
    command: command({ encounterId: fixture.run.id, commandId: crypto.randomUUID() })
  })
}

/** The actor uses one of its actions on the target; the Run has no Scene, so reach is unchecked (D11). */
export function actOnRun(
  fixture: Pick<WolfRun, 'owner' | 'run'>,
  from: { projection: { version: number } } | null,
  input: { actorId: string; actionId: string; targetActorId: string }
) {
  return executeOnRun(fixture, (base) => ({
    ...base,
    type: 'RESOLVE_ACTION',
    acceptedWieldConflict: null,
    acknowledgedWarnings: ['TARGET_RANGE_UNCHECKED'],
    expectedVersion: from?.projection.version ?? fixture.run.version,
    actorId: input.actorId,
    target: { kind: 'ACTOR', actorId: input.targetActorId },
    actionId: input.actionId,
    optionalCombatIntent: null,
    sceneContext: null
  }))
}
