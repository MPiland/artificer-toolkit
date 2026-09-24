/** Real native Campaign UI lifecycle with complete indexed state comparisons. */
import assert from 'node:assert/strict'
import { appendFileSync } from 'node:fs'
import { resolve as resolvePath } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import type { ConvexHttpClient } from 'convex/browser'
import { api } from '../convex/_generated/api.js'
import { developmentCli as cli } from './developmentCli'
import { one, tables } from './developmentCampaignLifecycle'
import { verifyCampaignLifecycleBrowser } from '../../web/tests/convex/campaignLifecycle'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  campaignCopyProgressSchema,
  type CampaignCopyProgress
} from '@artificer-toolkit/schema/api/campaignCopy'
import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import {
  developmentCampaignInspectionSchema,
  type DevelopmentCampaignFixture,
  type DevelopmentCampaignInspection
} from '@artificer-toolkit/schema/api/developmentCampaignLifecycle'
import { campaignStoredCopySchema } from '@artificer-toolkit/schema/projections/campaignCopyPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'

type NotebookCategory = CampaignCopyProgress['notebookCategories'][number]

type CopyBaseline = {
  source: CampaignDetailDto
  inspection: DevelopmentCampaignInspection
  categories: readonly NotebookCategory[]
}
type RootSnapshot = { detail: CampaignDetailDto; inspection: DevelopmentCampaignInspection }

export type DevelopmentCampaignLifecycleBrowserInput = {
  owner: ConvexHttpClient
  player: ConvexHttpClient
  outsider: ConvexHttpClient
  anonymous: ConvexHttpClient
  ownerUserId: string
  aliveUserIds: readonly string[]
  evidenceDirectory: string
  ownerCredential: { email: string; password: string }
  onBeforeDeletion: (campaignId: string, before: DevelopmentCampaignInspection) => void
}

