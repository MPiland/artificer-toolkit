import assert from 'node:assert/strict'
import type { ConvexHttpClient } from 'convex/browser'
import type { CreateSocialListingInput } from '@artificer-toolkit/schema/api/socialHub'
import type { ExecuteCampaignRollInput } from '@artificer-toolkit/schema/api/campaignCommunication'
import {
  developmentAccountDeletionInspectResultSchema,
  developmentAccountDeletionKnownSchema,
  type DevelopmentAccountDeletionKnown
} from '@artificer-toolkit/schema/api/developmentAccountDeletion'
import type { FinishCampaignSessionInput } from '@artificer-toolkit/schema/api/campaignSessions'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { api } from '../convex/_generated/api.js'
import { createDevelopmentCharacter } from './developmentCharacterFixture.js'
import { populateCampaignLifecycleInventory } from './developmentCampaignLifecycleInventory.js'
import { populateCampaignLifecycleCharacter } from './developmentCampaignLifecycleCharacter.js'
import { createEncounterLifecycleScenes } from './developmentEncounterScenes.js'
import type { developmentCli } from './developmentCli.js'
import { executeEncounterCommand } from './developmentClient'

type FixtureAuthor = {
  client: ConvexHttpClient
  email: string
  username: string
  identity: { userId: string }
}
type FixtureCli = typeof developmentCli

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}

async function findAuthUserId(cli: FixtureCli, email: string) {
  assert.match(email, /^draft_[0-9a-f]{12}@example\.invalid$/)
  const found = record(
    await cli('adapter:findOne', {
      model: 'user',
      where: [{ field: 'email', value: email }],
      select: ['_id', 'email']
    })
  )
  assert.equal(found.email, email)
  const authUserId = found._id
  if (typeof authUserId !== 'string' || authUserId.length === 0)
    throw new Error('Reserved Better Auth user is missing its native identity.')
  return authUserId
}

function listingInput(campaignId: string): CreateSocialListingInput {
  return {
    campaignId,
    summary: 'F12 account-deletion fixture admission.',
    audience: 'PUBLIC',
    systemId: srdSystemRecord.id,
    playMode: 'ONLINE',
    capacity: 2,
    schedule: { kind: 'FLEXIBLE', timeZone: 'America/Chicago', summary: 'Fixture table' },
    location: null,
    expectations: {
      contentGuidance: 'Fixture content',
      attendancePolicy: 'Fixture attendance',
      allowedContentRules: 'SRD',
      tableConduct: 'Fixture conduct',
      contentBoundaries: 'Fixture boundaries',
      safetyPractices: ['LINES_AND_VEILS'],
      safetyDetails: 'Fixture safety details'
    }
  }
}

