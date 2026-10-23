import assert from 'node:assert/strict'
import { appendFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { ConvexHttpClient } from 'convex/browser'
import { makeFunctionReference } from 'convex/server'
import {
  developmentCampaignInspectionSchema,
  type DevelopmentCampaignFixture,
  type DevelopmentCampaignInspection,
  type DevelopmentCampaignRollbackInput
} from '@artificer-toolkit/schema/api/developmentCampaignLifecycle'
import type {
  CampaignDetailDto,
  DeleteCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import {
  campaignCopyProgressSchema,
  type BeginCampaignCopyInput,
  type CampaignCopyProgress
} from '@artificer-toolkit/schema/api/campaignCopy'
import { campaignStoredCopySchema } from '@artificer-toolkit/schema/projections/campaignCopyPersistence'
import { encounterGmProjectionDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import type {
  CreateSocialListingInput,
  SocialEligibilityDto
} from '@artificer-toolkit/schema/api/socialHub'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { api } from '../convex/_generated/api.js'
import { developmentCli as cli } from './developmentCli'
import {
  createUniformSceneFogLayer,
  type SceneExplorationState
} from '@artificer-toolkit/shared/vtt'
import type { SceneGeometryCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { awaitSceneCheckpoint } from './developmentCheckpoint'
import type { DevelopmentHttpClient } from './developmentHttpClient'
import {
  createEncounterLifecycleScene,
  type EncounterLifecycleSceneOptions
} from './developmentEncounterScenes'
import { bindScene, bindToken } from './developmentEncounterLifecycle'
import { populateCampaignLifecycleInventory } from './developmentCampaignLifecycleInventory'
import { verifyCampaignGmState } from './developmentCampaignGmState'
import { campaignCharacterStateSchema } from '@artificer-toolkit/schema/projections/campaignCharacterState'
import {
  populateCampaignLifecycleCharacter,
  reconcileCampaignDeletionPersonalExpected
} from './developmentCampaignLifecycleCharacter'
import { executeEncounterCommand } from './developmentClient'

const rollback = makeFunctionReference<
  'action',
  DevelopmentCampaignRollbackInput,
  { rolledBack: true }
>('campaigns/developmentLifecycle:verifyDeletionRollback')
export function tables(value: string): Record<string, Record<string, unknown>[]> {
  const decoded: unknown = JSON.parse(value)
  assert.ok(decoded && typeof decoded === 'object' && !Array.isArray(decoded))
  const result: Record<string, Record<string, unknown>[]> = {}
  for (const [key, rows] of Object.entries(decoded)) {
    assert.ok(Array.isArray(rows), key + ' must contain native rows.')
    result[key] = rows.map((row: unknown) => {
      assert.ok(row && typeof row === 'object' && !Array.isArray(row))
      return row as Record<string, unknown>
    })
  }
  return result
}
export function one(scope: Record<string, Record<string, unknown>[]>, key: string) {
  const rows = scope[key]
  assert.ok(rows && rows.length === 1, key + ' must contain exactly one native row.')
  return rows[0]!
}

export async function verifyCampaignLifecycle(input: {
  owner: DevelopmentHttpClient
  player: ConvexHttpClient
  outsider: ConvexHttpClient
  invitee: ConvexHttpClient
  anonymous: ConvexHttpClient
  ownerUserId: string
  playerUserId: string
  outsiderUserId: string
  inviteeUserId: string
  inviteeUsername: string
  characterId: string
  unrelatedCharacterId: string
  deletionSourceStatus?: 'ACTIVE' | 'ARCHIVED'
  onBeforeDeletion: (campaignId: string, before: DevelopmentCampaignInspection) => void
}) {
  const {
    owner,
    player,
    outsider,
    invitee,
    anonymous,
    ownerUserId,
    playerUserId,
    outsiderUserId,
    inviteeUserId,
    inviteeUsername,
    characterId,
    unrelatedCharacterId,
    deletionSourceStatus = 'ACTIVE'
  } = input
  const fixtureUsers = [ownerUserId, playerUserId, outsiderUserId, inviteeUserId]
  let characterFixture: Awaited<ReturnType<typeof populateCampaignLifecycleCharacter>> | undefined
  const socialProfiles: SocialEligibilityDto[] = []
  for (const client of [owner, player, outsider, invitee]) {
    socialProfiles.push(await client.mutation(api.social.profiles.initialize, {}))
    await client.mutation(api.notifications.updatePreferences, {
      category: 'SOCIAL',
      inApp: false,
      email: false
    })
  }
  const evidence: Array<{ stage: string; [key: string]: unknown }> = []
  const fixture = (campaignId: string): DevelopmentCampaignFixture => ({
    ownerUserId,
    campaignId,
    gameSystemId: srdSystemRecord.id,
    userIds: fixtureUsers
  })
  const inspect = async (campaignId: string): Promise<DevelopmentCampaignInspection> =>
    developmentCampaignInspectionSchema.parse(
      await cli('campaigns/developmentLifecycle:inspect', fixture(campaignId), false)
    )
  const stage = (name: string, details: Record<string, unknown>) => {
    evidence.push({ stage: name, journeySourceStatus: deletionSourceStatus, ...details })
    const directory = process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY
    assert.ok(directory, 'Native Campaign lifecycle requires its ignored evidence directory.')
    appendFileSync(
      resolve(directory, 'campaign-lifecycle-stages.jsonl'),
      JSON.stringify({
        stage: name,
        journeySourceStatus: deletionSourceStatus,
        completedAtUtc: new Date().toISOString(),
        ...details
      }) + '\n'
    )
    console.log('Native Campaign lifecycle: ' + name + '.')
  }
  const refuse = async (
    campaignId: string,
    label: string,
    operation: () => Promise<unknown>,
    message: RegExp
  ) => {
    const before = await inspect(campaignId)
    await assert.rejects(operation, message)
    const after = await inspect(campaignId)
    assert.deepEqual(after, before, label + ' preserves the complete native scope.')
    stage(label, { before, after })
  }
  const create = async () => {
    const created = await owner.mutation(api.campaigns.create.create, {
      name: 'Encounter execution fixture',
      description: '<p>Raw private lifecycle description.</p>',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      toneDetails: 'Exact native copy metadata',
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    const state = await inspect(created.id)
    const rows = tables(state.campaignStateJson)
    assert.equal(one(rows, 'campaigns').id, created.id)
    assert.equal(one(rows, 'campaignMemberships').userId, ownerUserId)
    assert.equal(one(rows, 'campaignMemberships').role, 'OWNER')
    assert.equal(one(rows, 'campaignMemberships').status, 'ACTIVE')
    assert.equal(one(rows, 'campaignPlaySettings').campaignId, created.id)
    assert.equal(one(rows, 'authoredRouteIds').publicId, created.publicId)
    assert.equal(one(rows, 'accountUsageEntries').ownerUserId, ownerUserId)
    stage('create-root-membership-defaults-route-usage', { created, state })
    return created
  }
  const notes = async (campaignId: string) => {
    for (const visibility of ['PRIVATE', 'SHARED'] as const)
      await owner.mutation(api.campaigns.notebooks.create, {
        campaignId,
        title: visibility + ' raw notebook',
        content: '<p>' + visibility + ' exact raw content.</p>',
        visibility,
        category: 'PLACES'
      })
    for (let index = 0; index < 9; index++)
      await owner.mutation(api.campaigns.notebooks.create, {
        campaignId,
        title: 'Person ' + index,
        content: '<p>Selected person ' + index + ' exact raw content.</p>',
        visibility: index % 2 ? 'SHARED' : 'PRIVATE',
        category: 'PEOPLE'
      })
    await owner.mutation(api.campaigns.notebooks.create, {
      campaignId,
      title: 'Contextual general note',
      content: '<p>Copied only when explicitly selected.</p>',
      visibility: 'PRIVATE',
      category: 'GENERAL'
    })
  }
  const assertRemoved = async (campaignId: string, before: DevelopmentCampaignInspection) => {
    const deadline = Date.now() + 300_000
    while (true) {
      const status = await owner.query(api.campaigns.deletion.status, { campaignId })
      if (status.status === 'FAILED')
        throw new Error(`Campaign ${campaignId} cleanup failed: ${status.error}`)
      if (status.status === 'DELETED') {
        try {
          assert.equal(
            await cli(
              'campaigns/developmentLifecycle:assertRemoved',
              { fixture: fixture(campaignId), descendants: before.descendants },
              false
            ),
            null
          )
          return
        } catch (error) {
          if (
            !(error instanceof Error) ||
            !/cleanup retains (?:campaignCopyJobs|campaignCopyStagedNotebookSections)\./.test(
              error.message
            )
          )
            throw error
        }
      }
      if (Date.now() >= deadline)
        throw new Error(`Campaign ${campaignId} cleanup timed out at ${status.status}.`)
      await delay(250)
    }
  }
  const remove = async (campaignId: string, proveRollback: boolean) => {
    const before = await inspect(campaignId)
    const campaignRowsBefore = tables(before.campaignStateJson)
    const root = one(campaignRowsBefore, 'campaigns')
    assert.ok(root.status === 'ACTIVE' || root.status === 'ARCHIVED')
    const hostedUsageCount = root.status === 'ACTIVE' ? 1 : 0
    const detachedMapIds = new Set<string>()
    for (const row of [
      ...campaignRowsBefore.campaignScenes!,
      ...campaignRowsBefore.sceneDefinitions!,
      ...campaignRowsBefore.sceneDefinitionSaves!
    ]) {
      const settings = row.settings ?? row
      assert.ok(settings && typeof settings === 'object' && 'map' in settings)
      const map = settings.map
      assert.ok(map && typeof map === 'object' && 'assetId' in map)
      assert.equal(typeof map.assetId, 'string')
      detachedMapIds.add(map.assetId as string)
    }
    assert.equal(typeof root.version, 'number')
    const deletion: DeleteCampaignInput = {
      campaignId,
      expectedVersion: root.version as number,
      confirmation: 'DELETE'
    }
    if (proveRollback) {
      assert.deepEqual(await owner.action(rollback, { fixture: fixture(campaignId), deletion }), {
        rolledBack: true
      })
      assert.deepEqual(await inspect(campaignId), before)
      await assert.rejects(
        owner.query(api.campaigns.deletion.status, { campaignId }),
        /Campaign not found/
      )
      stage('native-deletion-late-rollback', {
        sourceStatus: root.status,
        deletion,
        before,
        after: await inspect(campaignId)
      })
    }
    input.onBeforeDeletion(campaignId, before)
    assert.deepEqual(await owner.mutation(api.campaigns.deletion.remove, deletion), { ok: true })
    const initialStatus = await owner.query(api.campaigns.deletion.status, { campaignId })
    assert.equal(initialStatus.expectedVersion, deletion.expectedVersion)
    assert.ok(initialStatus.status === 'DELETING' || initialStatus.status === 'DELETED')
    assert.equal(initialStatus.error, null)
    for (const client of [owner, player])
      await assert.rejects(
        client.query(api.campaigns.queries.get, { id: campaignId }),
        /Campaign not found/
      )
    stage('native-deletion-fenced', { deletion, initialStatus })
    await assertRemoved(campaignId, before)
    const personalAfterJson = await cli(
      'campaigns/developmentLifecycle:inspectPersonal',
      fixture(campaignId),
      false
    )
    assert.equal(typeof personalAfterJson, 'string')
    const expected = tables(before.personalStateJson)
    const publicListingIds = new Set(
      campaignRowsBefore
        .socialListings!.filter((row) => row.status === 'OPEN' && row.audience === 'PUBLIC')
        .map((row) => String(row.id))
    )
    const usageBeforeCount = expected.accountUsageEntries!.length
    expected.accountUsageEntries = expected.accountUsageEntries!.filter(
      (row) =>
        !(row.resource === 'activeHostedCampaigns' && row.sourceId === campaignId) &&
        !(row.resource === 'publicListings' && publicListingIds.has(String(row.sourceId)))
    )
    assert.equal(
      usageBeforeCount - expected.accountUsageEntries.length,
      hostedUsageCount + publicListingIds.size
    )
    expected.userProfiles = expected.userProfiles!.map((profile) => {
      if (profile.userId !== ownerUserId) return profile
      const usage = profile.entitlementUsage
      assert.ok(usage && typeof usage === 'object' && 'activeHostedCampaigns' in usage)
      assert.equal(typeof usage.activeHostedCampaigns, 'number')
      assert.ok('publicListings' in usage)
      assert.equal(typeof usage.publicListings, 'number')
      assert.ok(Number(usage.activeHostedCampaigns) >= hostedUsageCount)
      assert.ok(Number(usage.publicListings) >= publicListingIds.size)
      return {
        ...profile,
        entitlementUsage: {
          ...usage,
          activeHostedCampaigns: (usage.activeHostedCampaigns as number) - hostedUsageCount,
          publicListings: (usage.publicListings as number) - publicListingIds.size
        }
      }
    })
    const personalAfter = tables(personalAfterJson as string)
    const cancellations = [
      ...campaignRowsBefore
        .socialApplications!.filter((row) => row.status === 'SUBMITTED')
        .map((row) => ({
          recipientUserId: ownerUserId,
          sourcePublicId: row.id,
          workflowKey: 'social-application-submitted'
        })),
      ...campaignRowsBefore
        .campaignInvites!.filter((row) => row.status === 'PENDING')
        .map((row) => ({
          recipientUserId: row.recipientUserId,
          sourcePublicId: row.id,
          workflowKey: 'social-invitation-received'
        }))
    ]
    const nativeCancellationTimes: Array<{ intentId: string; cancelledAt: string }> = []
    expected.notificationDeliveryIntents = expected.notificationDeliveryIntents!.map((intent) => {
      if (
        !cancellations.some(
          (target) =>
            target.recipientUserId === intent.recipientUserId &&
            target.sourcePublicId === intent.sourcePublicId &&
            target.workflowKey === intent.workflowKey
        )
      )
        return intent
      assert.equal(
        intent.status,
        'DISPATCHED',
        'Real cron must establish the stable retained baseline.'
      )
      assert.equal(intent.cancelledAt, null)
      const actual = personalAfter.notificationDeliveryIntents!.find(
        (row) => row._id === intent._id
      )
      assert.ok(actual, 'Deletion retains the exact producer intent identity.')
      assert.equal(actual.status, 'CANCELLED')
      assert.equal(typeof actual.cancelledAt, 'string')
      assert.equal(new Date(actual.cancelledAt as string).toISOString(), actual.cancelledAt)
      nativeCancellationTimes.push({
        intentId: String(intent.id),
        cancelledAt: actual.cancelledAt as string
      })
      return { ...intent, status: 'CANCELLED', cancelledAt: actual.cancelledAt }
    })
    assert.equal(
      nativeCancellationTimes.length,
      cancellations.length,
      'Each actual pending admission producer must cancel its one exact retained notification intent.'
    )
    const nativeGrace24h: Array<{ assetId: string; cleanupAt: number }> = []
    expected.mediaAssets = expected.mediaAssets!.map((asset) => {
      if (!detachedMapIds.has(String(asset.id))) return asset
      assert.equal(asset.profileClass, 'VTT_MAP')
      assert.equal(asset.hasSceneReferences, true)
      const actual = personalAfter.mediaAssets!.find((row) => row.id === asset.id)
      assert.ok(actual, 'Detached map remains uploader-owned until normal cleanup.')
      assert.equal(typeof actual.cleanupAt, 'number')
      assert.ok(Number.isSafeInteger(actual.cleanupAt))
      nativeGrace24h.push({ assetId: String(asset.id), cleanupAt: actual.cleanupAt as number })
      return { ...asset, hasSceneReferences: false, cleanupAt: actual.cleanupAt }
    })
    assert.equal(nativeGrace24h.length, detachedMapIds.size)
    let characterReconciliation:
      | ReturnType<typeof reconcileCampaignDeletionPersonalExpected>
      | undefined
    if (campaignRowsBefore.campaignCharacterAssignments!.length > 0) {
      assert.ok(characterFixture)
      assert.equal(campaignRowsBefore.campaignCharacterAssignments!.length, 1)
      const fenceTimeMs = Date.parse(initialStatus.updatedAt)
      assert.ok(Number.isFinite(fenceTimeMs))
      if (root.status === 'ACTIVE') {
        assert.equal(nativeCancellationTimes.length, 2)
        const times = nativeCancellationTimes.map((row) => Date.parse(row.cancelledAt))
        assert.equal(
          times[0],
          times[1],
          'Both admission cancellations share the exact native mutation clock.'
        )
        assert.equal(times[0], fenceTimeMs)
      } else {
        assert.equal(nativeCancellationTimes.length, 0, 'Archive already cancelled admission.')
        assert.ok(nativeGrace24h.length > 0, 'Full archived fixture must retain its attached maps.')
        const times = nativeGrace24h.map((row) => row.cleanupAt - 24 * 60 * 60 * 1000)
        assert.ok(
          times.every((time) => time === times[0]),
          'All detached maps use the same native mutation clock.'
        )
        assert.ok(times[0]! >= fenceTimeMs)
      }
      assert.equal(typeof root.updatedAt, 'string')
      assert.ok(
        fenceTimeMs >= Date.parse(root.updatedAt as string) + 1,
        'The deletion fence must advance the Campaign timestamp.'
      )
      characterReconciliation = reconcileCampaignDeletionPersonalExpected({
        expected,
        actual: personalAfter,
        campaign: campaignRowsBefore,
        characterId,
        backgroundId: characterFixture.backgroundId,
        fenceTimeMs
      })
      const repaired = await player.query(api.characters.builder.activeCharacter, {
        id: characterId
      })
      assert.ok(repaired)
      assert.equal(repaired.status, 'DRAFT')
      assert.equal(repaired.intent.background.backgroundId, '')
      await assert.rejects(
        player.query(api.characters.sheet.get, { id: characterId }),
        /Builder repair/i
      )
      for (const client of [owner, player])
        await assert.rejects(
          client.query(api.campaigns.characterSheet.get, { campaignId, characterId }),
          /Campaign not found|Assigned Character not found/i
        )
    }
    assert.deepEqual(
      personalAfter,
      expected,
      'DELETE preserves complete personal data except exact usage, intent cancellation, map grace and assigned Character source/currency reconciliation.'
    )
    // Native execution timestamps verify the generated 24-hour grace after both collector and command finish.
    for (const client of [owner, player])
      await assert.rejects(
        client.query(api.campaigns.queries.get, { id: campaignId }),
        /Campaign not found/
      )
    const afterBeforeRepeat = await cli(
      'campaigns/developmentLifecycle:inspectPersonal',
      fixture(campaignId),
      false
    )
    assert.deepEqual(await owner.mutation(api.campaigns.deletion.remove, deletion), { ok: true })
    assert.equal(
      (await owner.query(api.campaigns.deletion.status, { campaignId })).status,
      'DELETED'
    )
    assert.equal(
      await cli('campaigns/developmentLifecycle:inspectPersonal', fixture(campaignId), false),
      afterBeforeRepeat
    )
    await assertRemoved(campaignId, before)
    stage('native-deletion-complete-scope-personal-retention-repeat', {
      sourceStatus: root.status,
      deletion,
      before,
      personalAfterJson,
      nativeGrace24h,
      nativeCancellationTimes,
      characterReconciliation
    })
  }
  const copy = async (
    source: CampaignDetailDto,
    notebookCategories: CampaignCopyProgress['notebookCategories']
  ) => {
    const before = await inspect(source.id)
    const command: BeginCampaignCopyInput = {
      campaignId: source.id,
      expectedVersion: source.version,
      commandId: crypto.randomUUID(),
      notebookCategories
    }
    const begun = campaignCopyProgressSchema.parse(
      await owner.mutation(api.campaigns.copyJobs.begin, command)
    )
    assert.equal(begun.status, notebookCategories.length ? 'RUNNING' : 'COMPLETED')
    if (begun.status === 'RUNNING') assert.equal(begun.destination, null)
    const observed: CampaignCopyProgress[] = [begun]
    const deadline = Date.now() + 30_000
    let completed = begun
    while (completed.status !== 'COMPLETED') {
      assert.equal(
        completed.status,
        'RUNNING',
        'A required native copy must complete successfully.'
      )
      assert.ok(
        Date.now() < deadline,
        'Native selected copy did not complete its bounded workload.'
      )
      await delay(250)
      completed = campaignCopyProgressSchema.parse(
        await owner.query(api.campaigns.copyJobs.progress, { copyId: begun.copyId })
      )
      if (JSON.stringify(completed) !== JSON.stringify(observed.at(-1))) observed.push(completed)
    }
    const copied = completed.destination
    assert.ok(copied)
    assert.notEqual(copied.id, source.id)
    assert.notEqual(copied.publicId, source.publicId)
    assert.equal(copied.status, 'ACTIVE')
    assert.equal(copied.version, 0)
    const destination = await inspect(copied.id)
    const sourceRows = tables(before.campaignStateJson)
    const targetRows = tables(destination.campaignStateJson)
    const sourceRoot = one(sourceRows, 'campaigns')
    const targetRoot = one(targetRows, 'campaigns')
    const expectedRoot: Record<string, unknown> = {
      ...sourceRoot,
      _id: targetRoot._id,
      _creationTime: targetRoot._creationTime,
      id: copied.id,
      publicId: copied.publicId,
      status: 'ACTIVE',
      version: 0,
      createdAt: targetRoot.createdAt,
      updatedAt: targetRoot.updatedAt
    }
    // Source-only invalidation markers are independent of the fresh destination identity.
    delete expectedRoot.notebookRevision
    assert.deepEqual(targetRoot, expectedRoot, 'Copy retains every raw metadata field.')
    assert.equal(targetRoot.createdAt, targetRoot.updatedAt)
    assert.equal(one(targetRows, 'campaignMemberships').role, 'OWNER')
    const selectedCategories = new Set<string>(notebookCategories)
    const originalNotes = sourceRows
      .campaignNotebookSections!.filter((row) => selectedCategories.has(String(row.category)))
      .sort((a, b) => String(a.title).localeCompare(String(b.title)))
    const copiedNotes = [...targetRows.campaignNotebookSections!].sort((a, b) =>
      String(a.title).localeCompare(String(b.title))
    )
    assert.equal(sourceRows.campaignNotebookSections!.length, 12)
    assert.equal(copiedNotes.length, notebookCategories.length ? 12 : 0)
    assert.equal(completed.copiedSections, originalNotes.length)
    for (const [index, target] of copiedNotes.entries()) {
      const original = originalNotes[index]!
      assert.notEqual(target.id, original.id)
      assert.notEqual(target._id, original._id)
      assert.equal(target.createdAt, target.updatedAt)
      assert.deepEqual(
        target,
        {
          ...original,
          _id: target._id,
          _creationTime: target._creationTime,
          id: target.id,
          campaignId: copied.id,
          version: 0,
          authorUserId: ownerUserId,
          updatedBy: ownerUserId,
          createdAt: target.createdAt,
          updatedAt: target.updatedAt
        },
        'Copy retains the complete selected raw notebook row with fresh identity and authorship.'
      )
    }
    const allowed = new Set([
      'campaigns',
      'campaignMemberships',
      'campaignPlaySettings',
      'campaignNotebookSections',
      'authoredRouteIds',
      'accountUsageEntries',
      'sceneVisionRevisions'
    ])
    for (const [key, value] of Object.entries(targetRows))
      if (!allowed.has(key)) assert.deepEqual(value, [], 'Copy excludes aggregate ' + key + '.')
    const sourceAfter = await inspect(source.id)
    const afterRows = tables(sourceAfter.campaignStateJson)
    for (const [key, value] of Object.entries(sourceRows))
      if (key !== 'campaignEvents' && key !== 'campaignCopyJobs')
        assert.deepEqual(afterRows[key], value, 'Copy preserves source ' + key + '.')
    const copyEvent = afterRows.campaignEvents!.find((row) => row.commandId === command.commandId)
    assert.ok(copyEvent)
    assert.equal(copyEvent.type, 'CAMPAIGN_COPIED')
    assert.equal(copyEvent.actorUserId, ownerUserId)
    assert.equal(copyEvent.visibleInHistory, false)
    assert.equal(copyEvent.visibility, 'OWNER')
    assert.deepEqual(
      afterRows.campaignEvents!.filter((row) => row.commandId !== command.commandId),
      sourceRows.campaignEvents,
      'Copy preserves every pre-existing raw Campaign event.'
    )
    assert.equal(afterRows.campaignEvents!.length, sourceRows.campaignEvents!.length + 1)
    assert.deepEqual(JSON.parse(String(copyEvent.payloadJson)), {
      copiedCampaignId: copied.id,
      expectedVersion: source.version
    })
    const rawJob = afterRows.campaignCopyJobs!.find((row) => row.id === begun.copyId)
    assert.ok(rawJob)
    const { _id, _creationTime, ...jobValue } = rawJob
    const job = campaignStoredCopySchema.parse(jobValue)
    assert.equal(job.ownerUserId, ownerUserId)
    assert.equal(job.status, 'COMPLETED')
    assert.equal(job.destinationCampaignId, copied.id)
    assert.deepEqual(job.command, command)
    assert.equal(job.inputFingerprint, copyEvent.inputFingerprint)
    assert.equal(job.copiedSections, originalNotes.length)
    assert.equal(job.failureReason, null)
    assert.deepEqual(
      afterRows.campaignCopyJobs!.filter((row) => row.id !== begun.copyId),
      sourceRows.campaignCopyJobs,
      'Copy preserves every pre-existing private job.'
    )
    assert.equal(afterRows.campaignCopyJobs!.length, sourceRows.campaignCopyJobs!.length + 1)
    assert.deepEqual(afterRows.campaignCopyStagedNotebookSections, [])
    const replayBefore = { source: sourceAfter, destination: await inspect(copied.id) }
    assert.deepEqual(await owner.mutation(api.campaigns.copyJobs.begin, command), completed)
    assert.deepEqual(
      { source: await inspect(source.id), destination: await inspect(copied.id) },
      replayBefore
    )
    await refuse(
      source.id,
      'copy-command-input-collision',
      () =>
        owner.mutation(api.campaigns.copyJobs.begin, {
          ...command,
          expectedVersion: command.expectedVersion + 1
        }),
      /different input/
    )
    stage(
      'copy-' +
        source.status.toLowerCase() +
        (notebookCategories.length ? '-selected-background' : '-metadata-only') +
        '-exact-replay',
      {
        command,
        before,
        begun,
        observed,
        completed,
        copied,
        destination,
        sourceAfter
      }
    )
    await remove(copied.id, false)
    await refuse(
      source.id,
      'copy-replay-checks-current-destination-authority',
      () => owner.mutation(api.campaigns.copyJobs.begin, command),
      /Campaign not found/
    )
  }

  let campaign = await create()
  await notes(campaign.id)
  await cli(
    'encounters/developmentCampaign:admitFixturePlayer',
    { ownerUserId, playerUserId, campaignId: campaign.id },
    false
  )
  const inventoryFixture = await populateCampaignLifecycleInventory(owner, campaign.id)
  characterFixture = await populateCampaignLifecycleCharacter({
    owner,
    player,
    campaignId: campaign.id,
    characterId,
    currencySystem: inventoryFixture.currencySystem,
    vehicleIds: [inventoryFixture.vehicles[0].id, inventoryFixture.vehicles[1].id]
  })
  await verifyCampaignGmState({
    owner,
    player,
    outsider,
    ownerUserId,
    campaignId: campaign.id,
    characterId,
    unrelatedCharacterId,
    inspect: () => inspect(campaign.id),
    onStage: (name, details) => stage('gm-' + name, details)
  })
  const deletionOverlay = await owner.mutation(api.campaigns.gmWrites.saveAdjustment, {
    campaignId: campaign.id,
    characterId,
    expectedVersion: 0,
    visibility: 'SECRET',
    adjustment: {
      family: 'HIT_POINTS',
      field: 'MAXIMUM_MODIFIER',
      value: 1,
      sourceNote: 'P09 secret overlay is removed with its Campaign.'
    }
  })
  assert.deepEqual(
    await owner.query(api.campaigns.gmReads.adjustments, {
      campaignId: campaign.id,
      characterId
    }),
    [deletionOverlay]
  )
  const populated = await inspect(campaign.id)
  const populatedRows = tables(populated.campaignStateJson)
  const activeCharacters = tables(populated.personalStateJson).characters!.filter(
    (row) => row.id === characterId
  )
  assert.equal(activeCharacters.length, 1)
  assert.equal(
    activeCharacters[0]!.status,
    'ACTIVE',
    'The native committed Character stays active while its private edit draft is saved.'
  )
  for (const family of [
    'campaignCharacterAssignments',
    'campaignCharacterStates',
    'campaignContentShares',
    'campaignPartyInventories',
    'campaignPartyItems',
    'campaignPartyCurrencies',
    'campaignPartyCurrencyGroups',
    'campaignCurrencySystems',
    'campaignCurrencyDenominations',
    'campaignVehicles'
  ])
    assert.ok(populatedRows[family]!.length > 0, 'Real public producer must populate ' + family)
  const deletionOverlayRow = one(populatedRows, 'campaignCharacterStates')
  assert.equal(deletionOverlayRow.characterId, characterId)
  assert.equal(deletionOverlayRow.campaignId, campaign.id)
  assert.ok(typeof deletionOverlayRow.documentJson === 'string')
  assert.deepEqual(
    campaignCharacterStateSchema.parse(JSON.parse(deletionOverlayRow.documentJson)),
    { adjustments: [{ ...deletionOverlay, createdBy: ownerUserId }], conditions: [] }
  )
  stage('gm-overlay-produced-for-native-deletion', {
    adjustment: deletionOverlay,
    rawOverlay: deletionOverlayRow
  })
  const assignment = one(populatedRows, 'campaignCharacterAssignments')
  assert.equal(assignment.characterId, characterId)
  assert.equal(assignment.userId, playerUserId)
  assert.equal(populatedRows.campaignPartyCurrencyGroups!.length, 3)
  for (const expectedGroup of characterFixture.stableGroups) {
    for (const groupId of expectedGroup.groupIds) {
      const groups = populatedRows.campaignPartyCurrencyGroups!.filter((row) => row.id === groupId)
      assert.equal(groups.length, 1)
      const group = groups[0]!
      assert.equal(group.vehicleId, expectedGroup.vehicleId)
      assert.equal(group.containerId, expectedGroup.bagId)
      const balances = populatedRows.campaignPartyCurrencies!.filter(
        (row) => row.groupId === groupId
      )
      assert.equal(balances.length, 1)
      const balance = balances[0]!
      assert.equal(balance.vehicleId, expectedGroup.vehicleId)
      assert.equal(balance.containerId, expectedGroup.bagId)
      assert.equal(balance.campaignCurrencySystemId, inventoryFixture.currencySystem.id)
      assert.equal(balance.denominationId, expectedGroup.denominationId)
      assert.equal(balance.amount, 0)
    }
  }
  assert.equal(populatedRows.campaignVehicles!.length, 2)
  assert.equal(populatedRows.campaignCurrencySystems!.length, 1)
  assert.equal(populatedRows.campaignCurrencyDenominations!.length, 2)
  assert.equal(
    tables(populated.personalStateJson).characters!.filter((row) => row.id === unrelatedCharacterId)
      .length,
    1
  )
  stage('populated-assigned-character-private-state-party-vehicles-bigint-currency', {
    inventoryFixture,
    characterFixture,
    unrelatedCharacterId,
    state: populated
  })
  campaign = await owner.query(api.campaigns.queries.get, { id: campaign.id })
  campaign = await owner.mutation(api.campaigns.update.update, {
    campaignId: campaign.id,
    expectedVersion: campaign.version,
    description: '<p>Updated raw native description.</p>',
    attunementSlotOverride: 4
  })
  await refuse(
    campaign.id,
    'update-stale-version',
    () =>
      owner.mutation(api.campaigns.update.update, {
        campaignId: campaign.id,
        expectedVersion: campaign.version - 1,
        name: 'Stale must not persist'
      }),
    /changed before/
  )
  const competitors = await Promise.allSettled(
    ['first', 'second'].map((suffix) =>
      owner.mutation(
        api.campaigns.update.update,
        {
          campaignId: campaign.id,
          expectedVersion: campaign.version,
          toneDetails: 'Winning native metadata ' + suffix
        },
        { skipQueue: true }
      )
    )
  )
  assert.equal(competitors.filter((result) => result.status === 'fulfilled').length, 1)
  const rejected = competitors.find((result) => result.status === 'rejected')
  assert.ok(
    rejected?.status === 'rejected' &&
      rejected.reason instanceof Error &&
      /changed before/.test(rejected.reason.message)
  )
  campaign = await owner.query(api.campaigns.queries.get, { id: campaign.id })
  stage('update-current-owner-version-concurrent-winner', {
    competitors: competitors.map((result) => result.status),
    campaign,
    state: await inspect(campaign.id)
  })
  const listingInput: CreateSocialListingInput = {
    campaignId: campaign.id,
    summary: 'Native pending admission deletion proof',
    audience: 'PUBLIC',
    systemId: srdSystemRecord.id,
    playMode: 'ONLINE',
    capacity: 4,
    schedule: { kind: 'FLEXIBLE', timeZone: 'America/Chicago', summary: 'Flexible native fixture' },
    location: null,
    expectations: {
      contentGuidance: 'Adventure',
      attendancePolicy: 'Tell us',
      allowedContentRules: 'SRD',
      tableConduct: 'Be kind',
      contentBoundaries: 'Discuss together',
      safetyPractices: ['LINES_AND_VEILS'],
      safetyDetails: 'Pause when needed'
    }
  }
  const listingDraft = await owner.mutation(api.social.listingDrafts.create, {
    input: listingInput
  })
  const listing = await owner.mutation(api.social.listings.open, {
    listingPublicId: listingDraft.listingPublicId,
    expectedVersion: listingDraft.version
  })
  const application = await outsider.mutation(api.social.applications.submit, {
    listingPublicId: listing.listingPublicId,
    expectedListingVersion: listing.version,
    message: 'Exact pending native application'
  })
  const invitation = await owner.mutation(api.social.invitations.create, {
    listingPublicId: listing.listingPublicId,
    expectedListingVersion: listing.version,
    username: inviteeUsername
  })
  const outsiderProfile = socialProfiles[2]!
  assert.equal(outsiderProfile.eligible, true)
  assert.equal(typeof outsiderProfile.profilePublicId, 'string')
  const unrelatedBlock = await player.mutation(api.social.blocks.create, {
    profilePublicId: outsiderProfile.profilePublicId!
  })
  const admissionState = await inspect(campaign.id)
  const admissionRows = tables(admissionState.campaignStateJson)
  assert.equal(one(admissionRows, 'socialListings').status, 'OPEN')
  assert.equal(one(admissionRows, 'socialApplications').status, 'SUBMITTED')
  assert.equal(one(admissionRows, 'campaignInvites').status, 'PENDING')
  const admissionPersonal = tables(admissionState.personalStateJson)
  assert.equal(admissionPersonal.socialProfiles!.length, 4)
  assert.equal(admissionPersonal.socialBlocks!.length, 1)
  assert.equal(admissionPersonal.socialBlockInvalidations!.length, 1)
  stage('populated-native-pending-admission-unrelated-social', {
    listingDraft,
    listing,
    application,
    invitation,
    unrelatedBlock,
    state: admissionState
  })
  const session = await owner.mutation(api.campaigns.sessions.create, {
    campaignId: campaign.id,
    title: 'Native deletion Session'
  })
  await player.mutation(api.campaigns.sessionRsvps.set, {
    campaignId: campaign.id,
    sessionId: session.id,
    response: 'YES'
  })
  for (const visibility of ['PRIVATE', 'SHARED'] as const)
    await owner.mutation(api.campaigns.sessionNotes.create, {
      campaignId: campaign.id,
      sessionId: session.id,
      title: visibility + ' Session note',
      content: '<p>Exact Session payload.</p>',
      visibility,
      kind: visibility === 'SHARED' ? 'NOTE' : 'SECRET'
    })
  const notebookPage = await owner.query(api.campaigns.notebooks.list, {
    campaignId: campaign.id,
    paginationOpts: { cursor: null, numItems: 8 }
  })
  const noteSectionId = notebookPage.page[0]?.id
  assert.ok(noteSectionId, 'The populated notebook must provide a note for the Session reference.')
  await owner.mutation(api.campaigns.sessionReferences.create, {
    campaignId: campaign.id,
    sessionId: session.id,
    target: { kind: 'CAMPAIGN_NOTE', noteSectionId }
  })
  await owner.mutation(api.campaigns.clock.initialize, {
    campaignId: campaign.id,
    commandId: crypto.randomUUID(),
    expectedVersion: 0,
    day: 1,
    minuteOfDay: 60,
    dawnMinute: 360,
    duskMinute: 1080
  })
  const blueprint = await owner.mutation(api.encounters.blueprints.create, {
    gameSystemId: srdSystemRecord.id,
    name: 'Native Campaign personal Blueprint',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CUSTOM', label: 'First native enemy', maxHitPoints: 3 },
      { kind: 'CUSTOM', label: 'Second native enemy', maxHitPoints: 4 }
    ]
  })
  const playSettings = await owner.query(api.campaigns.playSettings.get, {
    campaignId: campaign.id
  })
  const {
    version: playSettingsVersion,
    updatedAt: _playSettingsUpdatedAt,
    ...playSettingsFields
  } = playSettings
  await owner.mutation(api.campaigns.playSettings.save, {
    ...playSettingsFields,
    expectedVersion: playSettingsVersion,
    automationMode: 'MANUAL',
    initiativePolicyDefinitionId: null,
    initiativeTieDefinitionId: null
  })
  // Chat is Convex's until the live table opens with the Run's first room command.
  for (const room of ['TABLE', 'PARTY', 'DIRECT'] as const)
    await player.mutation(api.campaigns.chat.send, {
      campaignId: campaign.id,
      room,
      mode: 'OOC',
      body: room + ' native payload',
      clientNonce: crypto.randomUUID(),
      ...(room === 'DIRECT' ? { directUserId: ownerUserId } : {})
    })
  let run = await owner.mutation(api.encounters.runs.create, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  assert.equal(run.automationMode, 'MANUAL')
  assert.equal(run.initiativePolicy, null)
  for (const [index, actor] of run.actors.entries()) {
    const result = await owner.mutation(executeEncounterCommand, {
      command: {
        type: 'SET_INITIATIVE',
        encounterId: run.id,
        expectedVersion: run.version,
        commandId: crypto.randomUUID(),
        actorId: actor.id,
        initiative: 20 - index,
        manualOrder: index
      }
    })
    run = encounterGmProjectionDtoSchema.parse(result.projection)
  }
  const started = await owner.mutation(executeEncounterCommand, {
    command: {
      type: 'START',
      encounterId: run.id,
      expectedVersion: run.version,
      commandId: crypto.randomUUID()
    }
  })
  assert.equal(started.projection.status, 'ACTIVE')
  run = encounterGmProjectionDtoSchema.parse(started.projection)
  assert.equal(run.actors.length, 3)
  assert.equal(
    run.actors.filter((actor) => actor.kind === 'CHARACTER' && actor.sourceId === characterId)
      .length,
    1
  )
  const sceneToken = (index: number): EncounterLifecycleSceneOptions['tokens'][number] => ({
    id: crypto.randomUUID(),
    assetId: null,
    controlledByUserIds: run.actors[index]!.sourceId === characterId ? [playerUserId] : [],
    height: 8,
    hidden: false,
    label: run.actors[index]!.label,
    locked: false,
    position: { x: 8 + index * 24, y: 8 },
    rotationDegrees: 0,
    senses: [],
    vision: null,
    width: 8
  })
  const sceneOptions: EncounterLifecycleSceneOptions = {
    map: { width: 64, height: 64 },
    grid: {
      kind: 'SQUARE',
      origin: { x: 0, y: 0 },
      cellSize: 16,
      distancePerCell: 5,
      diagonalPolicy: 'EQUAL',
      unit: 'FEET'
    },
    tokens: [sceneToken(0), sceneToken(1), sceneToken(2)]
  }
  const scene = await createEncounterLifecycleScene({
    owner,
    campaignId: campaign.id,
    name: 'Native Campaign lifecycle Scene',
    options: sceneOptions
  })
  const presentation = await owner.action(api.scenes.presentations.setLive, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    campaignId: campaign.id,
    sceneId: scene.liveSceneId,
    expectedPresentationVersion: null
  })
  const sceneBinding = await owner.mutation(bindScene, {
    type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
    encounterId: run.id,
    commandId: crypto.randomUUID()
  })
  assert.equal(sceneBinding.sceneId, scene.liveSceneId)
  run = encounterGmProjectionDtoSchema.parse(
    await owner.query(api.encounters.projectionReads.get, { encounterId: run.id })
  )
  assert.equal(run.automationMode, 'MANUAL')
  assert.equal(run.initiativePolicy, null)
  for (const [index, actor] of run.actors.entries()) {
    run = encounterGmProjectionDtoSchema.parse(
      (
        await owner.mutation(bindToken, {
          input: {
            type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
            commandId: crypto.randomUUID(),
            encounterId: run.id,
            expectedEncounterVersion: run.version,
            actorId: actor.id,
            sceneId: scene.liveSceneId,
            tokenId: scene.tokenIds[index]!
          }
        })
      ).projection
    )
  }
  const geometryInput: SceneGeometryCommandInputDto = {
    sceneId: scene.liveSceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: (
      await owner.query(api.scenes.recipientReads.header, { sceneId: scene.liveSceneId })
    ).version,
    type: 'UPSERT_SCENE_BARRIER',
    barrier: {
      id: crypto.randomUUID(),
      kind: 'DOOR',
      a: { x: 0, y: 48 },
      b: { x: 64, y: 48 },
      blocksLightWhenClosed: true,
      blocksMovementWhenClosed: true,
      initialState: 'CLOSED',
      openAngleDegrees: 90
    }
  }
  const geometry = await owner.executeSceneCommand(geometryInput)
  assert.equal(geometry.result?.replayed, false)
  assert.equal(geometry.result?.occurrence, null)
  const exploration: SceneExplorationState = {
    map: { ...sceneOptions.map, assetId: scene.assetId, tileManifestAssetId: null },
    grid: sceneOptions.grid,
    tokens: sceneOptions.tokens,
    barriers: [geometryInput.barrier],
    doorStates: { [geometryInput.barrier.id]: 'CLOSED' },
    fogMode: 'PER_PLAYER',
    fogLayers: []
  }
  const fogLayer = createUniformSceneFogLayer(exploration, {
    explored: true,
    ownerUserId: playerUserId
  })
  const fog = await owner.executeSceneFog({
    type: 'PATCH_SCENE_FOG',
    sceneId: scene.liveSceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: geometry.version,
    layer: fogLayer
  })
  assert.equal(fog.version, geometry.version + 1)
  const receivingDefinition = await owner.mutation(api.scenes.definitions.begin, {
    commandId: crypto.randomUUID(),
    sceneId: null,
    expectedVersion: null,
    settings: {
      campaignId: campaign.id,
      name: 'Native receiving Scene definition',
      ambientIllumination: 'BRIGHT',
      fogMode: 'PER_PLAYER',
      visionRevealMode: 'ON_DRAG',
      grid: sceneOptions.grid,
      map: { ...sceneOptions.map, assetId: scene.assetId, tileManifestAssetId: null }
    },
    counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 1 }
  })
  await owner.mutation(api.scenes.definitions.append, {
    input: {
      saveId: receivingDefinition.saveId,
      collection: 'tokens',
      offset: 0,
      entities: [
        { ...sceneOptions.tokens[0], id: crypto.randomUUID(), label: 'Receiving definition token' }
      ]
    }
  })
  // Room commits reach Convex at a checkpoint; deletion must remove the rows that checkpoint wrote.
  await awaitSceneCheckpoint(owner, scene.liveSceneId, fog.version)
  const sceneState = await inspect(campaign.id)
  const sceneRows = tables(sceneState.campaignStateJson)
  for (const family of [
    'campaignScenes',
    'sceneDefinitions',
    'sceneDefinitionSaves',
    'sceneDefinitionEntities',
    'sceneLiveEntities',
    'sceneLiveStates',
    'sceneFogSaves',
    'sceneFogLayers',
    'sceneFogChunks',
    'campaignScenePresentations',
    'encounterSceneBindings',
    'encounterActorTokenBindings'
  ])
    assert.ok(sceneRows[family]!.length > 0, 'Real public producer must populate ' + family)
  assert.ok(
    sceneRows.sceneDefinitionSaves!.some(
      (row) => row.id === receivingDefinition.saveId && row.status === 'RECEIVING'
    )
  )
  stage('populated-native-scene-map-bindings-geometry-fog-receiving', {
    scene,
    presentation,
    sceneBinding,
    geometryInput,
    geometry,
    fog,
    receivingDefinition,
    state: sceneState
  })
  stage('populated-session-notebooks-clock-run-initiative-chat', {
    state: await inspect(campaign.id),
    blueprint
  })
  // Use the existing native notification proof's three-minute/5-second polling bound.
  // Real cron delivery with channels disabled gives a stable retained baseline; admission decisions stay pending.
  const admissionSourceIds = new Set([
    String(one(admissionRows, 'socialApplications').id),
    String(one(admissionRows, 'campaignInvites').id)
  ])
  const notificationDeadline = Date.now() + 180_000
  let stableAdmissionState: DevelopmentCampaignInspection | null = null
  while (Date.now() < notificationDeadline) {
    const current = await inspect(campaign.id)
    const intents = tables(current.personalStateJson).notificationDeliveryIntents!.filter((row) =>
      admissionSourceIds.has(String(row.sourcePublicId))
    )
    assert.equal(
      intents.length,
      2,
      'Both real admission producers must retain their exact intents.'
    )
    assert.ok(intents.every((row) => row.status === 'PENDING' || row.status === 'DISPATCHED'))
    if (intents.every((row) => row.status === 'DISPATCHED')) {
      for (const intent of intents) {
        assert.equal(intent.attemptCount, 0)
        assert.equal(intent.feedRecorded, false)
        assert.equal(intent.providerEmailId, null)
      }
      stableAdmissionState = current
      break
    }
    await delay(5000)
  }
  assert.ok(
    stableAdmissionState,
    'Actual native notification cron must finish within its original three-minute bound.'
  )
  stage('native-admission-notification-stable-baseline', { state: stableAdmissionState })
  if (deletionSourceStatus === 'ARCHIVED') {
    const beforeArchive = await inspect(campaign.id)
    const archiveRows = tables(beforeArchive.campaignStateJson)
    const archivePersonal = tables(beforeArchive.personalStateJson)
    const rootBefore = one(archiveRows, 'campaigns')
    const current = await owner.query(api.campaigns.queries.get, { id: campaign.id })
    assert.equal(rootBefore.status, 'ACTIVE')
    assert.equal(rootBefore.version, current.version)
    campaign = await owner.mutation(api.campaigns.archive.archive, {
      campaignId: current.id,
      expectedVersion: current.version
    })
    assert.equal(campaign.status, 'ARCHIVED')
    assert.equal(campaign.capabilities.delete, true)
    assert.equal(campaign.capabilities.edit, false)
    assert.equal(campaign.capabilities.archive, false)
    const archivedPlayer = await player.query(api.campaigns.queries.get, { id: campaign.id })
    assert.equal(archivedPlayer.capabilities.delete, false)
    assert.equal(archivedPlayer.capabilities.edit, false)
    const afterArchive = await inspect(campaign.id)
    const afterRows = tables(afterArchive.campaignStateJson)
    const archivedRoot = one(afterRows, 'campaigns')
    assert.equal(typeof archivedRoot.updatedAt, 'string')
    const occurredAt = archivedRoot.updatedAt
    archiveRows.campaigns = [
      {
        ...rootBefore,
        status: 'ARCHIVED',
        version: Number(rootBefore.version) + 1,
        updatedAt: occurredAt
      }
    ]
    assert.equal(archiveRows.accountUsageEntries!.length, 1)
    assert.equal(archiveRows.accountUsageEntries![0]!.resource, 'activeHostedCampaigns')
    assert.equal(archiveRows.accountUsageEntries![0]!.sourceId, campaign.id)
    archiveRows.accountUsageEntries = []
    const listings = archiveRows.socialListings!
    assert.equal(listings.length, 1)
    const listing = listings[0]!
    assert.equal(listing.status, 'OPEN')
    assert.equal(listing.audience, 'PUBLIC')
    archiveRows.socialListings = [
      { ...listing, status: 'CLOSED', version: Number(listing.version) + 1, updatedAt: occurredAt }
    ]
    assert.equal(archiveRows.socialApplications!.length, 1)
    assert.equal(archiveRows.campaignInvites!.length, 1)
    const sourceIds = new Set<string>()
    archiveRows.socialApplications = archiveRows.socialApplications!.map((row) => {
      assert.equal(row.status, 'SUBMITTED')
      sourceIds.add(String(row.id))
      return {
        ...row,
        status: 'EXPIRED',
        expiredAt: occurredAt,
        updatedAt: occurredAt,
        version: Number(row.version) + 1
      }
    })
    archiveRows.campaignInvites = archiveRows.campaignInvites!.map((row) => {
      assert.equal(row.status, 'PENDING')
      sourceIds.add(String(row.id))
      return {
        ...row,
        status: 'EXPIRED',
        expiredAt: occurredAt,
        updatedAt: occurredAt,
        version: Number(row.version) + 1
      }
    })
    archiveRows.sceneVisionRevisions = archiveRows.sceneVisionRevisions!.map((row) => {
      if (row.scope !== 'CAMPAIGN' || row.id !== campaign.id) return row
      const actual = afterRows.sceneVisionRevisions!.find((candidate) => candidate._id === row._id)
      assert.ok(actual)
      assert.equal(typeof actual.revision, 'string')
      assert.notEqual(actual.revision, row.revision)
      return { ...row, revision: actual.revision }
    })
    assert.deepEqual(
      afterRows,
      archiveRows,
      'Archive preserves every complete aggregate row except the exact root/admission/vision transition.'
    )
    const usageBefore = archivePersonal.accountUsageEntries!.length
    archivePersonal.accountUsageEntries = archivePersonal.accountUsageEntries!.filter(
      (row) =>
        !(row.resource === 'activeHostedCampaigns' && row.sourceId === campaign.id) &&
        !(row.resource === 'publicListings' && row.sourceId === listing.id)
    )
    assert.equal(usageBefore - archivePersonal.accountUsageEntries.length, 2)
    archivePersonal.userProfiles = archivePersonal.userProfiles!.map((profile) => {
      if (profile.userId !== ownerUserId) return profile
      const usage = profile.entitlementUsage
      assert.ok(
        usage &&
          typeof usage === 'object' &&
          'activeHostedCampaigns' in usage &&
          'publicListings' in usage
      )
      assert.equal(typeof usage.activeHostedCampaigns, 'number')
      assert.equal(typeof usage.publicListings, 'number')
      assert.ok(Number(usage.activeHostedCampaigns) >= 1 && Number(usage.publicListings) >= 1)
      return {
        ...profile,
        entitlementUsage: {
          ...usage,
          activeHostedCampaigns: Number(usage.activeHostedCampaigns) - 1,
          publicListings: Number(usage.publicListings) - 1
        }
      }
    })
    let cancelled = 0
    archivePersonal.notificationDeliveryIntents = archivePersonal.notificationDeliveryIntents!.map(
      (intent) => {
        if (!sourceIds.has(String(intent.sourcePublicId))) return intent
        assert.equal(intent.status, 'DISPATCHED')
        assert.equal(intent.cancelledAt, null)
        cancelled += 1
        return { ...intent, status: 'CANCELLED', cancelledAt: occurredAt }
      }
    )
    assert.equal(cancelled, 2)
    assert.deepEqual(
      tables(afterArchive.personalStateJson),
      archivePersonal,
      'Archive preserves byte-exact personal/source/equipment/HP state with only exact usage and notification changes.'
    )
    stage('archive-complete-populated-scope-personal-retention-admission-usage', {
      before: beforeArchive,
      archived: campaign,
      player: archivedPlayer,
      after: afterArchive
    })
    await refuse(
      campaign.id,
      'archive-already-archived',
      () =>
        owner.mutation(api.campaigns.archive.archive, {
          campaignId: campaign.id,
          expectedVersion: campaign.version
        }),
      /Archived Campaigns are read-only/
    )
  }
  await copy(campaign, [])
  await copy(campaign, ['GENERAL', 'PEOPLE', 'PLACES'])
  const deletion: DeleteCampaignInput = {
    campaignId: campaign.id,
    expectedVersion: campaign.version,
    confirmation: 'DELETE'
  }
  await refuse(
    campaign.id,
    'delete-anonymous',
    () => anonymous.mutation(api.campaigns.deletion.remove, deletion),
    /Unauthenticated/
  )
  await refuse(
    campaign.id,
    'delete-player',
    () => player.mutation(api.campaigns.deletion.remove, deletion),
    /cannot perform/
  )
  await refuse(
    campaign.id,
    'delete-stale-version',
    () =>
      owner.mutation(api.campaigns.deletion.remove, {
        ...deletion,
        expectedVersion: campaign.version - 1
      }),
    /changed before/
  )
  await refuse(
    campaign.id,
    'delete-wrong-confirmation',
    () =>
      owner.mutation(api.campaigns.deletion.remove, {
        ...deletion,
        confirmation: 'KEEP'
      } as unknown as DeleteCampaignInput),
    /validation|DELETE|literal/i
  )
  await remove(campaign.id, true)

  const archivedSource = await create()
  await notes(archivedSource.id)
  await cli(
    'encounters/developmentCampaign:admitFixturePlayer',
    { ownerUserId, playerUserId, campaignId: archivedSource.id },
    false
  )
  const archivedBefore = await inspect(archivedSource.id)
  const archived = await owner.mutation(api.campaigns.archive.archive, {
    campaignId: archivedSource.id,
    expectedVersion: archivedSource.version
  })
  assert.equal(archived.status, 'ARCHIVED')
  assert.equal(archived.capabilities.delete, true)
  assert.equal(archived.capabilities.edit, false)
  assert.equal(archived.capabilities.archive, false)
  const archivedPlayer = await player.query(api.campaigns.queries.get, { id: archived.id })
  assert.equal(archivedPlayer.capabilities.delete, false)
  assert.equal(archivedPlayer.capabilities.edit, false)
  const archivedAfter = await inspect(archived.id)
  assert.deepEqual(
    tables(archivedAfter.campaignStateJson).campaignNotebookSections,
    tables(archivedBefore.campaignStateJson).campaignNotebookSections,
    'Archiving preserves every complete notebook row.'
  )
  stage('archive-preserves-notebooks-owner-delete-player-readonly', {
    before: archivedBefore,
    archived,
    player: archivedPlayer,
    after: archivedAfter
  })
  await copy(archived, [])
  await copy(archived, ['GENERAL', 'PEOPLE', 'PLACES'])
  const archivedDeletion: DeleteCampaignInput = {
    campaignId: archived.id,
    expectedVersion: archived.version,
    confirmation: 'DELETE'
  }
  await refuse(
    archived.id,
    'delete-archived-player',
    () => player.mutation(api.campaigns.deletion.remove, archivedDeletion),
    /cannot perform/
  )
  await refuse(
    archived.id,
    'delete-archived-stale-version',
    () =>
      owner.mutation(api.campaigns.deletion.remove, {
        ...archivedDeletion,
        expectedVersion: archived.version - 1
      }),
    /changed before/
  )
  await remove(archived.id, true)

  return {
    fixtureUsers,
    evidence,
    coverage:
      'Complete ' +
      deletionSourceStatus +
      ' native lifecycle prepared with full custody/Character/Scene/Run/admission/copy/delete/late rollback catalogue; exact post-collector map grace, actual backend execution, copy workload policy and browser journeys remain required.'
  }
}