export async function verifyDevelopmentCampaignLifecycleBrowser(
  input: DevelopmentCampaignLifecycleBrowserInput
): Promise<void> {
  assert.ok(input.aliveUserIds.includes(input.ownerUserId), 'Owner must remain in the live cohort.')
  assert.ok(
    input.aliveUserIds.length <= 4,
    'The native inspector permits at most four fixture users.'
  )

  const fixture = (campaignId: string): DevelopmentCampaignFixture => ({
    ownerUserId: input.ownerUserId,
    campaignId,
    gameSystemId: srdSystemRecord.id,
    userIds: [...input.aliveUserIds]
  })
  const inspect = async (campaignId: string) =>
    developmentCampaignInspectionSchema.parse(
      await cli('campaigns/developmentLifecycle:inspect', fixture(campaignId), false)
    )
  const stage = (name: string, value: Record<string, unknown>) =>
    appendFileSync(
      resolvePath(input.evidenceDirectory, 'campaign-lifecycle-browser-native.jsonl'),
      JSON.stringify({ stage: name, completedAtUtc: new Date().toISOString(), ...value }) + '\n'
    )

  const roots = new Map<string, RootSnapshot>()
  const removalSnapshots = new Map<string, RootSnapshot>()
  let source: RootSnapshot | null = null
  let pending: CopyBaseline | null = null
  let personalBaseline: string | null = null

  const resolveCampaign = async (publicId: string) => {
    const detail = await input.owner.query(api.campaigns.queries.get, { id: publicId })
    assert.ok(detail, 'Browser Campaign route must resolve to a current public detail.')
    assert.equal(detail.publicId, publicId, 'Public detail must retain the browser route identity.')
    return detail
  }
  const waitForDetail = async (
    publicId: string,
    label: string,
    matches: (detail: CampaignDetailDto) => boolean
  ) => {
    const deadline = Date.now() + 30_000
    let current = await resolveCampaign(publicId)
    while (!matches(current)) {
      assert.ok(Date.now() < deadline, label + ' did not reach the required public state.')
      await delay(250)
      current = await resolveCampaign(publicId)
    }
    return current
  }
  const capture = async (detail: CampaignDetailDto) => {
    const inspection = await inspect(detail.id)
    roots.set(detail.id, { detail, inspection })
    return inspection
  }
  const sourceForCopy = () => {
    if (!source) throw new Error('Browser copy began before its source fixture was captured.')
    return source
  }

  await verifyCampaignLifecycleBrowser({
    owner: input.ownerCredential,
    evidenceDirectory: input.evidenceDirectory,
    srdSystemLabel: srdSystemRecord.label,
    srdCatalogueLabel: SRD_RULES_CATALOGUE.label,
    verifyStage: async ({ stage: browserStage, publicId, notebookCategories }) => {
      if (browserStage === 'created') {
        const detail = await resolveCampaign(publicId)
        assert.equal(detail.name, 'Encounter execution fixture')
        assert.equal(detail.gameSystemId, srdSystemRecord.id)
        const beforeNotes = await capture(detail)
        const beforeRows = tables(beforeNotes.campaignStateJson)
        assert.equal(one(beforeRows, 'campaigns').ownerUserId, input.ownerUserId)
        assert.equal(one(beforeRows, 'campaigns').primaryRulesCatalogueId, SRD_RULES_CATALOGUE.id)
        assert.equal(one(beforeRows, 'campaignMemberships').role, 'OWNER')
        assert.equal(one(beforeRows, 'campaignMemberships').status, 'ACTIVE')
        for (const visibility of ['GM_PRIVATE', 'SHARED'] as const)
          await input.owner.mutation(api.campaigns.notebooks.create, {
            campaignId: detail.id,
            title: visibility + ' raw notebook',
            content: '<p>' + visibility + ' exact raw content.</p>',
            visibility,
            category: 'PLACES'
          })
        for (let index = 0; index < 9; index++)
          await input.owner.mutation(api.campaigns.notebooks.create, {
            campaignId: detail.id,
            title: 'Person ' + index,
            content: '<p>Selected person ' + index + ' exact raw content.</p>',
            visibility: index % 2 ? 'SHARED' : 'GM_PRIVATE',
            category: 'PEOPLE'
          })
        await input.owner.mutation(api.campaigns.notebooks.create, {
          campaignId: detail.id,
          title: 'Contextual general note',
          content: '<p>Copied only when explicitly selected.</p>',
          visibility: 'GM_PRIVATE',
          category: 'GENERAL'
        })
        source = { detail, inspection: await capture(detail) }
        personalBaseline = source.inspection.personalStateJson
        assert.equal(
          tables(source.inspection.campaignStateJson).campaignNotebookSections?.length,
          12
        )
        stage('created-public-detail-and-notebooks', {
          detail,
          beforeNotes,
          afterNotes: source.inspection
        })
        return
      }

      if (browserStage === 'updated') {
        const prior = sourceForCopy()
        const detail = await waitForDetail(
          publicId,
          'Campaign metadata save',
          (current) =>
            current.toneDetails === 'Browser lifecycle copy proof' &&
            current.version > prior.detail.version
        )
        const inspection = await capture(detail)
        assert.equal(one(tables(inspection.campaignStateJson), 'campaigns').version, detail.version)
        source = { detail, inspection }
        stage('updated-public-detail-version', { prior: prior.detail, detail, inspection })
        return
      }

      if (browserStage === 'before-copy') {
        const detail = await resolveCampaign(publicId)
        const currentSource = sourceForCopy()
        assert.equal(detail.id, currentSource.detail.id)
        assert.deepEqual(notebookCategories, [...new Set(notebookCategories ?? [])])
        pending = {
          source: detail,
          inspection: await inspect(detail.id),
          categories: notebookCategories ?? []
        }
        const root = one(tables(pending.inspection.campaignStateJson), 'campaigns')
        assert.equal(root.status, detail.status)
        assert.equal(root.version, detail.version)
        stage('before-copy', {
          detail,
          notebookCategories: pending.categories,
          inspection: pending.inspection
        })
        return
      }

      if (browserStage === 'selected-copy-started') {
        assert.ok(pending, 'Selected copy needs a before-copy baseline.')
        stage('selected-copy-started', { sourcePublicId: publicId, before: pending.inspection })
        return
      }

      if (browserStage === 'selected-copy-completed') {
        stage('selected-copy-completed', { sourcePublicId: publicId })
        return
      }

      if (browserStage === 'default-copy') {
        const baseline = pending
        if (!baseline) throw new Error('Browser copy completed without its before-copy baseline.')
        const destination = await resolveCampaign(publicId)
        await assertCompletedCopy(input, inspect, baseline, destination, stage)
        roots.set(destination.id, {
          detail: destination,
          inspection: await inspect(destination.id)
        })
        pending = null
        return
      }

      if (browserStage === 'archived-general-copy') {
        const destination = await resolveCampaign(publicId)
        const verified = roots.get(destination.id)
        assert.ok(
          verified,
          'Archived GENERAL copy must be verified by its completed copy callback.'
        )
        assert.equal(verified.detail.publicId, destination.publicId)
        assert.equal(verified.detail.status, 'ACTIVE')
        stage('archived-general-copy-verified', { destination, inspection: verified.inspection })
        return
      }

      if (browserStage === 'archived') {
        const detail = await waitForDetail(
          publicId,
          'Campaign archive',
          (current) => current.status === 'ARCHIVED'
        )
        const inspection = await capture(detail)
        assert.equal(detail.status, 'ARCHIVED')
        assert.equal(one(tables(inspection.campaignStateJson), 'campaigns').status, 'ARCHIVED')
        source = { detail, inspection }
        stage('archived-source-preserved', { detail, inspection })
        return
      }

      if (browserStage === 'before-delete') {
        const detail = await resolveCampaign(publicId)
        const inspection = await inspect(detail.id)
        removalSnapshots.set(detail.id, { detail, inspection })
        input.onBeforeDeletion(detail.id, inspection)
        stage('before-delete-complete-scope', { detail, inspection, personalBaseline })
        return
      }

      if (browserStage === 'deleted') {
        if (personalBaseline === null)
          throw new Error('Missing personal baseline before Campaign deletion.')
        assert.equal(roots.size, 4, 'The browser must create a source and three distinct copies.')
        assert.equal(
          removalSnapshots.size,
          roots.size,
          'Every actual root needs its own pre-delete snapshot.'
        )
        for (const snapshot of removalSnapshots.values())
          await assertRemoved(input.owner, fixture, snapshot, input.evidenceDirectory)
        const personalAfterJson = await cli(
          'campaigns/developmentLifecycle:inspectPersonal',
          fixture(sourceForCopy().detail.id),
          false
        )
        if (typeof personalAfterJson !== 'string')
          throw new Error('Invalid personal Campaign snapshot.')
        const expectedPersonal = tables(personalBaseline)
        const removedCampaignIds = new Set(removalSnapshots.keys())
        const usageBeforeCount = expectedPersonal.accountUsageEntries!.length
        expectedPersonal.accountUsageEntries = expectedPersonal.accountUsageEntries!.filter(
          (row) =>
            !(
              row.resource === 'activeHostedCampaigns' &&
              removedCampaignIds.has(String(row.sourceId))
            )
        )
        const removedHostedUsageCount =
          usageBeforeCount - expectedPersonal.accountUsageEntries.length
        assert.equal(removedHostedUsageCount, 1, 'The baseline must contain the source usage row.')
        expectedPersonal.userProfiles = expectedPersonal.userProfiles!.map((profile) => {
          if (profile.userId !== input.ownerUserId) return profile
          const usage = profile.entitlementUsage
          assert.ok(usage && typeof usage === 'object' && 'activeHostedCampaigns' in usage)
          assert.equal(typeof usage.activeHostedCampaigns, 'number')
          return {
            ...profile,
            entitlementUsage: {
              ...usage,
              activeHostedCampaigns:
                (usage.activeHostedCampaigns as number) - removedHostedUsageCount
            }
          }
        })
        assert.deepEqual(
          tables(personalAfterJson),
          expectedPersonal,
          'Campaign deletion must preserve personal data except exact hosted Campaign usage.'
        )
        stage('deleted-complete-scopes-personal-preserved', {
          roots: [...removalSnapshots.values()],
          personalAfter: personalAfterJson
        })
      }
    },
    waitForSelectedCopy: async ({ sourcePublicId, notebookCategories }) => {
      const baseline = pending
      if (!baseline) throw new Error('Selected copy wait needs a before-copy baseline.')
      assert.equal(baseline.source.publicId, sourcePublicId)
      assert.deepEqual(notebookCategories, baseline.categories)
      const completed = await waitForSelectedCopy(input.owner, inspect, baseline, stage)
      const destination = completed.destination
      assert.ok(destination)
      await assertCompletedCopy(input, inspect, baseline, destination, stage, completed.copyId)
      roots.set(destination.id, { detail: destination, inspection: await inspect(destination.id) })
      pending = null
      return { copyId: completed.copyId, destinationPublicId: destination.publicId }
    }
  })
}

