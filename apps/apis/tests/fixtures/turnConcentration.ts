import { createFunctionHandle, makeFunctionReference } from 'convex/server'
import type {
  CampaignPlaySettingsDto,
  SaveCampaignPlaySettingsInput
} from '@artificer-toolkit/schema/api/campaignSettings'
import type {
  CreateEncounterBlueprintInputDto,
  CreateEncounterInputDto,
  EncounterBlueprintDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { SRD_CONCENTRATION_DEFINITIONS } from '@artificer-toolkit/source-data/srd/concentration.js'
import { SRD_RULE_STATE_DEFINITIONS } from '@artificer-toolkit/source-data/srd/ruleState.js'
import { createEncounterInitiativeDefinitions } from './encounterInitiative'
import { turnCharacterEffectFixture } from './turnActiveEffectFixtures'
import { api, components, internal } from '../../convex/_generated/api'
import { readCharacterRow } from '../../convex/characters/stateDocuments'
import { setAutoRollDice, type FixtureRolls } from './rollPreferences'
import { executeInRoom } from './liveSessionWorker'

const getSettings = makeFunctionReference<'query', { campaignId: string }, CampaignPlaySettingsDto>(
  'campaigns/playSettings:get'
)
const saveSettings = makeFunctionReference<
  'mutation',
  SaveCampaignPlaySettingsInput,
  CampaignPlaySettingsDto
>('campaigns/playSettings:save')

const createBlueprint = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')

export async function turnConcentrationFixture(rolls: FixtureRolls) {
  const base = await turnCharacterEffectFixture()
  await setAutoRollDice(base.t, base.owner.userId, rolls === 'AUTO_ROLL')
  const target = await base.createCharacter()
  await base.player.caller.mutation(api.characters.commit.commit, {
    expectedDraftId: target.draft.id,
    mode: 'create',
    character: target.character
  })
  const targetUser = await base.t.run(async (ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'user',
        data: {
          name: 'Second Character controller',
          email: 'draft_123456abcde2@example.invalid',
          emailVerified: true,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      },
      onCreateHandle: await createFunctionHandle(internal.auth.onCreate)
    })
  )
  const targetSession = await base.t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.create, {
      input: {
        model: 'session',
        data: {
          userId: targetUser._id,
          token: crypto.randomUUID(),
          expiresAt: Date.now() + 60000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
  )
  const targetCaller = base.t.withIdentity({
    subject: targetUser._id,
    sessionId: targetSession._id
  })
  const targetIdentity = await targetCaller.query(api.account.identity, {})
  if (!targetIdentity) throw new Error('Missing second Character controller identity.')
  await base.t.run(async (ctx) => {
    const row = await readCharacterRow(ctx, target.character.id)
    const route = await ctx.db
      .query('authoredRouteIds')
      .withIndex('by_subjectId', (query) => query.eq('subjectId', target.character.id))
      .unique()
    if (!row || !route) throw new Error('Missing second Character ownership rows.')
    // The stored document holds the Builder-owned structure only, so it is not a full Character.
    const document: Record<string, unknown> = {
      ...JSON.parse(row.documentJson),
      userId: targetIdentity.userId
    }
    await ctx.db.patch(row._id, {
      userId: targetIdentity.userId,
      documentJson: canonicalizeRuleDocument(document),
      checksum: checksumRuleDocument(document)
    })
    await ctx.db.patch(row.play._id, { userId: targetIdentity.userId })
    await ctx.db.patch(route._id, { ownerUserId: targetIdentity.userId })
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: base.campaign.id,
      userId: targetIdentity.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: base.campaign.createdAt,
      joinedAt: base.campaign.createdAt,
      leftAt: null
    })
  )
  await targetCaller.mutation(api.campaigns.assignments.assign, {
    campaignId: base.campaign.id,
    characterId: target.character.id
  })
  // Each Character's saves (turn effects, Concentration) follow its controller's preference.
  for (const userId of [base.player.userId, targetIdentity.userId])
    await setAutoRollDice(base.t, userId, rolls === 'AUTO_ROLL')

  const initiative = createEncounterInitiativeDefinitions([
    { procedure: 'ACTOR_ROLL', cadence: 'EACH_ROUND' }
  ])
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: initiative.definitions
  })
  for (let index = 0; index < SRD_RULE_STATE_DEFINITIONS.length; index += 10)
    await base.t.mutation(internal.content.import.importDefinitions, {
      contentSourceId: SRD_CONTENT_SOURCE.id,
      definitions: SRD_RULE_STATE_DEFINITIONS.slice(index, index + 10)
    })
  await base.t.mutation(internal.content.import.importDefinitions, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    definitions: [...SRD_CONCENTRATION_DEFINITIONS]
  })
  const settings = await base.owner.caller.query(getSettings, { campaignId: base.campaign.id })
  const { version, updatedAt: _updatedAt, ...fields } = settings
  await base.owner.caller.mutation(saveSettings, {
    ...fields,
    expectedVersion: version,
    automationMode: 'ASSISTED',
    manualReminderMode: 'OFF',
    initiativePolicyDefinitionId: initiative.policyIds[0]!,
    initiativeTieDefinitionId: null
  })
  const blueprint = await base.owner.caller.mutation(createBlueprint, {
    gameSystemId: base.campaign.gameSystemId,
    name: 'Turn concentration ordering',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'Turn observer', maxHitPoints: 10 }]
  })
  const run = await base.owner.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const observer = run.actors.find((actor) => actor.kind === 'CUSTOM')
  if (!observer) throw new Error('Turn concentration observer is unavailable.')
  const removed = await executeInRoom(base.owner.caller, {
    command: {
      type: 'REMOVE_ACTOR',
      encounterId: run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: run.version,
      actorId: observer.id
    }
  })
  const activeRun = encounterGmProjectionDtoSchema.parse(removed.projection)
  const sourceActor = activeRun.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === base.character.id
  )
  const targetActor = activeRun.actors.find(
    (actor) => actor.kind === 'CHARACTER' && actor.sourceId === target.character.id
  )
  if (!sourceActor || !targetActor)
    throw new Error('Turn concentration Character actors are unavailable.')
  return {
    ...base,
    run: activeRun,
    sourceActor,
    targetActor,
    targetCharacter: target.character,
    targetController: { caller: targetCaller, userId: targetIdentity.userId }
  }
}
