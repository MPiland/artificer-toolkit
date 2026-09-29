import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import type { ConvexHttpClient } from 'convex/browser'
import { z } from 'zod'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  socialStoredApplicationSchema,
  socialStoredListingSchema,
  socialStoredProfileSchema
} from '@artificer-toolkit/schema/projections/socialPersistence'
import { campaignStoredInviteSchema } from '@artificer-toolkit/schema/projections/campaignPersistence'
import { socialStoredReportSchema } from '@artificer-toolkit/schema/projections/socialModerationPersistence'
import {
  socialRetentionPreviewResultSchema,
  socialRetentionApplyResultSchema,
  type SocialRetentionPreviewInput
} from '@artificer-toolkit/schema/api/socialRetention'
import { api } from '../convex/_generated/api.js'
import { developmentCli as cli } from './developmentCli'
import { verifySocialAdmission } from './developmentSocialAdmission'
import { verifySocialPagination } from './developmentSocialPagination'
import { verifySocialBrowser, type SocialBrowserStage } from '../../web/tests/live-backend/social'

export type SocialProofAccount = {
  client: ConvexHttpClient
  userId: string
  email: string
  password: string
  username: string
  profileId: string | null
  fetchToken: () => Promise<string>
}
export type SocialProofCohort = Record<
  'owner' | 'player' | 'invitee' | 'moderator',
  SocialProofAccount
>

const fixtureStateSchema = z.object({
  listing: z.nullable(
    z.object(socialStoredListingSchema.shape).pick({
      id: true,
      status: true,
      moderationStatus: true,
      version: true
    })
  ),
  profiles: z.array(
    z.object(socialStoredProfileSchema.shape).pick({
      userId: true,
      id: true,
      status: true,
      contentPreference: true,
      adultAttestedAt: true
    })
  ),
  applications: z.array(
    z.object(socialStoredApplicationSchema.shape).pick({ id: true, status: true, version: true })
  ),
  invitations: z.array(
    z.object(campaignStoredInviteSchema.shape).pick({ id: true, status: true, version: true })
  ),
  reports: z.array(
    z
      .object(socialStoredReportSchema.shape)
      .pick({ id: true, targetKind: true, status: true, version: true })
  ),
  auditCount: z.number().int().nonnegative()
})