async function waitForSelectedCopy(
  owner: ConvexHttpClient,
  inspect: (campaignId: string) => Promise<DevelopmentCampaignInspection>,
  baseline: CopyBaseline,
  record: (name: string, value: Record<string, unknown>) => void
) {
  const beforeRows = tables(baseline.inspection.campaignStateJson)
  const beforeIds = new Set((beforeRows.campaignCopyJobs ?? []).map((row) => String(row.id)))
  const deadline = Date.now() + 30_000
  const progress: CampaignCopyProgress[] = []
  while (true) {
    const current = await inspect(baseline.source.id)
    const jobs = tables(current.campaignStateJson).campaignCopyJobs ?? []
    const fresh = jobs.filter((row) => !beforeIds.has(String(row.id)))
    assert.ok(fresh.length <= 1, 'Selected browser copy must create exactly one new job.')
    if (fresh.length === 1) {
      const copyId = String(fresh[0]!.id)
      const value = campaignCopyProgressSchema.parse(
        await owner.query(api.campaigns.copyJobs.progress, { copyId })
      )
      progress.push(value)
      if (value.status === 'COMPLETED') {
        record('selected-copy-progress', { copyId, progress, inspection: current })
        return value
      }
      assert.equal(
        value.status,
        'RUNNING',
        'Selected copy may only remain RUNNING before completion.'
      )
    }
    assert.ok(Date.now() < deadline, 'Selected browser copy did not complete within 30 seconds.')
    await delay(250)
  }
}