async function createCampaign(client: ConvexHttpClient, name: string) {
  return client.mutation(api.campaigns.create.create, {
    name,
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
}

async function captureKnown(input: {
  cli: FixtureCli
  auditorUserId: string
  subjectUserId: string
  authUserId: string
  email: string
}) {
  let known: DevelopmentAccountDeletionKnown | undefined
  for (const scope of ['IDENTITY', 'CHARACTERS', 'AUTHORED', 'DEFERRED'] as const) {
    const result = developmentAccountDeletionInspectResultSchema.parse(
      await input.cli(
        'developmentAccountDeletion:inspect',
        {
          auditorUserId: input.auditorUserId,
          subjectUserId: input.subjectUserId,
          authUserId: input.authUserId,
          email: input.email,
          scope,
          ...(known ? { known } : {})
        },
        false
      )
    )
    known = developmentAccountDeletionKnownSchema.parse(result.known)
  }
  assert.ok(known)
  return known
}

/**
 * Candidate F12 bootstrap. It uses public product commands for all product data;
 * the component CLI is limited to resolving the two reserved Better Auth identities
 * and to the read-only inspector catalogue.
 */
export async function createDevelopmentAccountDeletionFixture<Author extends FixtureAuthor>(input: {
  createAuthor: () => Promise<Author>
  cli: FixtureCli
}) {
  const subject = await input.createAuthor()
  const auditor = await input.createAuthor()
  const [subjectAuthUserId, auditorAuthUserId] = await Promise.all([
    findAuthUserId(input.cli, subject.email),
    findAuthUserId(input.cli, auditor.email)
  ])
  assert.notEqual(subject.identity.userId, auditor.identity.userId)
  assert.notEqual(subjectAuthUserId, auditorAuthUserId)

  const [subjectProfile, auditorProfile] = await Promise.all([
    subject.client.mutation(api.social.profiles.initialize, {}),
    auditor.client.mutation(api.social.profiles.initialize, {})
  ])
  assert.ok(subjectProfile.profilePublicId)
  assert.ok(auditorProfile.profilePublicId)
  await subject.client.mutation(api.notifications.updatePreferences, {
    category: 'SOCIAL',
    inApp: false,
    email: false
  })

  const [ownedArchivedSource, sharedCampaign] = await Promise.all([
    createCampaign(subject.client, 'F12 subject-owned archived Campaign'),
    createCampaign(auditor.client, 'F12 auditor-owned shared Campaign')
  ])
  const ownedArchivedCampaign = await subject.client.mutation(api.campaigns.archive.archive, {
    campaignId: ownedArchivedSource.id,
    expectedVersion: ownedArchivedSource.version
  })
  const ownedActiveCampaign = await createCampaign(
    subject.client,
    'F12 subject-owned active Campaign'
  )

  const listingDraft = await auditor.client.mutation(api.social.listingDrafts.create, {
    input: listingInput(sharedCampaign.id)
  })
  const listing = await auditor.client.mutation(api.social.listings.open, {
    listingPublicId: listingDraft.listingPublicId,
    expectedVersion: listingDraft.version
  })
  const invitation = await auditor.client.mutation(api.social.invitations.create, {
    listingPublicId: listing.listingPublicId,
    expectedListingVersion: listing.version,
    username: subject.username
  })
  await subject.client.mutation(api.social.invitations.accept, {
    invitePublicId: invitation.invitePublicId,
    expectedVersion: invitation.version
  })

  const characterId = crypto.randomUUID()
  const characterFixture = await createDevelopmentCharacter(subject.client, characterId)
  const retainedAuthoredDraft = await subject.client.mutation(api.content.drafts.duplicate, {
    subjectKind: 'EQUIPMENT',
    subjectId: characterFixture.equipment.subjectId
  })
  const inventoryFixture = await populateCampaignLifecycleInventory(
    auditor.client,
    sharedCampaign.id
  )
  const lifecycleCharacter = await populateCampaignLifecycleCharacter({
    owner: auditor.client,
    player: subject.client,
    campaignId: sharedCampaign.id,
    characterId,
    currencySystem: inventoryFixture.currencySystem,
    vehicleIds: [inventoryFixture.vehicles[0].id, inventoryFixture.vehicles[1].id]
  })
  await subject.client.mutation(api.campaigns.contentShares.share, {
    campaignId: sharedCampaign.id,
    subjectKind: 'EQUIPMENT',
    subjectId: characterFixture.equipment.subjectId
  })

  const subjectScenes = await createEncounterLifecycleScenes({
    owner: subject.client,
    campaignId: ownedActiveCampaign.id
  })
  const playSettings = await auditor.client.query(api.campaigns.playSettings.get, {
    campaignId: sharedCampaign.id
  })
  const { version: settingsVersion, updatedAt: _settingsUpdatedAt, ...settings } = playSettings
  await auditor.client.mutation(api.campaigns.playSettings.save, {
    ...settings,
    expectedVersion: settingsVersion,
    automationMode: 'MANUAL',
    initiativePolicyDefinitionId: null,
    initiativeTieDefinitionId: null
  })
  const session = await auditor.client.mutation(api.campaigns.sessions.create, {
    campaignId: sharedCampaign.id,
    title: 'F12 finished retained Session'
  })
  const subjectBlueprint = await subject.client.mutation(api.encounters.blueprints.create, {
    gameSystemId: srdSystemRecord.id,
    name: 'F12 subject-owned Blueprint',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'F12 subject enemy', maxHitPoints: 3 }]
  })
  const blueprint = await auditor.client.mutation(api.encounters.blueprints.create, {
    gameSystemId: srdSystemRecord.id,
    name: 'F12 active retained Run',
    commandId: crypto.randomUUID(),
    enemies: [{ kind: 'CUSTOM', label: 'F12 surviving actor', maxHitPoints: 4 }]
  })
  const run = await auditor.client.mutation(api.encounters.runs.create, {
    campaignId: sharedCampaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  let runVersion = run.version
  for (const [index, actor] of run.actors.entries()) {
    const result = await auditor.client.mutation(executeEncounterCommand, {
      command: {
        type: 'SET_INITIATIVE',
        encounterId: run.id,
        expectedVersion: runVersion,
        commandId: crypto.randomUUID(),
        actorId: actor.id,
        initiative: 20 - index,
        manualOrder: index
      }
    })
    runVersion = result.projection.version
  }
  const started = await auditor.client.mutation(executeEncounterCommand, {
    command: {
      type: 'START',
      encounterId: run.id,
      expectedVersion: runVersion,
      commandId: crypto.randomUUID()
    }
  })
  assert.equal(started.projection.status, 'ACTIVE')
  assert.ok(
    started.projection.actors.some(
      (actor) => actor.kind === 'CHARACTER' && actor.sourceId === characterId
    )
  )
  assert.ok(started.projection.actors.some((actor) => actor.kind !== 'CHARACTER'))

  await subject.client.mutation(api.campaigns.chat.send, {
    campaignId: sharedCampaign.id,
    room: 'TABLE',
    mode: 'OOC',
    body: 'F12 retained subject message',
    clientNonce: crypto.randomUUID()
  })
  const roll: ExecuteCampaignRollInput = {
    campaignId: sharedCampaign.id,
    destination: 'TABLE',
    clientNonce: crypto.randomUUID(),
    roll: {
      characterId,
      expression: '1d20',
      source: { kind: 'MANUAL', label: 'F12 retained subject roll' }
    }
  }
  await subject.client.mutation(api.campaigns.rolls.execute, roll)
  await auditor.client.mutation(api.campaigns.conversations.open, {
    campaignId: sharedCampaign.id,
    kind: 'TABLE'
  })
  const finish: FinishCampaignSessionInput = {
    campaignId: sharedCampaign.id,
    sessionId: session.id,
    commandId: crypto.randomUUID(),
    expectedVersion: session.version
  }
  const finishedSession = await auditor.client.mutation(api.campaigns.sessionFinish.finish, finish)
  assert.equal(finishedSession.status, 'FINISHED')

  const known = await captureKnown({
    cli: input.cli,
    auditorUserId: auditor.identity.userId,
    subjectUserId: subject.identity.userId,
    authUserId: subjectAuthUserId,
    email: subject.email
  })
  const ownedRootIds = new Set([
    characterFixture.equipment.subjectId,
    characterFixture.character.intent.race.raceId,
    characterFixture.character.intent.background.backgroundId,
    ...characterFixture.character.intent.classes.map((entry) => entry.classId),
    retainedAuthoredDraft.subjectId
  ])
  assert.equal(ownedRootIds.size, 5)
  assert.equal(known.sourceIds.length, 1)
  assert.deepEqual(new Set(known.rootReferences.map((reference) => reference.id)), ownedRootIds)
  assert.equal(known.socialProfileId, subjectProfile.profilePublicId)
  assert.deepEqual(known.blueprintIds, [subjectBlueprint.id])
  assert.ok(known.characterIds.includes(characterId))
  assert.ok(known.campaignIds.includes(sharedCampaign.id))
  assert.ok(known.campaignIds.includes(ownedActiveCampaign.id))
  assert.ok(known.campaignIds.includes(ownedArchivedCampaign.id))
  assert.ok(known.mediaAssetIds.includes(subjectScenes.assetId))

  return {
    subject,
    auditor,
    subjectAuthUserId,
    auditorAuthUserId,
    known: developmentAccountDeletionKnownSchema.parse(known),
    campaigns: {
      shared: sharedCampaign,
      ownedActive: ownedActiveCampaign,
      ownedArchived: ownedArchivedCampaign
    },
    ids: {
      characterId,
      equipmentId: characterFixture.equipment.subjectId,
      retainedAuthoredDraftId: retainedAuthoredDraft.subjectId,
      savedCharacterDraftId: lifecycleCharacter.savedDraftId,
      vehicleIds: inventoryFixture.vehicles.map((vehicle) => vehicle.id),
      sharedCampaignId: sharedCampaign.id,
      ownedActiveCampaignId: ownedActiveCampaign.id,
      ownedArchivedCampaignId: ownedArchivedCampaign.id,
      sessionId: session.id,
      sessionNumber: session.sessionNumber,
      runId: run.id,
      blueprintId: blueprint.id,
      subjectBlueprintId: subjectBlueprint.id,
      subjectSceneId: subjectScenes.scenes[0].sceneId,
      subjectSceneAssetId: subjectScenes.assetId
    }
  }
}