export async function verifySocialLifecycle(
  cohort: SocialProofCohort,
  anonymous: ConvexHttpClient
) {
  const accounts = Object.values(cohort)
  const { owner, player, invitee, moderator } = cohort
  const evidenceDirectory = fileURLToPath(
    new URL('../../../local-validation/local-convex-proofs/phase82-social-live', import.meta.url)
  )
  await mkdir(evidenceDirectory, { recursive: true })
  for (const account of accounts) {
    const eligibility = await account.client.mutation(api.social.profiles.initialize, {})
    assert.ok(eligibility.profilePublicId)
    account.profileId = eligibility.profilePublicId
    await account.client.mutation(api.notifications.updatePreferences, {
      category: 'SOCIAL',
      inApp: true,
      email: false
    })
  }
  await cli('authAdmin:setRole', { userId: moderator.userId, role: 'superadmin' }, false)
  const campaign = await owner.client.mutation(api.campaigns.create.create, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  const scope = {
    ownerUserId: owner.userId,
    playerUserId: player.userId,
    inviteeUserId: invitee.userId,
    moderatorUserId: moderator.userId,
    campaignId: campaign.id
  }
  const readFixture = async () =>
    fixtureStateSchema.parse(
      await cli('social/developmentFixtures:inspectFixtureState', scope, false)
    )
  const checkpoints: Array<{ stage: string; recordedAt: string }> = []
  let acceptedPlayers = 0
  let attestation: string | null = null
  const verifyState = async (stage: SocialBrowserStage) => {
    for (const account of accounts) account.client.setAuth(await account.fetchToken())
    const state = await readFixture()
    assert.ok(state.listing)
    const listingId = state.listing.id
    switch (stage) {
      case 'listing-open': {
        assert.equal(state.listing.status, 'OPEN')
        await assert.rejects(
          anonymous.query(api.social.discovery.getListing, { listingPublicId: listingId }),
          /Unauthenticated/
        )
        await assert.rejects(player.client.query(api.campaigns.queries.get, { id: campaign.id }))
        await assert.rejects(
          player.client.mutation(api.social.listings.close, {
            listingPublicId: listingId,
            expectedVersion: state.listing.version
          })
        )
        const page = await player.client.query(api.social.discoveryLists.search, {
          query: 'shitstorm',
          paginationOpts: { cursor: null, numItems: 8 }
        })
        assert.ok(page.page.some((row) => row.listingPublicId === listingId))
        const listing = await player.client.query(api.social.discovery.getListing, {
          listingPublicId: listingId
        })
        assert.ok(
          !listing.summary.includes('shitstorm'),
          'Standard discovery must mask source text.'
        )
        const ownerProjection = await owner.client.query(api.social.discovery.getListing, {
          listingPublicId: listingId
        })
        for (const projection of [listing, ownerProjection, ...page.page]) {
          const serialized = JSON.stringify(projection)
          assert.ok(
            !serialized.includes('shitstorm'),
            'Shared Standard reads mask even for owners.'
          )
          for (const privateValue of [
            campaign.id,
            ...accounts.flatMap((account) => [account.userId, account.email])
          ])
            assert.ok(
              !serialized.includes(privateValue),
              'Public listing leaked private identity or Campaign data.'
            )
        }
        break
      }
      case 'application-submitted':
        assert.equal(state.applications.length, 1)
        assert.equal(state.applications[0].status, 'SUBMITTED')
        break
      case 'application-accepted': {
        assert.equal(state.applications[0]?.status, 'ACCEPTED')
        const replay = await owner.client.mutation(api.social.applications.decide, {
          applicationPublicId: state.applications[0].id,
          expectedVersion: 0,
          decision: 'ACCEPT'
        })
        assert.equal(replay.status, 'ACCEPTED')
        acceptedPlayers = 1
        break
      }
      case 'invitation-accepted':
        assert.equal(state.invitations.length, 1)
        assert.equal(state.invitations[0].status, 'ACCEPTED')
        acceptedPlayers = 2
        break
      case 'preference-mature': {
        const profile = state.profiles.find((row) => row.userId === player.userId)!
        assert.equal(profile.contentPreference, 'MATURE')
        assert.ok(profile.adultAttestedAt)
        attestation = profile.adultAttestedAt
        break
      }
      case 'preference-standard': {
        const profile = state.profiles.find((row) => row.userId === player.userId)!
        assert.equal(profile.contentPreference, 'STANDARD')
        assert.equal(profile.adultAttestedAt, attestation)
        break
      }
      case 'profile-reported':
      case 'listing-reported':
        assert.equal(
          state.reports.find(
            (row) => row.targetKind === (stage === 'profile-reported' ? 'PROFILE' : 'LISTING')
          )?.status,
          'SUBMITTED'
        )
        break
      case 'profile-review':
      case 'listing-review':
        assert.equal(
          state.reports.find(
            (row) => row.targetKind === (stage === 'profile-review' ? 'PROFILE' : 'LISTING')
          )?.status,
          'UNDER_REVIEW'
        )
        break
      case 'profile-suspended':
        assert.equal(
          state.profiles.find((row) => row.userId === invitee.userId)?.status,
          'SUSPENDED'
        )
        await assert.rejects(
          invitee.client.query(api.social.discovery.getListing, { listingPublicId: listingId }),
          /active Social profile/i
        )
        break
      case 'profile-restored':
        assert.equal(state.profiles.find((row) => row.userId === invitee.userId)?.status, 'ACTIVE')
        break
      case 'profile-resolved':
      case 'listing-resolved':
        assert.equal(
          state.reports.find(
            (row) => row.targetKind === (stage === 'profile-resolved' ? 'PROFILE' : 'LISTING')
          )?.status,
          'RESOLVED'
        )
        assert.ok(state.auditCount >= 5)
        break
      case 'listing-hidden':
        assert.equal(state.listing.moderationStatus, 'HIDDEN')
        await assert.rejects(
          player.client.query(api.social.discovery.getListing, { listingPublicId: listingId }),
          /Social listing not found/
        )
        break
      case 'listing-restored':
        assert.equal(state.listing.moderationStatus, 'VISIBLE')
        break
      case 'blocked':
      case 'unblocked':
        assert.ok(invitee.profileId)
        assert.equal(
          (
            await owner.client.query(api.social.blocks.getStatus, {
              profilePublicId: invitee.profileId
            })
          ).blocked,
          stage === 'blocked'
        )
        if (stage === 'blocked')
          await assert.rejects(
            owner.client.query(api.social.discovery.getProfile, {
              profilePublicId: invitee.profileId
            }),
            /Social profile not found/
          )
        break
      case 'listing-updated':
        assert.ok(
          (
            await owner.client.query(api.social.listings.getOwned, { listingPublicId: listingId })
          ).summary.includes('updated')
        )
        break
      case 'listing-closed':
        assert.equal(state.listing.status, 'CLOSED')
        break
      case 'listing-draft':
        assert.equal(state.listing.status, 'DRAFT')
        break
      case 'listing-reopened':
        assert.equal(state.listing.status, 'OPEN')
        break
      default:
        throw new Error(`Unknown Social browser checkpoint: ${String(stage)}`)
    }
    if (acceptedPlayers) {
      const current = await owner.client.query(api.campaigns.queries.get, { id: campaign.id })
      assert.equal(
        current.memberships.filter((member) => member.role === 'PLAYER').length,
        acceptedPlayers
      )
    }
    checkpoints.push({ stage, recordedAt: new Date().toISOString() })
    await writeFile(`${evidenceDirectory}/checkpoints.json`, JSON.stringify(checkpoints, null, 2))
    console.log(`Social checkpoint passed: ${stage}`)
  }
  const browserAccount = (account: SocialProofAccount) => {
    assert.ok(account.profileId)
    return {
      email: account.email,
      password: account.password,
      username: account.username,
      profileId: account.profileId
    }
  }
  await verifySocialBrowser({
    owner: browserAccount(owner),
    player: browserAccount(player),
    invitee: browserAccount(invitee),
    moderator: browserAccount(moderator),
    evidenceDirectory,
    verifyState,
    readHandles: async () => {
      const state = await readFixture()
      return {
        listingId: state.listing?.id ?? null,
        profileReportId: state.reports.find((row) => row.targetKind === 'PROFILE')?.id ?? null,
        listingReportId: state.reports.find((row) => row.targetKind === 'LISTING')?.id ?? null
      }
    }
  })
  await cli('social/developmentFixtures:ageFixtureRecords', scope, false)
  const asOf = new Date().toISOString()
  const retention: Array<{ phase: string; deleted: number }> = []
  async function applyPhase(phase: SocialRetentionPreviewInput['phase']) {
    let cursor: string | null = null
    let deleted = 0
    for (;;) {
      let input: SocialRetentionPreviewInput = {
        phase,
        asOf,
        paginationOpts: { cursor, numItems: 8 }
      }
      const readPage = async () =>
        z.object({ ...socialRetentionPreviewResultSchema.shape, fixtureOnly: z.boolean() }).parse(
          await cli(
            'social/developmentRetention:previewFixturePage',
            {
              userIds: accounts.map((account) => account.userId),
              campaignId: campaign.id,
              input
            },
            false
          )
        )
      let preview = await readPage()
      if (!preview.fixtureOnly) {
        input = { ...input, paginationOpts: { cursor, numItems: 1 } }
        preview = await readPage()
      }
      let next = preview.continueCursor
      let done = preview.isDone
      if (preview.fixtureOnly) {
        const result = socialRetentionApplyResultSchema.parse(
          await cli(
            'social/developmentRetention:applyFixturePage',
            {
              userIds: accounts.map((account) => account.userId),
              campaignId: campaign.id,
              input: { ...input, confirm: 'purge-expired-social-data' }
            },
            false
          )
        )
        deleted += result.deleted
        next = result.continueCursor
        done = result.isDone
      }
      if (done) break
      assert.notEqual(next, cursor, 'Retention cursor must advance.')
      cursor = next
    }
    retention.push({ phase, deleted })
    return deleted
  }
  assert.equal(
    await applyPhase('APPLICATIONS'),
    0,
    'Active accepted membership protects retained application.'
  )
  assert.equal(await applyPhase('INVITATIONS'), 1)
  assert.equal(await applyPhase('REPORTS'), 2)
  for (const account of [player, invitee]) {
    const current = await owner.client.query(api.campaigns.queries.get, { id: campaign.id })
    const member = current.memberships.find((entry) => entry.userId === account.userId)
    assert.ok(member)
    await owner.client.mutation(api.campaigns.membershipDeparture.removeMember, {
      campaignId: campaign.id,
      userId: account.userId,
      commandId: crypto.randomUUID(),
      expectedCampaignVersion: current.version,
      expectedMembershipAccessStartedAt: member.accessStartedAt
    })
  }
  assert.equal(
    await applyPhase('APPLICATIONS'),
    0,
    'Recent departure still protects retained application.'
  )
  await cli('social/developmentFixtures:ageFixtureRecords', scope, false)
  assert.equal(await applyPhase('APPLICATIONS'), 1)
  const deadline = Date.now() + 60_000
  while ((await readFixture()).auditCount !== 0) {
    assert.ok(Date.now() < deadline, 'Scheduled report-audit cleanup did not finish.')
    await delay(2000)
  }
  await cli(
    'social/developmentFixtures:assertOwnedCampaignDeletionRestricted',
    { userId: owner.userId },
    false
  )
  await writeFile(
    `${evidenceDirectory}/retention.json`,
    JSON.stringify({ asOf, phases: retention, remaining: await readFixture() }, null, 2)
  )
  const retained = await readFixture()
  assert.ok(retained.listing)
  const proofErrors: unknown[] = []
  for (const verify of [verifySocialPagination, verifySocialAdmission]) {
    try {
      await verify(cohort, campaign.id, retained.listing.id, evidenceDirectory)
    } catch (error) {
      proofErrors.push(error)
    }
  }
  if (proofErrors.length) throw new AggregateError(proofErrors, 'Social concurrency proof failed.')
  const remaining = await readFixture()
  assert.ok(remaining.listing && invitee.profileId)
  if (!remaining.invitations.some((invitation) => invitation.status === 'PENDING'))
    await owner.client.mutation(api.social.invitations.create, {
      listingPublicId: remaining.listing.id,
      expectedListingVersion: remaining.listing.version,
      username: player.username
    })
  await owner.client.mutation(api.social.blocks.create, { profilePublicId: invitee.profileId })
  console.log(
    'Native Social browser, private admission, retained membership and fixture-scoped retention proof passed.'
  )
}