async function assertCompletedCopy(
  input: DevelopmentCampaignLifecycleBrowserInput,
  inspect: (campaignId: string) => Promise<DevelopmentCampaignInspection>,
  baseline: CopyBaseline,
  destination: CampaignDetailDto,
  record: (name: string, value: Record<string, unknown>) => void,
  expectedCopyId?: string
) {
  const sourceRows = tables(baseline.inspection.campaignStateJson)
  const destinationInspection = await inspect(destination.id)
  const destinationRows = tables(destinationInspection.campaignStateJson)
  const sourceRoot = one(sourceRows, 'campaigns')
  const destinationRoot = one(destinationRows, 'campaigns')
  assert.equal(sourceRoot.id, baseline.source.id)
  assert.equal(sourceRoot.publicId, baseline.source.publicId)
  assert.notEqual(destination.id, baseline.source.id)
  assert.notEqual(destination.publicId, baseline.source.publicId)
  assert.equal(destinationRoot.id, destination.id)
  assert.equal(destinationRoot.publicId, destination.publicId)
  const expectedRoot: Record<string, unknown> = {
    ...sourceRoot,
    _id: destinationRoot._id,
    _creationTime: destinationRoot._creationTime,
    id: destination.id,
    publicId: destination.publicId,
    status: 'ACTIVE',
    version: 0,
    createdAt: destinationRoot.createdAt,
    updatedAt: destinationRoot.updatedAt
  }
  delete expectedRoot.notebookRevision
  assert.deepEqual(destinationRoot, expectedRoot)
  assert.equal(destinationRoot.createdAt, destinationRoot.updatedAt)
  assert.equal(one(destinationRows, 'campaignMemberships').userId, input.ownerUserId)
  assert.equal(one(destinationRows, 'campaignMemberships').role, 'OWNER')
  assert.equal(one(destinationRows, 'campaignMemberships').status, 'ACTIVE')
  assert.equal(one(destinationRows, 'campaignPlaySettings').campaignId, destination.id)
  assert.equal(one(destinationRows, 'authoredRouteIds').publicId, destination.publicId)
  assert.equal(one(destinationRows, 'accountUsageEntries').ownerUserId, input.ownerUserId)

  const selected = new Set<string>(baseline.categories)
  const sourceNotes = (sourceRows.campaignNotebookSections ?? [])
    .filter((row) => selected.has(String(row.category)))
    .sort((left, right) => String(left.title).localeCompare(String(right.title)))
  const copiedNotes = [...(destinationRows.campaignNotebookSections ?? [])].sort((left, right) =>
    String(left.title).localeCompare(String(right.title))
  )
  assert.equal(
    sourceNotes.length,
    baseline.categories.length === 0 ? 0 : baseline.categories[0] === 'GENERAL' ? 1 : 11
  )
  assert.equal(copiedNotes.length, sourceNotes.length)
  for (const [index, copied] of copiedNotes.entries()) {
    const original = sourceNotes[index]!
    assert.notEqual(copied.id, original.id)
    assert.notEqual(copied._id, original._id)
    assert.equal(copied.createdAt, copied.updatedAt)
    assert.deepEqual(copied, {
      ...original,
      _id: copied._id,
      _creationTime: copied._creationTime,
      id: copied.id,
      campaignId: destination.id,
      version: 0,
      createdBy: input.ownerUserId,
      updatedBy: input.ownerUserId,
      createdAt: copied.createdAt,
      updatedAt: copied.updatedAt
    })
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
  for (const [table, rows] of Object.entries(destinationRows))
    if (!allowed.has(table)) assert.deepEqual(rows, [], 'Copy must exclude ' + table + '.')

  const sourceAfter = await inspect(baseline.source.id)
  const afterRows = tables(sourceAfter.campaignStateJson)
  assert.equal(one(afterRows, 'campaigns').id, baseline.source.id)
  assert.equal(one(afterRows, 'campaigns').publicId, baseline.source.publicId)
  for (const [table, rows] of Object.entries(sourceRows))
    if (table !== 'campaignEvents' && table !== 'campaignCopyJobs')
      assert.deepEqual(afterRows[table], rows, 'Copy must preserve source ' + table + '.')
  const newEvents = (afterRows.campaignEvents ?? []).filter(
    (row) => !(sourceRows.campaignEvents ?? []).some((prior) => prior.id === row.id)
  )
  const newJobs = (afterRows.campaignCopyJobs ?? []).filter(
    (row) => !(sourceRows.campaignCopyJobs ?? []).some((prior) => prior.id === row.id)
  )
  assert.equal(newEvents.length, 1)
  assert.equal(newJobs.length, 1)
  const event = newEvents[0]!
  const rawJob = newJobs[0]!
  assert.equal(event.type, 'CAMPAIGN_COPIED')
  assert.equal(event.actorUserId, input.ownerUserId)
  assert.equal(event.visibility, 'OWNER')
  assert.equal(event.visibleInHistory, false)
  const { _id, _creationTime, ...storedJob } = rawJob
  const job = campaignStoredCopySchema.parse(storedJob)
  assert.equal(job.status, 'COMPLETED')
  assert.equal(job.destinationCampaignId, destination.id)
  assert.equal(job.ownerUserId, input.ownerUserId)
  assert.equal(job.copiedSections, sourceNotes.length)
  assert.equal(job.failureReason, null)
  if (expectedCopyId) assert.equal(job.id, expectedCopyId)
  assert.equal(job.command.campaignId, baseline.source.id)
  assert.equal(job.command.expectedVersion, baseline.source.version)
  assert.deepEqual(job.command.notebookCategories, baseline.categories)
  assert.equal(job.inputFingerprint, event.inputFingerprint)
  assert.equal(
    checksumCanonicalJson({
      operation: 'CAMPAIGN_SELECTED_COPY',
      actorUserId: input.ownerUserId,
      command: job.command
    }),
    job.inputFingerprint
  )
  assert.deepEqual(
    afterRows.campaignEvents!.filter((row) => row.id !== event.id),
    sourceRows.campaignEvents
  )
  assert.deepEqual(
    afterRows.campaignCopyJobs!.filter((row) => row.id !== rawJob.id),
    sourceRows.campaignCopyJobs
  )
  assert.deepEqual(JSON.parse(String(event.payloadJson)), {
    copiedCampaignId: destination.id,
    expectedVersion: baseline.source.version
  })
  assert.deepEqual(afterRows.campaignCopyStagedNotebookSections, [])
  const completed = campaignCopyProgressSchema.parse(
    await input.owner.query(api.campaigns.copyJobs.progress, { copyId: job.id })
  )
  assert.equal(completed.status, 'COMPLETED')
  assert.deepEqual(completed.destination, destination)
  const replayBefore = { source: sourceAfter, destination: destinationInspection }
  assert.deepEqual(await input.owner.mutation(api.campaigns.copyJobs.begin, job.command), completed)
  assert.deepEqual(
    { source: await inspect(baseline.source.id), destination: await inspect(destination.id) },
    replayBefore,
    'Exact begin replay must not write source or destination.'
  )
  for (const client of [input.player, input.outsider, input.anonymous])
    await assert.rejects(client.query(api.campaigns.queries.get, { id: destination.id }))
  record('copy-complete-exact', {
    baseline,
    destination,
    destinationInspection,
    sourceAfter,
    job,
    event
  })
}

async function assertRemoved(
  owner: ConvexHttpClient,
  fixture: (campaignId: string) => DevelopmentCampaignFixture,
  snapshot: RootSnapshot,
  evidenceDirectory: string
) {
  const campaignId = snapshot.detail.id
  const deadline = Date.now() + 300_000
  try {
    while (true) {
      const status = await owner.query(api.campaigns.deletion.status, { campaignId })
      if (status.status === 'FAILED')
        throw new Error(
          `Campaign ${campaignId} deletion failed: ${status.error ?? 'unknown error'}`
        )
      if (status.status === 'DELETED') break
      assert.ok(
        Date.now() < deadline,
        `Campaign ${campaignId} deletion remained ${status.status} for five minutes.`
      )
      await delay(250)
    }
    while (true) {
      try {
        assert.equal(
          await cli(
            'campaigns/developmentLifecycle:assertRemoved',
            { fixture: fixture(campaignId), descendants: snapshot.inspection.descendants },
            false
          ),
          null
        )
        break
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (
          !/cleanup retains (?:campaignCopyJobs|campaignCopyStagedNotebookSections)\./.test(message)
        )
          throw error
        if (Date.now() >= deadline)
          throw new Error(
            `Campaign ${campaignId} reached DELETED, but copy cleanup remained after five minutes: ${message}`
          )
        await delay(250)
      }
    }
  } catch (error) {
    appendFileSync(
      resolvePath(evidenceDirectory, 'campaign-lifecycle-browser-removal.jsonl'),
      JSON.stringify({
        campaignId,
        message: error instanceof Error ? error.message : String(error)
      }) + '\n'
    )
    throw error
  }
}
