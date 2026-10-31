import {
  encounterGmProjectionDtoSchema,
  pendingEncounterRuleOccurrenceSummaryDtoSchema
} from '@artificer-toolkit/schema/api/encounters'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { ConvexHttpClient } from 'convex/browser'
import { hashPassword } from 'better-auth/crypto'
import { makeFunctionReference } from 'convex/server'
import { api } from '../convex/_generated/api.js'
import { srdBaselineContent } from '@artificer-toolkit/source-data/srd/index.js'
import {
  SRD_ACTION_ALLOWANCE_DEFINITION_ID,
  SRD_REACTION_ALLOWANCE_DEFINITION_ID
} from '@artificer-toolkit/source-data/srd/ruleState.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { encounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import type { SceneFogChunksPage, SceneFogLayersPage } from '@artificer-toolkit/schema/api/sceneFog'
import type { SceneFogLayer } from '@artificer-toolkit/shared/vtt/scene'
import {
  authoredDraftDtoSchema,
  authoredDraftListPageSchema,
  type AuthoredDraftResult
} from '@artificer-toolkit/schema/api/authoredDrafts'
import { authoredDetailResponseSchemas } from '@artificer-toolkit/schema/api/content'
import { authInvitationRedeemInputSchema } from '@artificer-toolkit/schema/api/auth'
import type { AuthoredSubjectKind } from '@artificer-toolkit/schema/projections/identity'
import type { BackgroundAuthoredDto } from '@artificer-toolkit/schema/subjects/background'
import type { ClassAuthoredDto } from '@artificer-toolkit/schema/subjects/class'
import type { FeatAuthoredDto } from '@artificer-toolkit/schema/subjects/feat'
import type { EquipmentAuthoredDto } from '@artificer-toolkit/schema/subjects/equipment'
import type { AuthoredPublishDraftInput } from '@artificer-toolkit/schema/api/authoredPublication'
import { expandNodeRuntimeResponse } from '@artificer-toolkit/schema/api/nodeRuntimeTransport'
import { artificerPortableContentDtoSchema } from '@artificer-toolkit/schema/api/imports'
import { stripPortableMetadata } from '@artificer-toolkit/shared/utils'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { developmentTarget } from './developmentTarget'
import { developmentCli as cli } from './developmentCli'
import type { SocialProofCohort } from './developmentSocial'
import {
  admitCampaignCustodyPlayers,
  assignCampaignCustodyCharacters,
  removeCampaignCustodyFixture,
  verifyCampaignCustody,
  type CampaignCustodyCohort
} from './developmentCampaignCustody'
import type { createEncounterLifecyclePolicyFixture } from './fixtures/encounterInitiative'
import { generateValidUsername } from './fixtures/generatedUsername'
import type { CharacterListPage } from '@artificer-toolkit/schema/api/characterList'
import type { CharacterDraftListPage } from '@artificer-toolkit/schema/api/characterDrafts'
import type { DevelopmentCampaignInspection } from '@artificer-toolkit/schema/api/developmentCampaignLifecycle'
import type {
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto,
  UpdateEncounterBlueprintInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  EncounterBlueprintListInput,
  EncounterBlueprintPage
} from '@artificer-toolkit/schema/api/encounterBlueprintPages'
import { assertDomainRejection, executeEncounterCommand } from './developmentClient'
import { DevelopmentHttpClient } from './developmentHttpClient'

// Backend integration only. Fixture invitation hashes use the existing internal
// component CLI; passwords/tokens stay in memory, and signup email is not scheduled.
const { mode, selector, deploymentUrl, siteUrl } = developmentTarget(process.env)
const directMembershipAccountFixture = process.argv.includes('--campaign-membership-browser')
const vttCheckpointMode = process.argv.includes('--vtt-browser')
  ? (process.env.VTT_CHECKPOINT_MODE?.trim() ?? null)
  : null
assert.ok(
  vttCheckpointMode === null ||
    vttCheckpointMode === 'retain-on-failure' ||
    vttCheckpointMode === 'resume' ||
    vttCheckpointMode === 'resume-retain',
  'VTT_CHECKPOINT_MODE must be retain-on-failure, resume, or resume-retain.'
)
const vttCheckpointPath = fileURLToPath(
  new URL(
    '../../../local-validation/local-convex-proofs/phase82-vtt-checkpoint/fixture.private.json',
    import.meta.url
  )
)
const vttCheckpointSections = [
  'fixture-ready',
  'door-convergence',
  'token-drag',
  'rule-convergence',
  'recovery'
] as const
type VttCheckpointSection = (typeof vttCheckpointSections)[number]
type VttCheckpointCredential = { email: string; password: string; userId: string }
type VttCheckpoint = {
  formatVersion: 1
  lastCompletedSection: VttCheckpointSection
  campaign: { id: string; name: string }
  scene: { definitionId: string; liveId: string }
  character: { id: string; userId: string }
  users: {
    gm: VttCheckpointCredential
    player: VttCheckpointCredential
    player2: VttCheckpointCredential
  }
}
const proveInvitationRedemptionRace =
  !directMembershipAccountFixture &&
  !process.argv.includes('--campaign-lifecycle') &&
  !process.argv.includes('--vtt-browser') &&
  !process.argv.includes('--v15-preview-browser')
assert.equal(process.env.CONVEX_DEPLOY_KEY, undefined, 'Use the selected development CLI identity.')
if (
  process.argv.includes('--checkpoint') ||
  process.argv.includes('--checkpoint-large') ||
  process.argv.includes('--encounter-disarm') ||
  process.argv.includes('--encounter-disarm-browser') ||
  process.argv.includes('--encounter-area-browser') ||
  process.argv.includes('--encounter-shove-aside-browser') ||
  process.argv.includes('--encounter-hide-browser') ||
  process.argv.includes('--encounter-player-browser')
) {
  assert.equal(mode, 'local', 'Receipt proof requires the verified isolated local backend.')
  assert.equal(process.env.CONVEX_SELF_HOSTED_URL, deploymentUrl.origin)
  assert.ok(process.env.CONVEX_SELF_HOSTED_ADMIN_KEY, 'Local fixture CLI credentials are required.')
}
const publicClient = new DevelopmentHttpClient(deploymentUrl.origin, {
  logger: false
})
const encounterBlueprintList = makeFunctionReference<
  'query',
  EncounterBlueprintListInput,
  EncounterBlueprintPage
>('encounters/blueprints:list')
const encounterBlueprintCreate = makeFunctionReference<
  'mutation',
  CreateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:create')
const encounterBlueprintUpdate = makeFunctionReference<
  'mutation',
  UpdateEncounterBlueprintInputDto,
  EncounterBlueprintDto
>('encounters/blueprints:update')
const accounts: Array<{
  email: string
  client?: DevelopmentHttpClient
  session?: string
}> = []
const recoveryFixtures: string[] = []
const socialFixtureGroups: SocialProofCohort[] = []
const custodySocialFixtureGroups: Array<{
  campaignId: string
  cohort: SocialProofCohort
}> = []
const playerTierFixtures: string[] = []
const campaignLifecycleAuthors: Array<{
  client: ConvexHttpClient
  ownerUserId: string
  userIds: string[]
  deletions: Map<string, DevelopmentCampaignInspection>
}> = []
const characterFixtures: Array<{ userId: string; characterId: string }> = []
const collaborationAuthors: Array<{
  client: ConvexHttpClient
  userId: string
}> = []
const sessionControlOwners = new Set<string>()
const inventoryOwners = new Set<string>()
const sceneOwners = new Set<string>()
const workloadCampaignOwners = new Set<string>()
const vttCampaigns: Array<{ owner: ConvexHttpClient; campaignId: string }> = []
const characterBrowserAuthors: Array<{
  client: ConvexHttpClient
  userId: string
  fetchToken: () => Promise<string>
}> = []
const custodyFixtureCohorts: CampaignCustodyCohort[] = []
const encounterCampaignAuthors: Array<{
  client: ConvexHttpClient
  ownerUserId: string
  playerUserId: string
  characterId: string
}> = []
const notificationCampaigns: Array<{
  owner: ConvexHttpClient
  recipient: ConvexHttpClient
  recipientUserId: string
  campaignId: string
}> = []
const drafts: Array<{
  client: ConvexHttpClient
  subjectKind: AuthoredSubjectKind
  subjectId: string
}> = []
// Browser-created drafts must be found even if the browser fails before reporting their IDs.
const browserDraftAuthors: Array<{
  client: ConvexHttpClient
  subjectKind: AuthoredPublishDraftInput['subjectKind']
}> = []
const publicationAuthors: Array<{
  client: ConvexHttpClient
  userId: string
  systemId: string
  subjectKind: AuthoredPublishDraftInput['subjectKind']
}> = []
const blueprintAuthors: Array<{
  client: ConvexHttpClient
  userId: string
  gameSystemId: string
}> = []
const blueprintFixtures: Array<{ userId: string; blueprintId: string }> = []
const lifecyclePolicyFixtures: Array<
  ReturnType<typeof createEncounterLifecyclePolicyFixture>['cleanup']
> = []
let retainVttFixtureAfterFailure = false

function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value))
  return value as Record<string, unknown>
}

// The lists read content snapshots in the browser, so the proofs page a fixture account's own
// published subjects through the CLI-only development query.
async function ownedSubjects(
  { userId, systemId }: { userId: string; systemId: string },
  subjectKind: AuthoredSubjectKind
) {
  const subjects: Array<{ id: string; label: string }> = []
  let cursor: string | null = null
  for (let pages = 0; pages < 20; pages++) {
    const result = record(
      await cli(
        'content/development:listOwnedFixtureSubjects',
        { userId, systemId, subjectKind, paginationOpts: { numItems: 48, cursor } },
        false
      )
    )
    assert.ok(Array.isArray(result.page) && typeof result.continueCursor === 'string')
    for (const item of result.page) {
      const { id, label } = record(item)
      assert.ok(typeof id === 'string' && typeof label === 'string')
      subjects.push({ id, label })
    }
    if (result.isDone === true) return subjects
    cursor = result.continueCursor
  }
  throw new Error('Fixture account owns more published subjects than a proof creates.')
}

async function deleteAllAuthRecords(model: string, field: string, value: string) {
  let cursor: string | null = null
  while (true) {
    const deleted = record(
      await cli('adapter:deleteMany', {
        input: { model, where: [{ field, value }] },
        paginationOpts: { numItems: 10, cursor }
      })
    )
    assert.equal(typeof deleted.isDone, 'boolean')
    if (deleted.isDone) return
    const deletedCount = deleted.count
    if (typeof deletedCount !== 'number') throw new Error('Invalid auth deletion count.')
    const nextCursor =
      deleted.pageStatus === 'SplitRecommended' || deleted.pageStatus === 'SplitRequired'
        ? (deleted.splitCursor ?? deleted.continueCursor)
        : deleted.continueCursor
    if (typeof nextCursor !== 'string') throw new Error('Invalid auth deletion cursor.')
    assert.ok(
      nextCursor !== cursor || deletedCount > 0,
      `Deleting ${model} fixture records made no progress.`
    )
    cursor = nextCursor
  }
}

function checkpointString(value: unknown, label: string): string {
  assert.ok(typeof value === 'string' && value.length > 0, `Invalid VTT checkpoint ${label}.`)
  return value
}

function checkpointCredential(value: unknown, label: string): VttCheckpointCredential {
  const credential = record(value)
  return {
    email: checkpointString(credential.email, `${label} email`),
    password: checkpointString(credential.password, `${label} password`),
    userId: checkpointString(credential.userId, `${label} user ID`)
  }
}

async function readVttCheckpoint(): Promise<VttCheckpoint> {
  const value = record(JSON.parse(await readFile(vttCheckpointPath, 'utf8')))
  assert.equal(value.formatVersion, 1, 'Unsupported VTT checkpoint format.')
  assert.ok(
    vttCheckpointSections.includes(value.lastCompletedSection as VttCheckpointSection),
    'Invalid VTT checkpoint section.'
  )
  const campaign = record(value.campaign)
  const scene = record(value.scene)
  const character = record(value.character)
  const users = record(value.users)
  return {
    formatVersion: 1,
    lastCompletedSection: value.lastCompletedSection as VttCheckpointSection,
    campaign: {
      id: checkpointString(campaign.id, 'Campaign ID'),
      name: checkpointString(campaign.name, 'Campaign name')
    },
    scene: {
      definitionId: checkpointString(scene.definitionId, 'Scene definition ID'),
      liveId: checkpointString(scene.liveId, 'live Scene ID')
    },
    character: {
      id: checkpointString(character.id, 'Character ID'),
      userId: checkpointString(character.userId, 'Character owner ID')
    },
    users: {
      gm: checkpointCredential(users.gm, 'GM'),
      player: checkpointCredential(users.player, 'player'),
      player2: checkpointCredential(users.player2, 'second player')
    }
  }
}

function nextVttCheckpointSection(section: VttCheckpointSection): VttCheckpointSection | null {
  const index = vttCheckpointSections.indexOf(section)
  return vttCheckpointSections[index + 1] ?? null
}

function movementContact(
  pathDistance: number,
  origin: { x: number; y: number },
  destination: { x: number; y: number }
) {
  const length = Math.hypot(destination.x - origin.x, destination.y - origin.y)
  assert.ok(length > 0)
  return {
    x: origin.x + ((destination.x - origin.x) * pathDistance) / length,
    y: origin.y + ((destination.y - origin.y) * pathDistance) / length
  }
}

function reactionAllowanceUsed(run: unknown, actorId: string): number {
  const projection = encounterGmProjectionDtoSchema.parse(run)
  const actor = projection.actors.find((entry) => entry.id === actorId)
  assert.ok(actor)
  return encounterRuleUsageUsed(actor, SRD_REACTION_ALLOWANCE_DEFINITION_ID)
}

function actionAllowanceUsed(run: unknown, actorId: string): number {
  const projection = encounterGmProjectionDtoSchema.parse(run)
  const actor = projection.actors.find((entry) => entry.id === actorId)
  assert.ok(actor)
  return encounterRuleUsageUsed(actor, SRD_ACTION_ALLOWANCE_DEFINITION_ID)
}

/** Sends an auth request; a 429 waits the server's bounded `X-Retry-After`, as the browser clients do. */
async function auth(path: string, body?: Record<string, unknown>, session?: string) {
  for (let retry = 0; ; retry++) {
    const response = await fetch(new URL(`/api/auth${path}`, siteUrl), {
      method: body ? 'POST' : 'GET',
      headers: {
        origin: 'http://localhost:3000',
        'content-type': 'application/json',
        ...(session ? { authorization: `Bearer ${session}` } : {})
      },
      body: body ? JSON.stringify(body) : undefined,
      redirect: 'manual',
      signal: AbortSignal.timeout(30_000)
    })
    if (response.status !== 429 || retry === 3) return response
    const retrySeconds = Number(response.headers.get('X-Retry-After'))
    assert.ok(
      Number.isInteger(retrySeconds) && retrySeconds > 0 && retrySeconds <= 10,
      "Auth rate limit requires the server's bounded retry delay."
    )
    console.log(`Auth rate limit on ${path}: waiting ${retrySeconds}s before retry ${retry + 1}.`)
    await new Promise((resolve) => setTimeout(resolve, retrySeconds * 1000))
  }
}

async function responseToken(response: Response) {
  assert.equal(response.status, 200, 'Expected authenticated HTTP response.')
  const body = record(await response.json())
  assert.equal(typeof body.token, 'string')
  return body.token as string
}

async function authToken(session: string | undefined) {
  let response = await auth('/convex/token', undefined, session)
  for (let retry = 0; response.status === 500 && retry < 3; retry++) {
    await new Promise((resolve) => setTimeout(resolve, (retry + 1) * 1000))
    response = await auth('/convex/token', undefined, session)
  }
  return responseToken(response)
}

async function createAuthor() {
  const { username } = generateValidUsername('Draft_')
  const email = `${username.toLowerCase()}@example.invalid`
  const fixture: (typeof accounts)[number] = { email }
  accounts.push(fixture)
  const password = `Proof_8${randomBytes(24).toString('base64url')}!`
  if (directMembershipAccountFixture) {
    const now = Date.now()
    const user = record(
      await cli('adapter:create', {
        input: {
          model: 'user',
          data: {
            name: username,
            email,
            emailVerified: true,
            username: username.toLowerCase(),
            displayUsername: username,
            createdAt: now,
            updatedAt: now
          }
        }
      })
    )
    const authUserId = user._id
    assert.equal(typeof authUserId, 'string')
    await cli('auth:onCreate', { model: 'user', doc: user }, false)
    await cli('adapter:create', {
      input: {
        model: 'account',
        data: {
          accountId: authUserId,
          providerId: 'credential',
          userId: authUserId,
          password: await hashPassword(password),
          createdAt: now,
          updatedAt: now
        }
      }
    })
  } else {
    const token = randomBytes(32).toString('hex')
    const redemption = authInvitationRedeemInputSchema.parse({
      email,
      username,
      token,
      password
    })
    await cli('adapter:create', {
      input: {
        model: 'verification',
        data: {
          identifier: `account-invitation:${email}`,
          value: createHash('sha256').update(token).digest('hex'),
          expiresAt: Date.now() + 15 * 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
    let redemptions: Response[]
    if (proveInvitationRedemptionRace)
      redemptions = await Promise.all([
        auth('/invitation/redeem', redemption),
        auth('/invitation/redeem', redemption)
      ])
    else {
      let response = await auth('/invitation/redeem', redemption)
      for (let retry = 1; [400, 500].includes(response.status) && retry <= 3; retry++) {
        console.log(
          'Lifecycle fixture invitation returned ' +
            response.status +
            '; retrying ' +
            retry +
            '/3 after ' +
            retry +
            's.'
        )
        await new Promise((resolve) => setTimeout(resolve, retry * 1000))
        response = await auth('/invitation/redeem', redemption)
      }
      redemptions = [response]
    }
    assert.deepEqual(
      redemptions.map((response) => response.status).sort((left, right) => left - right),
      proveInvitationRedemptionRace ? [200, 400] : [200],
      proveInvitationRedemptionRace
        ? 'Exactly one concurrent redemption must succeed.'
        : 'Lifecycle fixture invitation redemption must succeed.'
    )
    for (const response of redemptions) {
      assert.equal(
        response.headers.get('set-cookie'),
        null,
        'Redemption must not create a session.'
      )
    }
  }
  fixture.session = await responseToken(await auth('/sign-in/email', { email, password }))
  const jwt = await authToken(fixture.session)
  const claims = record(JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')))
  assert.ok(!('email' in claims) && !('name' in claims), 'JWT must not include profile PII.')
  fixture.client = new DevelopmentHttpClient(deploymentUrl.origin, {
    logger: false
  })
  fixture.client.setAuth(jwt)
  const identity = await fixture.client.query(api.account.identity, {})
  assert.equal(identity.role, 'user')
  console.log(
    directMembershipAccountFixture
      ? 'Direct local fixture account authenticated through email/password and native bearer/JWT.'
      : 'Concurrent invitation consumption passed; author authenticated through email/password and native bearer/JWT.'
  )
  return {
    client: fixture.client,
    identity,
    email,
    password,
    username,
    session: fixture.session,
    fetchToken: async () => authToken(fixture.session)
  }
}

async function restoreAuthor(credential: VttCheckpointCredential) {
  const session = await responseToken(
    await auth('/sign-in/email', { email: credential.email, password: credential.password })
  )
  const jwt = await authToken(session)
  const claims = record(JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString('utf8')))
  assert.ok(!('email' in claims) && !('name' in claims), 'JWT must not include profile PII.')
  const client = new DevelopmentHttpClient(deploymentUrl.origin, { logger: false })
  client.setAuth(jwt)
  const identity = await client.query(api.account.identity, {})
  assert.equal(identity.role, 'user')
  assert.equal(identity.userId, credential.userId, 'Retained VTT fixture user identity changed.')
  accounts.push({ email: credential.email, client, session })
  return {
    client,
    identity,
    email: credential.email,
    password: credential.password,
    session,
    fetchToken: async () => authToken(session)
  }
}

function depth(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  return 1 + Math.max(0, ...Object.values(value).map(depth))
}

async function waitForCampaignDeletion(
  owner: ConvexHttpClient,
  campaignId: string,
  fixtureName: string
) {
  const deadline = Date.now() + 300_000
  while (true) {
    const status = await owner.query(api.campaigns.deletion.status, { campaignId })
    if (status.status === 'FAILED')
      throw new Error(`${fixtureName} Campaign deletion failed: ${status.error}`)
    if (status.status === 'DELETED') return
    if (Date.now() >= deadline)
      throw new Error(`${fixtureName} Campaign deletion timed out at ${status.status}.`)
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
}

/**
 * Deletes the VTT fixture Campaigns. Deletion tells the Session Worker to drop each room, so the
 * browser proof runs it while its Playwright-managed Worker is still up.
 */
async function deleteVttCampaigns() {
  while (vttCampaigns.length) {
    const fixture = vttCampaigns[0]!
    const campaign = await fixture.owner.query(api.campaigns.queries.get, {
      id: fixture.campaignId
    })
    assert.deepEqual(
      await fixture.owner.mutation(api.campaigns.deletion.remove, {
        campaignId: fixture.campaignId,
        expectedVersion: campaign.version,
        confirmation: 'DELETE'
      }),
      { ok: true }
    )
    await waitForCampaignDeletion(fixture.owner, fixture.campaignId, 'VTT fixture')
    vttCampaigns.shift()
  }
}

async function cleanup() {
  for (const fixture of accounts) {
    if (fixture.client && fixture.session) fixture.client.setAuth(await authToken(fixture.session))
  }
  for (const cohort of socialFixtureGroups) {
    const campaigns = await cohort.owner.client.query(api.campaigns.queries.list, {
      paginationOpts: { cursor: null, numItems: 8 }
    })
    assert.equal(campaigns.isDone, true)
    assert.ok(campaigns.page.length <= 1)
    for (const campaign of campaigns.page) {
      assert.equal(campaign.name, 'Encounter execution fixture')
      await cli(
        'social/developmentFixtures:removeFixtureState',
        {
          ownerUserId: cohort.owner.userId,
          playerUserId: cohort.player.userId,
          inviteeUserId: cohort.invitee.userId,
          moderatorUserId: cohort.moderator.userId,
          campaignId: campaign.id
        },
        false
      )
      await cli(
        'encounters/developmentCampaign:removeFixtureCampaign',
        {
          ownerUserId: cohort.owner.userId,
          playerUserId: cohort.player.userId,
          campaignId: campaign.id,
          characterId: crypto.randomUUID()
        },
        false
      )
    }
  }
  const recoveryFailures: string[] = []
  for (const email of recoveryFixtures) {
    assert.match(email, /^(?:unknown-)?draft_[0-9a-f]{12}@example\.invalid$/)
    for (const [model, field, value] of [
      ['verification', 'identifier', `forget-password-otp-${email}`],
      ['rateLimit', 'key', `recovery-account:${email}`]
    ]) {
      try {
        await deleteAllAuthRecords(model, field, value)
      } catch {
        recoveryFailures.push(`${model} for ${email}`)
      }
    }
  }
  for (const fixture of notificationCampaigns) {
    const announcements = await fixture.owner.query(api.campaigns.announcements.list, {
      campaignId: fixture.campaignId,
      paginationOpts: { cursor: null, numItems: 8 }
    })
    assert.equal(announcements.isDone, true)
    assert.ok(announcements.page.length <= 2)
    if (announcements.page.length) {
      await cli(
        'notifications/development:removeFixtureDelivery',
        {
          userId: fixture.recipientUserId,
          sourcePublicIds: announcements.page.map((item) => item.announcementPublicId)
        },
        false
      )
      assert.deepEqual((await fixture.recipient.query(api.notifications.feed, {})).items, [])
    }
  }
  // These accounts are created by this run only. Remove published roots through the real
  // product command before discarding retained drafts or deleting fixture identities.
  // Discover even a Campaign whose creation succeeded but whose HTTP response was lost.
  for (const author of collaborationAuthors) {
    await author.client.mutation(api.rolls.clearHistory, {})
    assert.deepEqual(await author.client.query(api.rolls.history, {}), [])
  }
  for (const author of campaignLifecycleAuthors) {
    const { one, tables } = await import('./developmentCampaignLifecycle')
    const campaigns = await author.client.query(api.campaigns.queries.list, {
      paginationOpts: { cursor: null, numItems: 16 }
    })
    assert.equal(campaigns.isDone, true, 'Fresh lifecycle fixture must fit its complete list.')
    assert.ok(campaigns.page.length <= 16, 'Unexpected lifecycle fixture Campaign count.')
    const deletions = new Map(author.deletions)
    for (const campaign of campaigns.page) {
      assert.equal(campaign.name, 'Encounter execution fixture')
      if (deletions.has(campaign.id)) continue
      const fixture = {
        ownerUserId: author.ownerUserId,
        campaignId: campaign.id,
        gameSystemId: srdSystemRecord.id,
        userIds: author.userIds
      }
      const { developmentCampaignInspectionSchema } =
        await import('@artificer-toolkit/schema/api/developmentCampaignLifecycle')
      const before = developmentCampaignInspectionSchema.parse(
        await cli('campaigns/developmentLifecycle:inspect', fixture, false)
      )
      deletions.set(campaign.id, before)
    }
    assert.ok(deletions.size <= 16, 'Unexpected lifecycle fixture Campaign count.')
    for (const [campaignId, before] of deletions) {
      const root = one(tables(before.campaignStateJson), 'campaigns')
      assert.equal(root.id, campaignId)
      assert.equal(root.name, 'Encounter execution fixture')
      assert.equal(root.ownerUserId, author.ownerUserId)
      assert.ok(root.status === 'ACTIVE' || root.status === 'ARCHIVED')
      assert.ok(typeof root.version === 'number')
      assert.deepEqual(
        await author.client.mutation(api.campaigns.deletion.remove, {
          campaignId,
          expectedVersion: root.version,
          confirmation: 'DELETE'
        }),
        { ok: true }
      )
      const fixture = {
        ownerUserId: author.ownerUserId,
        campaignId,
        gameSystemId: srdSystemRecord.id,
        userIds: author.userIds
      }
      const deadline = Date.now() + 300_000
      while (true) {
        const status = await author.client.query(api.campaigns.deletion.status, { campaignId })
        if (status.status === 'FAILED')
          throw new Error(`Lifecycle fixture deletion failed: ${status.error}`)
        if (status.status === 'DELETED') {
          try {
            assert.equal(
              await cli(
                'campaigns/developmentLifecycle:assertRemoved',
                { fixture, descendants: before.descendants },
                false
              ),
              null
            )
            break
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
          throw new Error(`Lifecycle fixture deletion timed out at ${status.status}.`)
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
  }
  await deleteVttCampaigns()
  for (const cohort of custodyFixtureCohorts) await removeCampaignCustodyFixture(cohort)
  for (const { campaignId, cohort } of custodySocialFixtureGroups) {
    await cli(
      'social/developmentFixtures:removeFixtureState',
      {
        ownerUserId: cohort.owner.userId,
        playerUserId: cohort.player.userId,
        inviteeUserId: cohort.invitee.userId,
        moderatorUserId: cohort.moderator.userId,
        campaignId
      },
      false
    )
  }
  for (const { client, ...fixture } of encounterCampaignAuthors) {
    const campaigns = await client.query(api.campaigns.queries.list, {
      paginationOpts: { cursor: null, numItems: 8 }
    })
    assert.equal(campaigns.isDone, true, 'Fresh Encounter fixture exceeds one Campaign page.')
    for (const campaign of campaigns.page) {
      assert.equal(campaign.name, 'Encounter execution fixture')
      if (workloadCampaignOwners.has(fixture.ownerUserId)) {
        assert.deepEqual(
          await client.mutation(api.campaigns.deletion.remove, {
            campaignId: campaign.id,
            expectedVersion: campaign.version,
            confirmation: 'DELETE'
          }),
          { ok: true }
        )
        const remaining = await client.query(api.campaigns.queries.list, {
          paginationOpts: { cursor: null, numItems: 8 }
        })
        assert.equal(remaining.isDone, true)
        assert.equal(
          remaining.page.some((item) => item.id === campaign.id),
          false
        )
        await waitForCampaignDeletion(client, campaign.id, 'Workload')
        continue
      }
      if (sceneOwners.has(fixture.ownerUserId)) {
        await cli(
          'encounters/developmentRuns:removeFixtureState',
          { ...fixture, campaignId: campaign.id },
          false
        )
        const page = {
          campaignId: campaign.id,
          paginationOpts: { cursor: null, numItems: 8 }
        }
        const definitions = await client.query(api.scenes.definitionReads.list, page)
        assert.equal(definitions.isDone, true)
        // Deleting a Scene definition keeps its played live Scene and presentation, so the
        // live list decides whether Scene state remains.
        const liveScenes = await client.query(api.scenes.definitionReads.listLive, page)
        assert.equal(liveScenes.isDone, true)
        if (definitions.page.length || liveScenes.page.length) {
          await cli(
            'scenes/developmentScene:removeFixtureState',
            { ownerUserId: fixture.ownerUserId, campaignId: campaign.id },
            false
          )
          assert.deepEqual((await client.query(api.scenes.definitionReads.list, page)).page, [])
          assert.deepEqual((await client.query(api.scenes.definitionReads.listLive, page)).page, [])
        }
      }
      if (sessionControlOwners.has(fixture.ownerUserId)) {
        await cli(
          'campaigns/developmentSessionControl:removeFixtureState',
          {
            ...fixture,
            campaignId: campaign.id
          },
          false
        )
      }
      if (inventoryOwners.has(fixture.ownerUserId)) {
        await cli(
          'campaigns/developmentInventory:removeFixtureState',
          {
            ownerUserId: fixture.ownerUserId,
            playerUserId: fixture.playerUserId,
            campaignId: campaign.id
          },
          false
        )
        const input = {
          campaignId: campaign.id,
          paginationOpts: { cursor: null, numItems: 8 }
        }
        for (const page of await Promise.all([
          client.query(api.campaigns.partyInventory.items, input),
          client.query(api.campaigns.partyInventory.currencies, input),
          client.query(api.campaigns.vehicles.list, input),
          client.query(api.campaigns.currencySystems.list, input)
        ])) {
          assert.equal(page.isDone, true)
          assert.deepEqual(page.page, [])
        }
        const audit = await client.query(api.campaigns.inventoryAudit.list, {
          campaignId: campaign.id,
          limit: 50
        })
        assert.deepEqual(audit.events, [])
        assert.equal(audit.nextCursor, null)
      }
      await cli(
        'encounters/developmentCampaign:removeFixtureCampaign',
        {
          ...fixture,
          campaignId: campaign.id
        },
        false
      )
    }
  }
  for (const author of characterBrowserAuthors) {
    author.client.setAuth(await author.fetchToken())
    const ids = new Set<string>()
    for (const query of [api.characters.list.list, api.characters.drafts.list]) {
      let cursor: string | null = null
      do {
        const page: CharacterListPage | CharacterDraftListPage = await author.client.query(query, {
          paginationOpts: { cursor, numItems: 8 }
        })
        for (const item of page.page) ids.add('characterId' in item ? item.characterId : item.id)
        cursor = page.isDone ? null : page.continueCursor
      } while (cursor)
    }
    assert.ok(ids.size <= 3, 'Fresh Builder fixture unexpectedly exceeds three Characters.')
    for (const characterId of ids) characterFixtures.push({ userId: author.userId, characterId })
  }
  for (const fixture of characterFixtures)
    await cli('characters/development:removePersonalFixtureCharacter', fixture, false)
  for (const author of blueprintAuthors) {
    const owned = await author.client.query(encounterBlueprintList, {
      gameSystemId: author.gameSystemId,
      paginationOpts: { cursor: null, numItems: 8 }
    })
    assert.equal(owned.isDone, true, 'Fresh Blueprint author exceeds one list page.')
    for (const blueprint of owned.page) {
      if (!blueprintFixtures.some((fixture) => fixture.blueprintId === blueprint.id))
        blueprintFixtures.push({
          userId: author.userId,
          blueprintId: blueprint.id
        })
    }
  }
  for (const fixture of blueprintFixtures)
    await cli('encounters/development:removeFixtureBlueprint', fixture, false)
  for (const author of [...publicationAuthors].sort(
    (left, right) => Number(right.subjectKind === 'SPELL') - Number(left.subjectKind === 'SPELL')
  )) {
    // ponytail: these proofs create at most two Class or three Equipment generations.
    const passes = author.subjectKind === 'EQUIPMENT' ? 3 : 2
    for (let pass = 0; pass < passes; pass++) {
      for (const item of await ownedSubjects(author, author.subjectKind)) {
        for (let retry = 0; ; retry++) {
          try {
            await author.client.mutation(api.content.deletion.deleteActive, {
              subjectKind: author.subjectKind,
              subjectId: item.id
            })
            break
          } catch (error) {
            if (
              error instanceof Error &&
              error.message.includes('Function execution timed out') &&
              retry < 3
            ) {
              await new Promise((resolve) => setTimeout(resolve, (retry + 1) * 1000))
              continue
            }
            if (!['CLASS', 'EQUIPMENT'].includes(author.subjectKind) || pass === passes - 1)
              throw new Error('Cannot clean ' + item.id)
            break
          }
        }
      }
    }
  }
  for (const author of publicationAuthors) {
    await cli(
      'content/development:removeEmptyFixtureSource',
      {
        userId: author.userId,
        systemId: author.systemId
      },
      false
    )
  }
  for (const fixture of lifecyclePolicyFixtures)
    await cli('encounters/developmentPolicies:removeFixtureState', fixture, false)
  for (const { client, subjectKind } of browserDraftAuthors) {
    const owned = authoredDraftListPageSchema.parse(
      await client.query(api.content.drafts.list, {
        subjectKind,
        paginationOpts: { numItems: 48, cursor: null }
      })
    )
    assert.equal(owned.isDone, true, 'Fresh browser author unexpectedly exceeds one draft page.')
    for (const draft of owned.page) {
      if (!drafts.some((entry) => entry.client === client && entry.subjectId === draft.subjectId)) {
        drafts.push({ client, subjectKind, subjectId: draft.subjectId })
      }
    }
  }
  const failures: string[] = []
  for (const draft of drafts) {
    try {
      const { client, ...lookup } = draft
      if (await client.query(api.content.drafts.get, lookup)) {
        await client.mutation(api.content.drafts.discard, lookup)
      }
      assert.equal(await client.query(api.content.drafts.get, lookup), null)
    } catch {
      failures.push(`draft ${draft.subjectId}`)
    }
  }
  // Never delete a fixture identity if its owned draft cleanup failed.
  if (failures.length) throw new Error(`Fixture cleanup incomplete: ${failures.join(', ')}`)
  for (const userId of playerTierFixtures)
    await cli('content/development:setFixturePlayerTier', { userId, enabled: false }, false)
  for (const author of campaignLifecycleAuthors)
    await cli('accountEntitlements:setTier', { userId: author.ownerUserId, tier: 'FREE' }, false)
  for (const fixture of accounts) {
    let cleanupStep = 'wait for Social account cascade'
    try {
      const socialCohort = [
        ...socialFixtureGroups,
        ...custodySocialFixtureGroups.map((group) => group.cohort)
      ].find((group) => group.moderator.email === fixture.email)
      if (
        socialCohort &&
        Object.values(socialCohort).every((account) => account.profileId !== null)
      ) {
        const subjects = [socialCohort.owner, socialCohort.player, socialCohort.invitee].map(
          (account) => ({
            userId: account.userId,
            profileId: account.profileId
          })
        )
        const deadline = Date.now() + 60_000
        while (
          (await cli(
            'social/developmentFixtures:accountCleanupComplete',
            {
              observerUserId: socialCohort.moderator.userId,
              subjects
            },
            false
          )) !== true
        ) {
          assert.ok(Date.now() < deadline, 'Scheduled Social account cleanup did not finish.')
          await new Promise((resolve) => setTimeout(resolve, 2000))
        }
        console.log(
          'Native Social account deletion removed blocks, invitations and delivery history through scheduled cleanup.'
        )
      }
      cleanupStep = 'look up exact account'
      assert.match(fixture.email, /^draft_[0-9a-f]{12}@example\.invalid$/)
      const user = await cli('adapter:findOne', {
        model: 'user',
        where: [{ field: 'email', value: fixture.email }],
        select: ['_id', 'email']
      })
      if (user) {
        const found = record(user)
        assert.equal(found.email, fixture.email)
        const userId = found._id
        if (typeof userId !== 'string') throw new Error('Invalid fixture user ID.')
        for (const model of ['session', 'account']) {
          cleanupStep = `delete and verify ${model} records`
          await deleteAllAuthRecords(model, 'userId', userId)
          assert.equal(
            await cli('adapter:findOne', {
              model,
              where: [{ field: 'userId', value: userId }],
              select: ['_id']
            }),
            null
          )
        }
        cleanupStep = 'schedule native account deletion'
        await cli('accountDeletion:schedule', { authUserId: userId }, false)
        cleanupStep = 'verify staged deletion removed the auth account'
        for (let attempt = 0; ; attempt += 1) {
          const remaining = await cli('adapter:findOne', {
            model: 'user',
            where: [{ field: 'email', value: fixture.email }],
            select: ['_id']
          })
          if (remaining === null) break
          assert.ok(attempt < 120, 'Staged account deletion did not finish.')
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
      cleanupStep = 'delete invitation verification'
      await deleteAllAuthRecords(
        'verification',
        'identifier',
        `account-invitation:${fixture.email}`
      )
      cleanupStep = 'verify stale JWT denial'
      if (fixture.client)
        await assert.rejects(fixture.client.query(api.account.identity, {}), /Unauthenticated/)
    } catch {
      failures.push(`account ${fixture.email} at ${cleanupStep}`)
    }
  }
  failures.push(...recoveryFailures)
  assert.equal(failures.length, 0, `Fixture cleanup incomplete: ${failures.join(', ')}`)
  for (const author of collaborationAuthors)
    await cli('media/assets:purgeAccount', { userId: author.userId }, false)
  for (const userId of sceneOwners) await cli('media/assets:purgeAccount', { userId }, false)
  if (sceneOwners.size)
    console.log(
      'Scene references removed and account media purge invoked; physical object deletion remains subject to the existing operation fence and requires later provider proof.'
    )
  if (accounts.length > 0)
    console.log(
      `Exact fixture drafts, aliases, ${accounts.length} accounts, sessions, credentials and profiles removed; stale JWTs denied.`
    )
}

const proofErrors: unknown[] = []
try {
  assert.equal(
    (await publicClient.query(api.application.featureFlags, {})).publicSignUpEnabled,
    false
  )
  if (process.argv.includes('--checkpoint') || process.argv.includes('--checkpoint-large')) {
    const owner = await createAuthor()
    const player = await createAuthor()
    const characterId = crypto.randomUUID()
    characterFixtures.push({ userId: player.identity.userId, characterId })
    for (const subjectKind of ['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE'] as const) {
      publicationAuthors.push({
        client: player.client,
        userId: player.identity.userId,
        systemId: srdSystemRecord.id,
        subjectKind
      })
      browserDraftAuthors.push({ client: player.client, subjectKind })
    }
    const { verifyDevelopmentCheckpoint } = await import('./developmentCheckpoint')
    await verifyDevelopmentCheckpoint({
      owner,
      player,
      characterId,
      large: process.argv.includes('--checkpoint-large')
    })
  } else if (
    process.argv.includes('--scene-authoring-browser') ||
    process.argv.includes('--scene-live-browser') ||
    process.argv.includes('--vtt-map-retention')
  ) {
    const owner = await createAuthor()
    const player = await createAuthor()
    sceneOwners.add(owner.identity.userId)
    encounterCampaignAuthors.push({
      client: owner.client,
      ownerUserId: owner.identity.userId,
      playerUserId: player.identity.userId,
      characterId: crypto.randomUUID()
    })
    const { SRD_RULES_CATALOGUE } = await import('@artificer-toolkit/source-data/srd/catalogue.js')
    const campaign = await owner.client.mutation(api.campaigns.create.create, {
      name: 'Encounter execution fixture',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await cli(
      'encounters/developmentCampaign:admitFixturePlayer',
      {
        ownerUserId: owner.identity.userId,
        playerUserId: player.identity.userId,
        campaignId: campaign.id
      },
      false
    )
    const { verifySceneAuthoring } = await import('./developmentSceneAuthoring')
    await verifySceneAuthoring({
      owner,
      player,
      anonymous: publicClient,
      campaignId: campaign.id,
      publicId: campaign.publicId,
      verifyLive: process.argv.includes('--scene-live-browser'),
      verifyRetention: process.argv.includes('--vtt-map-retention'),
      evidenceDirectory: fileURLToPath(
        new URL(
          `../../../local-validation/local-convex-proofs/${process.argv.includes('--vtt-map-retention') ? 'phase82-v04-retention' : process.argv.includes('--scene-live-browser') ? 'phase82-v02-live-scene' : 'phase82-scene-owner-live'}/attempt-${Date.now()}/`,
          import.meta.url
        )
      )
    })
  } else if (process.argv.includes('--social-browser')) {
    const { verifySocialLifecycle } = await import('./developmentSocial')
    const makeSocialAccount = async () => {
      // Better Auth resets this counter after ten idle seconds, not a fixed window.
      await new Promise((resolve) => setTimeout(resolve, 11_000))
      const account = await createAuthor()
      return { ...account, userId: account.identity.userId, profileId: null }
    }
    const cohort: SocialProofCohort = {
      owner: await makeSocialAccount(),
      player: await makeSocialAccount(),
      invitee: await makeSocialAccount(),
      moderator: await makeSocialAccount()
    }
    socialFixtureGroups.push(cohort)
    await verifySocialLifecycle(cohort, publicClient)
  } else if (process.argv.includes('--encounter-blueprints')) {
    const author = await createAuthor()
    const other = await createAuthor()
    const input = {
      gameSystemId: srdSystemRecord.id,
      name: 'Development Blueprint',
      commandId: crypto.randomUUID(),
      enemies: [{ kind: 'CUSTOM' as const, label: 'Proof Enemy', maxHitPoints: 10 }]
    }
    const listInput = {
      gameSystemId: srdSystemRecord.id,
      paginationOpts: { cursor: null, numItems: 8 }
    }
    blueprintAuthors.push({
      client: author.client,
      userId: author.identity.userId,
      gameSystemId: input.gameSystemId
    })
    await assert.rejects(publicClient.query(encounterBlueprintList, listInput), /Unauthenticated/)
    await assert.rejects(publicClient.mutation(encounterBlueprintCreate, input), /Unauthenticated/)
    const created = await author.client.mutation(encounterBlueprintCreate, input)
    blueprintFixtures.push({
      userId: author.identity.userId,
      blueprintId: created.id
    })
    assert.deepEqual(await author.client.mutation(encounterBlueprintCreate, input), created)
    await assert.rejects(
      author.client.mutation(encounterBlueprintCreate, {
        ...input,
        name: 'Changed'
      }),
      /different input/
    )
    assert.deepEqual((await author.client.query(encounterBlueprintList, listInput)).page, [created])
    assert.deepEqual((await other.client.query(encounterBlueprintList, listInput)).page, [])
    const update = {
      blueprintId: created.id,
      expectedVersion: 1,
      commandId: crypto.randomUUID(),
      name: 'Development Blueprint Updated',
      enemies: input.enemies
    }
    await assert.rejects(other.client.mutation(encounterBlueprintUpdate, update), /unavailable/)
    const updated = await author.client.mutation(encounterBlueprintUpdate, update)
    assert.equal(updated.version, 2)
    assert.deepEqual(await author.client.mutation(encounterBlueprintUpdate, update), updated)
    await assert.rejects(
      author.client.mutation(encounterBlueprintUpdate, {
        ...update,
        commandId: crypto.randomUUID()
      }),
      /stale/
    )
    console.log(
      JSON.stringify({
        target: { mode, selector },
        anonymousList: 'PASS',
        anonymousCreate: 'PASS',
        createReplay: 'PASS',
        createConflict: 'PASS',
        privateList: 'PASS',
        foreignUpdate: 'PASS',
        updateReplay: 'PASS',
        staleUpdate: 'PASS'
      })
    )
  } else if (process.argv.includes('--receipt-ledgers')) {
    assert.equal(mode, 'local', 'Receipt ledger proof requires the verified local backend.')
    assert.equal(process.env.CONVEX_SELF_HOSTED_URL, deploymentUrl.origin)
    assert.ok(
      process.env.CONVEX_SELF_HOSTED_ADMIN_KEY,
      'Local fixture CLI credentials are required.'
    )
    const author = await createAuthor()
    const characterId = crypto.randomUUID()
    characterFixtures.push({ userId: author.identity.userId, characterId })
    await author.client.mutation(api.characters.drafts.create, {
      id: characterId,
      systemId: srdSystemRecord.id
    })
    const { verifyDevelopmentReceiptLedgers } = await import('./developmentReceiptLedgers')
    const authUser = record(
      await cli('adapter:findOne', {
        model: 'user',
        where: [{ field: 'email', value: author.email }],
        select: ['_id']
      })
    )
    assert.equal(typeof authUser._id, 'string')
    let proof: Awaited<ReturnType<typeof verifyDevelopmentReceiptLedgers>>
    try {
      proof = await verifyDevelopmentReceiptLedgers({
        cli,
        userId: author.identity.userId,
        characterId,
        authUserId: String(authUser._id)
      })
    } finally {
      const { developmentReceiptLedgerRetirementInspectionSchema } =
        await import('@artificer-toolkit/schema/api/developmentReceiptLedger')
      const retired = developmentReceiptLedgerRetirementInspectionSchema.parse(
        await cli(
          'characters/developmentReceiptRetirement:inspect',
          { userId: author.identity.userId, characterId, authUserId: String(authUser._id) },
          false
        )
      )
      if (!retired.characterExists && !retired.profileExists) {
        const index = characterFixtures.findIndex((fixture) => fixture.characterId === characterId)
        if (index >= 0) characterFixtures.splice(index, 1)
      }
    }
    console.log(JSON.stringify({ receiptLedgers: proof }))
  } else if (process.argv.includes('--character-concurrency')) {
    const owner = await createAuthor()
    const foreign = await createAuthor()
    const peer = new DevelopmentHttpClient(deploymentUrl.origin, { logger: false })
    peer.setAuth(await owner.fetchToken())
    const ids = [crypto.randomUUID(), crypto.randomUUID()]
    for (const characterId of ids)
      characterFixtures.push({ userId: owner.identity.userId, characterId })
    for (const subjectKind of ['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE'] as const) {
      publicationAuthors.push({
        client: owner.client,
        userId: owner.identity.userId,
        systemId: srdSystemRecord.id,
        subjectKind
      })
      browserDraftAuthors.push({ client: owner.client, subjectKind })
    }
    const { prepareDevelopmentCharacter } = await import('./developmentCharacterFixture')
    const first = await prepareDevelopmentCharacter(owner.client, ids[0]!)
    const secondDraft = await owner.client.mutation(api.characters.drafts.create, {
      id: ids[1]!,
      systemId: srdSystemRecord.id
    })
    const { verifyCharacterConcurrency } = await import('./developmentCharacterConcurrency')
    const proof = await verifyCharacterConcurrency({
      owner: owner.client,
      peer,
      foreign: foreign.client,
      anonymous: publicClient,
      first: first.candidate,
      second: {
        ...first.candidate,
        expectedDraftId: secondDraft.id,
        character: { ...first.candidate.character, id: ids[1]! }
      }
    })
    const { verifyCharacterReconnect } = await import('./developmentCharacterReconnect')
    await verifyCharacterReconnect({
      url: deploymentUrl.origin,
      fetchToken: owner.fetchToken,
      peer,
      proof
    })
  } else if (process.argv.includes('--account-entitlements')) {
    const owner = await createAuthor()
    const other = await createAuthor()
    const setTier = makeFunctionReference<'mutation', { userId: string; tier: 'GM' }, null>(
      'accountEntitlements:setTier'
    )
    await assert.rejects(publicClient.query(api.accountEntitlements.get, {}), /Unauthenticated/)
    await assert.rejects(
      owner.client.mutation(setTier, {
        userId: owner.identity.userId,
        tier: 'GM'
      }),
      /Could not find public function|internal function/
    )
    const forgedRead = makeFunctionReference<'query', { userId: string }, unknown>(
      'accountEntitlements:get'
    )
    await assert.rejects(
      owner.client.query(forgedRead, { userId: other.identity.userId }),
      /extra field/
    )
    const characterId = crypto.randomUUID()
    characterFixtures.push({ userId: owner.identity.userId, characterId })
    const { verifyAccountEntitlementsBrowser } =
      await import('../../web/tests/live-backend/accountEntitlements')
    await verifyAccountEntitlementsBrowser({
      email: owner.email,
      password: owner.password,
      evidenceDirectory: fileURLToPath(
        new URL(
          '../../../local-validation/local-convex-proofs/phase82-entitlements/',
          import.meta.url
        )
      ),
      upgrade: async () => {
        await cli(
          'accountEntitlements:setTier',
          { userId: owner.identity.userId, tier: 'GM' },
          false
        )
        assert.equal((await owner.client.query(api.accountEntitlements.get, {})).tier, 'GM')
        assert.equal((await other.client.query(api.accountEntitlements.get, {})).tier, 'FREE')
      },
      createDraft: async () => {
        await owner.client.mutation(api.characters.drafts.create, {
          id: characterId,
          systemId: srdSystemRecord.id
        })
        assert.equal(
          (await owner.client.query(api.accountEntitlements.get, {})).usage.personalCharacters,
          1
        )
      },
      discardDraft: async () => {
        const draft = await owner.client.query(api.characters.drafts.get, {
          id: characterId
        })
        assert.ok(draft)
        await owner.client.mutation(api.characters.drafts.discard, {
          id: characterId,
          expectedDraftId: draft.id
        })
        assert.equal(
          (await owner.client.query(api.accountEntitlements.get, {})).usage.personalCharacters,
          0
        )
      }
    })
    const { ENTITLEMENT_LIMITS } = await import('@artificer-toolkit/shared/account/entitlements')
    await cli('accountEntitlements:setTier', { userId: owner.identity.userId, tier: 'FREE' }, false)
    const limit = ENTITLEMENT_LIMITS.FREE.personalCharacters
    const ids = Array.from({ length: limit + 1 }, () => crypto.randomUUID())
    for (const id of ids)
      characterFixtures.push({
        userId: owner.identity.userId,
        characterId: id
      })
    for (const id of ids.slice(0, limit - 1))
      await owner.client.mutation(api.characters.drafts.create, {
        id,
        systemId: srdSystemRecord.id
      })
    const race = await Promise.allSettled(
      ids
        .slice(limit - 1)
        .map((id) =>
          owner.client.mutation(
            api.characters.drafts.create,
            { id, systemId: srdSystemRecord.id },
            { skipQueue: true }
          )
        )
    )
    assert.equal(race.filter((result) => result.status === 'fulfilled').length, 1)
    const rejected = race.find((result) => result.status === 'rejected')
    assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof Error)
    assert.match(rejected.reason.message, /personalCharacters limit/)
    assert.equal(
      (await owner.client.query(api.accountEntitlements.get, {})).usage.personalCharacters,
      limit
    )
    assert.equal(
      (await other.client.query(api.accountEntitlements.get, {})).usage.personalCharacters,
      0
    )
    await cli('accountEntitlements:setTier', { userId: owner.identity.userId, tier: 'GM' }, false)
    const unusedId = ids.find(
      (id, index) => index >= limit - 1 && race[index - (limit - 1)]?.status === 'rejected'
    )
    assert.ok(unusedId)
    const overLimit = await owner.client.mutation(api.characters.drafts.create, {
      id: unusedId,
      systemId: srdSystemRecord.id
    })
    await cli('accountEntitlements:setTier', { userId: owner.identity.userId, tier: 'FREE' }, false)
    assert.equal(
      (await owner.client.query(api.accountEntitlements.get, {})).usage.personalCharacters,
      limit + 1
    )
    assert.equal(
      (await owner.client.query(api.characters.drafts.get, { id: unusedId }))?.id,
      overLimit.id
    )
    assert.equal(
      (
        await owner.client.mutation(api.characters.drafts.create, {
          id: unusedId,
          systemId: srdSystemRecord.id
        })
      ).id,
      overLimit.id
    )
    const blockedId = crypto.randomUUID()
    characterFixtures.push({
      userId: owner.identity.userId,
      characterId: blockedId
    })
    await assert.rejects(
      owner.client.mutation(api.characters.drafts.create, {
        id: blockedId,
        systemId: srdSystemRecord.id
      }),
      /personalCharacters limit/
    )
    console.log(
      'Native Account authorization, operator tier change, reactive browser usage, reload and final-slot Character race passed.'
    )
  } else if (process.argv.includes('--notification-delivery')) {
    const owner = await createAuthor()
    const recipient = await createAuthor()
    encounterCampaignAuthors.push({
      client: owner.client,
      ownerUserId: owner.identity.userId,
      playerUserId: recipient.identity.userId,
      characterId: crypto.randomUUID()
    })
    const { SRD_RULES_CATALOGUE } = await import('@artificer-toolkit/source-data/srd/catalogue.js')
    const campaign = await owner.client.mutation(api.campaigns.create.create, {
      name: 'Encounter execution fixture',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    notificationCampaigns.push({
      owner: owner.client,
      recipient: recipient.client,
      recipientUserId: recipient.identity.userId,
      campaignId: campaign.id
    })
    await cli(
      'encounters/developmentCampaign:admitFixturePlayer',
      {
        ownerUserId: owner.identity.userId,
        playerUserId: recipient.identity.userId,
        campaignId: campaign.id
      },
      false
    )
    const { verifyNotificationDelivery } = await import('./developmentNotificationDelivery')
    await verifyNotificationDelivery({
      owner: owner.client,
      recipient: recipient.client,
      anonymous: publicClient,
      campaignId: campaign.id,
      emailDelivery: mode === 'local' ? 'LOCAL_SINK' : 'RESEND',
      readDelivery: (sourcePublicIds) =>
        cli(
          'notifications/development:readFixtureDelivery',
          { userId: recipient.identity.userId, sourcePublicIds },
          false
        )
    })
  } else if (process.argv.includes('--character-builder-browser')) {
    const author = await createAuthor()
    characterBrowserAuthors.push({
      client: author.client,
      userId: author.identity.userId,
      fetchToken: author.fetchToken
    })
    const { verifyCharacterBrowser } = await import('./developmentCharacterBrowser')
    await verifyCharacterBrowser({
      email: author.email,
      password: author.password,
      session: author.session,
      userId: author.identity.userId,
      journey: 'builder'
    })
  } else if (process.argv.includes('--character-sheet-browser')) {
    const author = await createAuthor()
    const characterId = crypto.randomUUID()
    characterFixtures.push({ userId: author.identity.userId, characterId })
    for (const subjectKind of ['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE'] as const) {
      publicationAuthors.push({
        client: author.client,
        userId: author.identity.userId,
        systemId: srdSystemRecord.id,
        subjectKind
      })
      browserDraftAuthors.push({ client: author.client, subjectKind })
    }
    const { createDevelopmentCharacter } = await import('./developmentCharacterFixture')
    const { committed } = await createDevelopmentCharacter(author.client, characterId)
    const { verifyCharacterBrowser } = await import('./developmentCharacterBrowser')
    await verifyCharacterBrowser({
      email: author.email,
      password: author.password,
      session: author.session,
      userId: author.identity.userId,
      journey: 'sheet',
      characterPublicId: committed.publicId
    })
  } else if (process.argv.includes('--character-sheet-spells-browser')) {
    const author = await createAuthor()
    const characterId = crypto.randomUUID()
    characterFixtures.push({ userId: author.identity.userId, characterId })
    for (const subjectKind of ['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE', 'SPELL'] as const) {
      publicationAuthors.push({
        client: author.client,
        userId: author.identity.userId,
        systemId: srdSystemRecord.id,
        subjectKind
      })
      browserDraftAuthors.push({ client: author.client, subjectKind })
    }
    const { createDevelopmentSpellCharacter } = await import('./developmentSpellCharacterFixture')
    const { committed } = await createDevelopmentSpellCharacter(author.client, characterId)
    const { verifyCharacterBrowser } = await import('./developmentCharacterBrowser')
    await verifyCharacterBrowser({
      email: author.email,
      password: author.password,
      session: author.session,
      userId: author.identity.userId,
      journey: 'sheet-spells',
      characterPublicId: committed.publicId
    })
  } else if (process.argv.includes('--vtt-browser')) {
    assert.equal(mode, 'local', 'The VTT browser fixture requires the existing local backend.')
    const { verifyDevelopmentVttBrowser } = await import('./developmentVttBrowser')
    if (vttCheckpointMode === 'resume' || vttCheckpointMode === 'resume-retain') {
      retainVttFixtureAfterFailure = true
      const checkpoint = await readVttCheckpoint()
      const gm = await restoreAuthor(checkpoint.users.gm)
      const player = await restoreAuthor(checkpoint.users.player)
      const player2 = await restoreAuthor(checkpoint.users.player2)
      const startSection = nextVttCheckpointSection(checkpoint.lastCompletedSection)
      if (startSection) {
        const campaign = await gm.client.query(api.campaigns.queries.get, {
          id: checkpoint.campaign.id
        })
        assert.equal(campaign.id, checkpoint.campaign.id, 'Retained VTT Campaign identity changed.')
        assert.equal(campaign.name, checkpoint.campaign.name, 'Retained VTT Campaign name changed.')
        for (const expected of [
          { userId: checkpoint.users.gm.userId, role: 'OWNER' },
          { userId: checkpoint.users.player.userId, role: 'PLAYER' },
          { userId: checkpoint.users.player2.userId, role: 'PLAYER' }
        ] as const) {
          const membership = campaign.memberships.find((entry) => entry.userId === expected.userId)
          assert.equal(membership?.role, expected.role, 'Retained VTT Campaign membership changed.')
        }
        const definition = await gm.client.query(api.scenes.definitionReads.get, {
          campaignId: checkpoint.campaign.id,
          sceneId: checkpoint.scene.definitionId
        })
        assert.equal(
          definition.id,
          checkpoint.scene.definitionId,
          'Retained VTT Scene identity changed.'
        )
        const liveHeader = await gm.client.query(api.scenes.recipientReads.header, {
          sceneId: checkpoint.scene.liveId
        })
        assert.equal(
          liveHeader.id,
          checkpoint.scene.liveId,
          'Retained live Scene identity changed.'
        )
        assert.equal(
          liveHeader.definitionId,
          checkpoint.scene.definitionId,
          'Retained live Scene definition changed.'
        )
        assert.equal(
          liveHeader.campaignId,
          checkpoint.campaign.id,
          'Retained live Scene Campaign changed.'
        )
        assert.ok(liveHeader.snapshot, 'Retained VTT Scene compact snapshot is unavailable.')
        const presentation = await gm.client.query(api.scenes.presentations.get, {
          campaignId: checkpoint.campaign.id
        })
        assert.equal(presentation?.campaignId, checkpoint.campaign.id)
        assert.equal(presentation?.sceneId, checkpoint.scene.liveId)

        characterFixtures.push({
          userId: checkpoint.character.userId,
          characterId: checkpoint.character.id
        })
        sceneOwners.add(checkpoint.users.gm.userId)
        for (const subjectKind of ['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE'] as const) {
          publicationAuthors.push({
            client: player.client,
            userId: checkpoint.users.player.userId,
            systemId: srdSystemRecord.id,
            subjectKind
          })
          browserDraftAuthors.push({ client: player.client, subjectKind })
        }
        vttCampaigns.push({ owner: gm.client, campaignId: checkpoint.campaign.id })

        await verifyDevelopmentVttBrowser({
          campaignName: checkpoint.campaign.name,
          gm,
          player,
          player2,
          checkpoint: { path: vttCheckpointPath, startSection },
          ...(vttCheckpointMode === 'resume' ? { cleanupWhileWorkerRuns: deleteVttCampaigns } : {})
        })
      }
      retainVttFixtureAfterFailure = vttCheckpointMode === 'resume-retain'
    } else {
      const gm = await createAuthor()
      const player = await createAuthor()
      const player2 = await createAuthor()
      const campaignName = 'Encounter execution fixture'
      const characterId = crypto.randomUUID()
      characterFixtures.push({ userId: player.identity.userId, characterId })
      sceneOwners.add(gm.identity.userId)
      for (const subjectKind of ['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE'] as const) {
        publicationAuthors.push({
          client: player.client,
          userId: player.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind
        })
        browserDraftAuthors.push({ client: player.client, subjectKind })
      }
      const { createDevelopmentCharacter } = await import('./developmentCharacterFixture')
      await createDevelopmentCharacter(player.client, characterId)
      const { SRD_RULES_CATALOGUE } =
        await import('@artificer-toolkit/source-data/srd/catalogue.js')
      const campaign = await gm.client.mutation(api.campaigns.create.create, {
        name: campaignName,
        format: 'ONGOING',
        toneTags: ['HEROIC'],
        contentMaturity: 'STANDARD',
        gameSystemId: srdSystemRecord.id,
        primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
      })
      vttCampaigns.push({ owner: gm.client, campaignId: campaign.id })
      await admitCampaignCustodyPlayers({
        ownerUserId: gm.identity.userId,
        playerUserIds: [player.identity.userId, player2.identity.userId],
        campaignId: campaign.id
      })
      await player.client.mutation(api.campaigns.assignments.assign, {
        campaignId: campaign.id,
        characterId
      })
      const { createEncounterLifecycleScene } = await import('./developmentEncounterScenes')
      const scene = await createEncounterLifecycleScene({
        owner: gm.client,
        campaignId: campaign.id,
        name: 'Interactive campaign scene',
        options: {
          map: { width: 64, height: 64 },
          grid: {
            kind: 'SQUARE',
            origin: { x: 0, y: 0 },
            cellSize: 16,
            distancePerCell: 5,
            diagonalPolicy: 'EQUAL',
            unit: 'FEET'
          },
          barriers: [
            {
              id: crypto.randomUUID(),
              kind: 'DOOR',
              a: { x: 0, y: 48 },
              b: { x: 64, y: 48 },
              blocksLightWhenClosed: true,
              blocksMovementWhenClosed: true,
              initialState: 'CLOSED',
              openAngleDegrees: 90
            }
          ],
          tokens: [
            {
              id: crypto.randomUUID(),
              assetId: null,
              controlledByUserIds: [player.identity.userId],
              height: 8,
              hidden: false,
              label: 'Managed player token',
              locked: false,
              position: { x: 8, y: 8 },
              rotationDegrees: 0,
              senses: [],
              vision: null,
              width: 8
            },
            {
              id: crypto.randomUUID(),
              assetId: null,
              controlledByUserIds: [player2.identity.userId],
              height: 8,
              hidden: false,
              label: 'Managed second player token',
              locked: false,
              position: { x: 32, y: 8 },
              rotationDegrees: 0,
              senses: [],
              vision: null,
              width: 8
            },
            {
              id: crypto.randomUUID(),
              assetId: null,
              controlledByUserIds: [],
              height: 8,
              hidden: true,
              label: 'Managed VTT GM-only sentinel',
              locked: false,
              position: { x: 56, y: 8 },
              rotationDegrees: 0,
              senses: [],
              vision: null,
              width: 8
            }
          ]
        }
      })
      const presentation = await gm.client.action(api.scenes.presentations.setLive, {
        type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
        commandId: crypto.randomUUID(),
        campaignId: campaign.id,
        sceneId: scene.liveSceneId,
        expectedPresentationVersion: null
      })
      for (const participant of [gm, player, player2]) {
        assert.deepEqual(
          await participant.client.query(api.scenes.presentations.get, { campaignId: campaign.id }),
          {
            campaignId: campaign.id,
            sceneId: scene.liveSceneId,
            version: presentation.version
          }
        )
      }
      if (vttCheckpointMode === 'retain-on-failure') {
        const checkpoint: VttCheckpoint = {
          formatVersion: 1,
          lastCompletedSection: 'fixture-ready',
          campaign: { id: campaign.id, name: campaignName },
          scene: { definitionId: scene.sceneId, liveId: scene.liveSceneId },
          character: { id: characterId, userId: player.identity.userId },
          users: {
            gm: { email: gm.email, password: gm.password, userId: gm.identity.userId },
            player: {
              email: player.email,
              password: player.password,
              userId: player.identity.userId
            },
            player2: {
              email: player2.email,
              password: player2.password,
              userId: player2.identity.userId
            }
          }
        }
        await mkdir(dirname(vttCheckpointPath), { recursive: true })
        await writeFile(vttCheckpointPath, `${JSON.stringify(checkpoint, null, 2)}\n`, {
          encoding: 'utf8',
          flag: 'wx',
          mode: 0o600
        })
        retainVttFixtureAfterFailure = true
      }
      await verifyDevelopmentVttBrowser({
        campaignName,
        gm,
        player,
        player2,
        cleanupWhileWorkerRuns: deleteVttCampaigns,
        ...(vttCheckpointMode === 'retain-on-failure'
          ? {
              checkpoint: {
                path: vttCheckpointPath,
                startSection: 'door-convergence' as const
              }
            }
          : {})
      })
      retainVttFixtureAfterFailure = false
    }
  } else if (process.argv.includes('--campaign-lifecycle')) {
    assert.equal(mode, 'local', 'Campaign lifecycle proof requires the existing local backend.')
    const owner = await createAuthor()
    const lifecycleAuthor = {
      client: owner.client,
      ownerUserId: owner.identity.userId,
      userIds: [owner.identity.userId],
      deletions: new Map<string, DevelopmentCampaignInspection>()
    }
    campaignLifecycleAuthors.push(lifecycleAuthor)
    const player = await createAuthor()
    lifecycleAuthor.userIds.push(player.identity.userId)
    const outsider = await createAuthor()
    lifecycleAuthor.userIds.push(outsider.identity.userId)
    const invitee = await createAuthor()
    lifecycleAuthor.userIds.push(invitee.identity.userId)
    blueprintAuthors.push({
      client: owner.client,
      userId: owner.identity.userId,
      gameSystemId: srdSystemRecord.id
    })
    await cli(
      'accountEntitlements:setTier',
      { userId: owner.identity.userId, tier: 'PRO_GM' },
      false
    )
    for (const author of [owner, player]) {
      const subjects =
        author === player
          ? (['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE'] as const)
          : (['BACKGROUND'] as const)
      for (const subjectKind of subjects) {
        publicationAuthors.push({
          client: author.client,
          userId: author.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind
        })
        browserDraftAuthors.push({ client: author.client, subjectKind })
      }
    }
    const characterId = crypto.randomUUID()
    const archivedCharacterId = crypto.randomUUID()
    const unrelatedCharacterId = crypto.randomUUID()
    characterFixtures.push({ userId: player.identity.userId, characterId })
    characterFixtures.push({ userId: player.identity.userId, characterId: archivedCharacterId })
    characterFixtures.push({ userId: player.identity.userId, characterId: unrelatedCharacterId })
    const evidenceDirectory = process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY
    assert.ok(evidenceDirectory, 'Native Campaign lifecycle requires retained ignored evidence.')
    await mkdir(evidenceDirectory, { recursive: true })
    await writeFile(
      resolve(evidenceDirectory, 'fixture-scope.json'),
      JSON.stringify(
        {
          createdAtUtc: new Date().toISOString(),
          characterId,
          archivedCharacterId,
          unrelatedCharacterId,
          owner: { userId: owner.identity.userId, email: owner.email },
          player: { userId: player.identity.userId, email: player.email },
          outsider: { userId: outsider.identity.userId, email: outsider.email },
          invitee: {
            userId: invitee.identity.userId,
            email: invitee.email,
            username: invitee.username
          }
        },
        null,
        2
      ) + '\n',
      { flag: 'wx' }
    )
    const { createDevelopmentCharacter } = await import('./developmentCharacterFixture')
    await createDevelopmentCharacter(player.client, characterId)
    const baseline = await player.client.query(api.characters.builder.activeCharacter, {
      id: characterId
    })
    assert.ok(baseline)
    const unrelatedDraft = await player.client.mutation(api.characters.drafts.create, {
      id: unrelatedCharacterId,
      systemId: baseline.systemId
    })
    await player.client.mutation(api.characters.commit.commit, {
      expectedDraftId: unrelatedDraft.id,
      mode: 'create',
      character: {
        ...unrelatedDraft.payload.character,
        label: 'P09 unrelated personal Character',
        intent: baseline.intent
      }
    })
    const { verifyCampaignLifecycle } = await import('./developmentCampaignLifecycle')
    const lifecycleActors = [owner, player, outsider, invitee]
    const lifecycleInputs = {
      owner: owner.client,
      player: player.client,
      outsider: outsider.client,
      invitee: invitee.client,
      anonymous: publicClient,
      ownerUserId: owner.identity.userId,
      playerUserId: player.identity.userId,
      outsiderUserId: outsider.identity.userId,
      inviteeUserId: invitee.identity.userId,
      inviteeUsername: invitee.username,
      characterId,
      unrelatedCharacterId,
      onBeforeDeletion: (campaignId: string, before: DevelopmentCampaignInspection) => {
        lifecycleAuthor.deletions.set(campaignId, before)
      }
    }
    const activeProof = await verifyCampaignLifecycle({
      ...lifecycleInputs,
      deletionSourceStatus: 'ACTIVE'
    })
    for (const actor of lifecycleActors) actor.client.setAuth(await actor.fetchToken())
    const outsiderSocial = await outsider.client.mutation(api.social.profiles.initialize, {})
    assert.equal(typeof outsiderSocial.profilePublicId, 'string')
    await cli(
      'social/developmentFixtures:resetBlockPair',
      {
        blockerUserId: player.identity.userId,
        blockedUserId: outsider.identity.userId
      },
      false
    )
    assert.deepEqual(
      await player.client.query(api.social.blocks.getStatus, {
        profilePublicId: outsiderSocial.profilePublicId!
      }),
      { blocked: false }
    )
    await createDevelopmentCharacter(player.client, archivedCharacterId)
    const archivedProof = await verifyCampaignLifecycle({
      ...lifecycleInputs,
      characterId: archivedCharacterId,
      deletionSourceStatus: 'ARCHIVED'
    })
    for (const actor of lifecycleActors) actor.client.setAuth(await actor.fetchToken())
    assert.deepEqual(archivedProof.fixtureUsers, activeProof.fixtureUsers)
    const { verifyDevelopmentCampaignLifecycleBrowser } =
      await import('./developmentCampaignLifecycleBrowser')
    await verifyDevelopmentCampaignLifecycleBrowser({
      owner: owner.client,
      player: player.client,
      outsider: outsider.client,
      anonymous: publicClient,
      ownerUserId: owner.identity.userId,
      aliveUserIds: lifecycleAuthor.userIds,
      evidenceDirectory: resolve(evidenceDirectory, 'browser'),
      ownerCredential: { email: owner.email, password: owner.password },
      onBeforeDeletion: (campaignId, before) => {
        lifecycleAuthor.deletions.set(campaignId, before)
      }
    })
    const proof = {
      fixtureUsers: activeProof.fixtureUsers,
      evidence: [...activeProof.evidence, ...archivedProof.evidence],
      coverage:
        'Complete ACTIVE and ARCHIVED native Campaign lifecycle prepared through original public custody, Character, Scene, Run, admission and notebook producers with exact copy/replay/delete/rollback oracles; actual backend execution, post-collector native clocks, workload policy and browser journeys remain required.'
    }
    if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY)
      await writeFile(
        resolve(process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY, 'campaign-lifecycle-proof.json'),
        JSON.stringify(proof, null, 2) + '\n',
        { flag: 'wx' }
      )
  } else if (
    process.argv.includes('--campaign-custody') ||
    process.argv.includes('--campaign-item-producers') ||
    process.argv.includes('--campaign-vehicle-producers') ||
    process.argv.includes('--campaign-inventory-read-probe') ||
    process.argv.includes('--campaign-custody-browser') ||
    process.argv.includes('--campaign-membership-custody') ||
    process.argv.includes('--campaign-membership-browser') ||
    process.argv.includes('--campaign-currency-lifecycle') ||
    process.argv.includes('--campaign-assignment-lifecycle') ||
    process.argv.includes('--campaign-qualified-currency') ||
    process.argv.includes('--campaign-custody-authored-delete')
  ) {
    const owner = await createAuthor()
    const firstPlayer = await createAuthor()
    const secondPlayer = await createAuthor()
    const membershipObserver =
      process.argv.includes('--campaign-membership-custody') ||
      process.argv.includes('--campaign-membership-browser')
        ? await createAuthor()
        : null
    const players = [firstPlayer, secondPlayer] as const
    const playerUserIds = [firstPlayer.identity.userId, secondPlayer.identity.userId] as [
      string,
      string
    ]
    const characterIds = [crypto.randomUUID(), crypto.randomUUID()] as [string, string]
    publicationAuthors.push({
      client: owner.client,
      userId: owner.identity.userId,
      systemId: srdSystemRecord.id,
      subjectKind: 'VEHICLE'
    })
    browserDraftAuthors.push({ client: owner.client, subjectKind: 'VEHICLE' })
    for (const author of [owner, firstPlayer, secondPlayer]) {
      for (const subjectKind of ['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE'] as const) {
        publicationAuthors.push({
          client: author.client,
          userId: author.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind
        })
        browserDraftAuthors.push({ client: author.client, subjectKind })
      }
    }
    if (membershipObserver) {
      for (const author of players) {
        publicationAuthors.push({
          client: author.client,
          userId: author.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind: 'VEHICLE'
        })
        browserDraftAuthors.push({
          client: author.client,
          subjectKind: 'VEHICLE'
        })
      }
    }
    for (const [index, player] of players.entries()) {
      const characterId = characterIds[index]!
      characterFixtures.push({ userId: player.identity.userId, characterId })
      const { createDevelopmentCharacter } = await import('./developmentCharacterFixture')
      await createDevelopmentCharacter(player.client, characterId)
    }
    const { SRD_RULES_CATALOGUE } = await import('@artificer-toolkit/source-data/srd/catalogue.js')
    const campaign = await owner.client.mutation(api.campaigns.create.create, {
      name: 'Encounter execution fixture',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    encounterCampaignAuthors.push({
      client: owner.client,
      ownerUserId: owner.identity.userId,
      playerUserId: firstPlayer.identity.userId,
      characterId: characterIds[0]
    })
    await admitCampaignCustodyPlayers({
      ownerUserId: owner.identity.userId,
      playerUserIds,
      campaignId: campaign.id
    })
    const cohort: CampaignCustodyCohort = {
      owner: owner.client,
      players: [firstPlayer, secondPlayer],
      ownerUserId: owner.identity.userId,
      playerUserIds,
      characterIds,
      campaignId: campaign.id
    }
    custodyFixtureCohorts.push(cohort)
    let replacementCharacterId: string | undefined
    if (process.argv.includes('--campaign-assignment-lifecycle')) {
      replacementCharacterId = crypto.randomUUID()
      characterFixtures.push({
        userId: firstPlayer.identity.userId,
        characterId: replacementCharacterId
      })
      const baseline = await firstPlayer.client.query(api.characters.builder.activeCharacter, {
        id: characterIds[0]
      })
      assert.ok(baseline)
      const draft = await firstPlayer.client.mutation(api.characters.drafts.create, {
        id: replacementCharacterId,
        systemId: baseline.systemId
      })
      await firstPlayer.client.mutation(api.characters.commit.commit, {
        expectedDraftId: draft.id,
        mode: 'create',
        character: {
          ...draft.payload.character,
          label: 'Assignment replacement fixture',
          intent: baseline.intent
        }
      })
    }
    if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY) {
      await mkdir(process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY, {
        recursive: true
      })
      await writeFile(
        resolve(process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY, 'fixture-scope.json'),
        JSON.stringify(
          {
            campaignId: campaign.id,
            campaignCreatedAt: campaign.createdAt,
            characterIds,
            ...(replacementCharacterId
              ? { replacementCharacterId, replacementOwnerUserId: firstPlayer.identity.userId }
              : {}),
            accounts: [owner, firstPlayer, secondPlayer].map((author) => ({
              email: author.email,
              userId: author.identity.userId
            }))
          },
          null,
          2
        ) + '\n',
        { flag: 'wx' }
      )
    }
    await assignCampaignCustodyCharacters(cohort)
    if (process.argv.includes('--campaign-inventory-read-probe')) {
      const { verifyCampaignInventoryReadProbe } =
        await import('./developmentCampaignInventoryReadProbe')
      const proof = await verifyCampaignInventoryReadProbe(cohort, {
        deploymentUrl: deploymentUrl.origin,
        ownerFetchToken: owner.fetchToken
      })
      if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY)
        await writeFile(
          resolve(process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY, 'inventory-read-probe.json'),
          JSON.stringify(proof, null, 2) + '\n',
          { flag: 'wx' }
        )
    } else if (process.argv.includes('--campaign-vehicle-producers')) {
      const { verifyCampaignVehicleProducers } =
        await import('./developmentCampaignVehicleProducers')
      const proof = await verifyCampaignVehicleProducers(cohort, publicClient)
      if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY)
        await writeFile(
          resolve(process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY, 'vehicle-producers.json'),
          JSON.stringify(proof, null, 2) + '\n',
          { flag: 'wx' }
        )
    } else if (process.argv.includes('--campaign-item-producers')) {
      const { verifyCampaignItemProducers } = await import('./developmentCampaignItemProducers')
      const proof = await verifyCampaignItemProducers(cohort, publicClient)
      if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY)
        await writeFile(
          resolve(process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY, 'item-producer-proof.json'),
          JSON.stringify(proof, null, 2) + '\n',
          { flag: 'wx' }
        )
    } else if (process.argv.includes('--campaign-custody-authored-delete')) {
      const { verifyCampaignAuthoredCustodyDeletion } =
        await import('./developmentCampaignAuthoredCustodyDeletion')
      const proof = await verifyCampaignAuthoredCustodyDeletion(cohort, publicClient)
      if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY)
        await writeFile(
          resolve(
            process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY,
            'authored-custody-deletion-proof.json'
          ),
          JSON.stringify(proof, null, 2) + '\n',
          { flag: 'wx' }
        )
    } else if (process.argv.includes('--campaign-assignment-lifecycle')) {
      assert.ok(replacementCharacterId)
      const { verifyCampaignAssignmentLifecycle } =
        await import('./developmentCampaignAssignmentLifecycle')
      const proof = await verifyCampaignAssignmentLifecycle(
        cohort,
        publicClient,
        replacementCharacterId
      )
      if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY)
        await writeFile(
          resolve(
            process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY,
            'assignment-lifecycle-proof.json'
          ),
          JSON.stringify(proof, null, 2) + '\n',
          { flag: 'wx' }
        )
    } else if (process.argv.includes('--campaign-currency-lifecycle')) {
      const { verifyCampaignCurrencyLifecycle } =
        await import('./developmentCampaignCurrencyLifecycle')
      const proof = await verifyCampaignCurrencyLifecycle(cohort, publicClient)
      if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY)
        await writeFile(
          resolve(process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY, 'currency-lifecycle-proof.json'),
          JSON.stringify(proof, null, 2) + '\n',
          { flag: 'wx' }
        )
    } else if (process.argv.includes('--campaign-qualified-currency')) {
      const { verifyCampaignQualifiedCurrencyCustody } =
        await import('./developmentCampaignQualifiedCurrencyCustody')
      const proof = await verifyCampaignQualifiedCurrencyCustody(cohort)
      if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY)
        await writeFile(
          resolve(process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY, 'qualified-currency-proof.json'),
          JSON.stringify(proof, null, 2) + '\n',
          { flag: 'wx' }
        )
    } else if (membershipObserver) {
      const membershipBrowser = process.argv.includes('--campaign-membership-browser')
      const { verifyCampaignMembershipLifecycle } =
        await import('./developmentCampaignMembershipLifecycle')
      const runMembershipLifecycle = (
        onStage?: Parameters<typeof verifyCampaignMembershipLifecycle>[3]
      ) =>
        verifyCampaignMembershipLifecycle(
          cohort,
          {
            client: membershipObserver.client,
            fetchToken: membershipObserver.fetchToken,
            userId: membershipObserver.identity.userId
          },
          async (profiles) => {
            const social: SocialProofCohort = {
              owner: {
                ...owner,
                userId: owner.identity.userId,
                profileId: profiles.owner
              },
              player: {
                ...firstPlayer,
                userId: firstPlayer.identity.userId,
                profileId: profiles.players[0]
              },
              invitee: {
                ...secondPlayer,
                userId: secondPlayer.identity.userId,
                profileId: profiles.players[1]
              },
              moderator: {
                ...membershipObserver,
                userId: membershipObserver.identity.userId,
                profileId: profiles.observer
              }
            }
            custodySocialFixtureGroups.push({
              campaignId: campaign.id,
              cohort: social
            })
            if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY)
              await writeFile(
                resolve(
                  process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY,
                  'membership-fixture-scope.json'
                ),
                JSON.stringify(
                  {
                    campaignId: campaign.id,
                    campaignCreatedAt: campaign.createdAt,
                    characterIds,
                    accounts: [social.owner, social.player, social.invitee, social.moderator].map(
                      (author) => ({
                        email: author.email,
                        userId: author.userId,
                        profileId: author.profileId
                      })
                    )
                  },
                  null,
                  2
                ) + '\n',
                { flag: 'wx' }
              )
          },
          onStage,
          membershipBrowser ? 'MEMBERSHIP_ONLY' : 'CUSTODY'
        )
      let proof: Awaited<ReturnType<typeof verifyCampaignMembershipLifecycle>>
      if (membershipBrowser) {
        const evidenceDirectory = process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY
        assert.ok(
          evidenceDirectory,
          'Membership browser proof requires its unique retained evidence directory.'
        )
        const { verifyCampaignMembershipBrowser } =
          await import('../../web/tests/live-backend/campaignMembership')
        proof = await verifyCampaignMembershipBrowser(
          {
            origin: 'http://localhost:3000',
            publicId: campaign.publicId,
            campaignId: campaign.id,
            evidenceDirectory: resolve(evidenceDirectory, 'membership-browser'),
            accounts: [
              { ...owner, userId: owner.identity.userId, characterIds: [] },
              {
                ...firstPlayer,
                userId: firstPlayer.identity.userId,
                characterIds: [characterIds[0]]
              },
              {
                ...secondPlayer,
                userId: secondPlayer.identity.userId,
                characterIds: [characterIds[1]]
              },
              {
                ...membershipObserver,
                userId: membershipObserver.identity.userId,
                characterIds: []
              }
            ]
          },
          runMembershipLifecycle
        )
      } else {
        proof = await runMembershipLifecycle()
      }
      if (!membershipBrowser)
        assert.ok(
          proof.departures.every((departure) => departure.contention?.performed === true),
          'Both public departures must run real unqueued contention.'
        )
      if (process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY)
        await writeFile(
          resolve(
            process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY,
            'membership-lifecycle-proof.json'
          ),
          JSON.stringify(proof, null, 2) + '\n',
          { flag: 'wx' }
        )
    } else {
      await verifyCampaignCustody(cohort, publicClient)
    }
    if (process.argv.includes('--campaign-custody-browser')) {
      const { verifyCampaignCustodyBrowser } = await import('./developmentCampaignCustodyBrowser')
      await verifyCampaignCustodyBrowser(cohort, {
        owner: { email: owner.email, password: owner.password },
        players: [
          { email: firstPlayer.email, password: firstPlayer.password },
          { email: secondPlayer.email, password: secondPlayer.password }
        ],
        publicId: campaign.publicId,
        evidenceDirectory:
          process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY ??
          'local-validation/local-convex-proofs/movement-replay-duplicates-20260916/custody-browser-01/attempt01'
      })
    }
  } else if (process.argv.includes('--campaign-inventory')) {
    const owner = await createAuthor()
    const player = await createAuthor()
    inventoryOwners.add(owner.identity.userId)
    publicationAuthors.push({
      client: owner.client,
      userId: owner.identity.userId,
      systemId: srdSystemRecord.id,
      subjectKind: 'VEHICLE'
    })
    browserDraftAuthors.push({ client: owner.client, subjectKind: 'VEHICLE' })
    encounterCampaignAuthors.push({
      client: owner.client,
      ownerUserId: owner.identity.userId,
      playerUserId: player.identity.userId,
      characterId: crypto.randomUUID()
    })
    const { SRD_RULES_CATALOGUE } = await import('@artificer-toolkit/source-data/srd/catalogue.js')
    const campaign = await owner.client.mutation(api.campaigns.create.create, {
      name: 'Encounter execution fixture',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await cli(
      'encounters/developmentCampaign:admitFixturePlayer',
      {
        ownerUserId: owner.identity.userId,
        playerUserId: player.identity.userId,
        campaignId: campaign.id
      },
      false
    )
    const { verifyCampaignInventory } = await import('./developmentCampaignInventory')
    await verifyCampaignInventory({
      owner: owner.client,
      player: player.client,
      anonymous: publicClient,
      campaignId: campaign.id
    })
  } else if (
    process.argv.includes('--campaign-collaboration-browser') ||
    process.argv.includes('--session-control')
  ) {
    const owner = await createAuthor()
    const player = await createAuthor()
    collaborationAuthors.push(
      { client: owner.client, userId: owner.identity.userId },
      { client: player.client, userId: player.identity.userId }
    )
    const characterId = crypto.randomUUID()
    const sessionControl = process.argv.includes('--session-control')
    if (sessionControl) sessionControlOwners.add(owner.identity.userId)
    characterFixtures.push({ userId: player.identity.userId, characterId })
    encounterCampaignAuthors.push({
      client: owner.client,
      ownerUserId: owner.identity.userId,
      playerUserId: player.identity.userId,
      characterId
    })
    for (const subjectKind of ['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE'] as const) {
      publicationAuthors.push({
        client: player.client,
        userId: player.identity.userId,
        systemId: srdSystemRecord.id,
        subjectKind
      })
      browserDraftAuthors.push({ client: player.client, subjectKind })
    }
    const { createDevelopmentCharacter } = await import('./developmentCharacterFixture')
    await createDevelopmentCharacter(
      player.client,
      characterId,
      sessionControl
        ? {
            resources: {
              id: crypto.randomUUID(),
              label: 'P15 daily charge',
              order: 0,
              availableAtLevel: 1,
              charges: {
                id: crypto.randomUUID(),
                resetKind: 'DAILY',
                limitKind: 'FIXED_AMOUNT',
                scalingKind: 'NONE',
                amount: 1
              }
            }
          }
        : {}
    )
    const { SRD_RULES_CATALOGUE } = await import('@artificer-toolkit/source-data/srd/catalogue.js')
    const campaign = await owner.client.mutation(api.campaigns.create.create, {
      name: 'Encounter execution fixture',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    await cli(
      'encounters/developmentCampaign:admitFixturePlayer',
      {
        ownerUserId: owner.identity.userId,
        playerUserId: player.identity.userId,
        campaignId: campaign.id
      },
      false
    )
    await player.client.mutation(api.campaigns.assignments.assign, {
      campaignId: campaign.id,
      characterId
    })
    if (sessionControl) {
      const { verifySessionControl } = await import('./developmentSessionControl')
      await verifySessionControl({
        owner,
        player,
        anonymous: publicClient,
        campaignId: campaign.id,
        characterId
      })
    } else {
      const { verifyCampaignCollaboration } = await import('./developmentCampaignCollaboration')
      await verifyCampaignCollaboration({
        owner,
        player,
        anonymous: publicClient,
        campaignId: campaign.id,
        publicId: campaign.publicId,
        evidenceDirectory: fileURLToPath(
          new URL(
            '../../../local-validation/local-convex-proofs/phase82-p14-complete',
            import.meta.url
          )
        )
      })
    }
  } else if (process.argv.includes('--campaign-content-browser')) {
    const owner = await createAuthor()
    const other = await createAuthor()
    encounterCampaignAuthors.push({
      client: owner.client,
      ownerUserId: owner.identity.userId,
      playerUserId: other.identity.userId,
      characterId: crypto.randomUUID()
    })
    publicationAuthors.push({
      client: owner.client,
      userId: owner.identity.userId,
      systemId: srdSystemRecord.id,
      subjectKind: 'EQUIPMENT'
    })
    browserDraftAuthors.push({
      client: owner.client,
      subjectKind: 'EQUIPMENT'
    })
    const { SRD_RULES_CATALOGUE } = await import('@artificer-toolkit/source-data/srd/catalogue.js')
    const { backpack } = await import('@artificer-toolkit/source-data/srd/equipment/backpack.js')
    const { club } = await import('@artificer-toolkit/source-data/srd/equipment/club.js')
    const campaign = await owner.client.mutation(api.campaigns.create.create, {
      name: 'Encounter execution fixture',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    for (const source of [backpack, club]) {
      const draft = await owner.client.mutation(api.content.drafts.duplicate, {
        subjectKind: 'EQUIPMENT',
        subjectId: source.id
      })
      assert.ok(draft.updatedAt)
      await owner.client.mutation(api.content.publication.publishDraft, {
        subjectKind: 'EQUIPMENT',
        subjectId: draft.subjectId,
        expectedDraftUpdatedAt: draft.updatedAt
      })
      await owner.client.mutation(api.campaigns.contentShares.share, {
        campaignId: campaign.id,
        subjectKind: 'EQUIPMENT',
        subjectId: draft.subjectId
      })
    }
    const initial = await owner.client.query(api.campaigns.queries.get, {
      id: campaign.id
    })
    const { verifyCampaignContentBrowser } =
      await import('../../web/tests/live-backend/campaignContent')
    await verifyCampaignContentBrowser({
      email: owner.email,
      password: owner.password,
      publicId: campaign.publicId,
      evidenceDirectory: fileURLToPath(
        new URL(
          '../../../local-validation/local-convex-proofs/phase82-campaign-native-detail/',
          import.meta.url
        )
      ),
      verifyRemoved: async (count) => {
        const detail = await owner.client.query(api.campaigns.queries.get, {
          id: campaign.id
        })
        assert.equal(detail.version, initial.version + count)
        const content = await owner.client.query(api.campaigns.contentShares.list, {
          campaignId: campaign.id,
          paginationOpts: { cursor: null, numItems: 8 }
        })
        assert.equal(content.isDone, true)
        assert.equal(content.page.length, 2 - count)
      }
    })
    console.log('Native Campaign detail, consecutive browser unshares and persisted reload passed.')
  } else if (process.argv.includes('--v15-preview-browser')) {
    assert.equal(mode, 'local', 'V15 preview diagnostic requires the existing local backend.')
    const owner = await createAuthor()
    const players = [await createAuthor()]
    for (let index = 1; index < 5; index++) players.push(await createAuthor())
    const { SRD_RULES_CATALOGUE } = await import('@artificer-toolkit/source-data/srd/catalogue.js')
    const campaign = await owner.client.mutation(api.campaigns.create.create, {
      name: 'Encounter execution fixture',
      format: 'ONGOING',
      toneTags: ['HEROIC'],
      contentMaturity: 'STANDARD',
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    })
    vttCampaigns.push({ owner: owner.client, campaignId: campaign.id })
    for (const player of players)
      await cli(
        'encounters/developmentCampaign:admitFixturePlayer',
        {
          ownerUserId: owner.identity.userId,
          playerUserId: player.identity.userId,
          campaignId: campaign.id
        },
        false
      )
    sceneOwners.add(owner.identity.userId)
    const { createEncounterLifecycleScene } = await import('./developmentEncounterScenes')
    const map = { width: 2048, height: 2048 }
    const tokenPosition = { x: 1724, y: 1024 }
    const scene = await createEncounterLifecycleScene({
      owner: owner.client,
      campaignId: campaign.id,
      name: 'Interactive campaign scene',
      options: {
        map,
        grid: {
          kind: 'SQUARE',
          origin: { x: 0, y: 0 },
          cellSize: 100,
          distancePerCell: 5,
          diagonalPolicy: 'EQUAL',
          unit: 'FEET'
        },
        tokens: [
          {
            id: crypto.randomUUID(),
            assetId: null,
            controlledByUserIds: players.map((player) => player.identity.userId),
            height: 100,
            hidden: false,
            label: 'V15 preview diagnostic token',
            locked: false,
            position: tokenPosition,
            rotationDegrees: 0,
            senses: [],
            vision: null,
            width: 100
          },
          {
            id: crypto.randomUUID(),
            assetId: null,
            controlledByUserIds: [],
            height: 100,
            hidden: false,
            label: 'V15 preview diagnostic sentinel',
            locked: false,
            position: { x: 324, y: 1024 },
            rotationDegrees: 0,
            senses: [],
            vision: null,
            width: 100
          }
        ]
      }
    })
    await owner.client.action(api.scenes.presentations.setLive, {
      type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
      commandId: crypto.randomUUID(),
      campaignId: campaign.id,
      sceneId: scene.liveSceneId,
      expectedPresentationVersion: null
    })
    const evidenceDirectory =
      process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY ??
      fileURLToPath(
        new URL(
          `../../../local-validation/local-convex-proofs/phase82-v15-preview-browser/attempt-${Date.now()}/`,
          import.meta.url
        )
      )
    await mkdir(evidenceDirectory, { recursive: true })
    const { openV15WorkloadBrowser } =
      await import('../../web/tests/live-backend/v15WorkloadBrowser')
    const browser = await openV15WorkloadBrowser({
      owner: { email: owner.email, password: owner.password, username: owner.username },
      players: players.map(({ email, password, username }) => ({ email, password, username })),
      campaignPublicId: campaign.publicId,
      evidenceDirectory,
      map,
      tokenPosition
    })
    try {
      await browser.preview({ measure: false })
      console.log(
        `V15 preview diagnostic only (not full V15 acceptance): ${JSON.stringify({
          browserClients: 6,
          preview: 'passed',
          evidenceDirectory
        })}`
      )
    } finally {
      await browser.close()
    }
  } else if (
    process.argv.includes('--encounter-character') ||
    process.argv.includes('--encounter-lifecycle') ||
    process.argv.includes('--encounter-effects') ||
    process.argv.includes('--encounter-effects-browser') ||
    process.argv.includes('--encounter-movement-browser') ||
    process.argv.includes('--encounter-passage-browser') ||
    process.argv.includes('--encounter-action-contention') ||
    process.argv.includes('--encounter-disarm') ||
    process.argv.includes('--encounter-disarm-browser') ||
    process.argv.includes('--encounter-area-browser') ||
    process.argv.includes('--encounter-shove-aside-browser') ||
    process.argv.includes('--encounter-hide-browser') ||
    process.argv.includes('--encounter-player-browser') ||
    process.argv.includes('--encounter-heat-metal-browser') ||
    process.argv.includes('--encounter-held-effect-browser') ||
    process.argv.includes('--encounter-delegated-attack-browser') ||
    process.argv.includes('--encounter-summon-turn-browser') ||
    process.argv.includes('--encounter-v15-workload') ||
    process.argv.includes('--encounter-v15-preflight') ||
    process.argv.includes('--encounter-reaction-contention')
  ) {
    if (process.argv.includes('--encounter-v15-workload'))
      assert.equal(process.env.V15_BROWSER_PROOF, '1', 'Full V15 requires all six browser clients.')
    const owner = await createAuthor()
    const player = await createAuthor()
    const reactionContention = process.argv.includes('--encounter-reaction-contention')
    // The V15 workload and the V14.4 reaction race share the five-player, two-Campaign fixture.
    const workload =
      process.argv.includes('--encounter-v15-workload') ||
      process.argv.includes('--encounter-v15-preflight') ||
      reactionContention
    const workloadPlayers = [player]
    if (workload) for (let index = 1; index < 5; index++) workloadPlayers.push(await createAuthor())
    const characterId = crypto.randomUUID()
    const lifecycleSuite =
      process.argv.includes('--encounter-lifecycle') || process.argv.includes('--encounter-cutover')
    const movementBrowser =
      process.argv.includes('--encounter-movement-browser') ||
      process.argv.includes('--encounter-passage-browser')
    const passageBrowser = process.argv.includes('--encounter-passage-browser')
    const actionContention = process.argv.includes('--encounter-action-contention')
    const disarmBrowser = process.argv.includes('--encounter-disarm-browser')
    const disarm = process.argv.includes('--encounter-disarm') || disarmBrowser
    const effectsBrowser = process.argv.includes('--encounter-effects-browser')
    const effectJourney = process.argv.includes('--encounter-effects') || effectsBrowser
    const areaBrowser = process.argv.includes('--encounter-area-browser')
    const shoveAsideBrowser = process.argv.includes('--encounter-shove-aside-browser')
    const hideBrowser = process.argv.includes('--encounter-hide-browser')
    const playerBrowser = process.argv.includes('--encounter-player-browser')
    const heatMetalBrowser = process.argv.includes('--encounter-heat-metal-browser')
    const heldEffectBrowser = process.argv.includes('--encounter-held-effect-browser')
    const delegatedAttackBrowser = process.argv.includes('--encounter-delegated-attack-browser')
    const summonTurnBrowser = process.argv.includes('--encounter-summon-turn-browser')
    const lifecycle =
      lifecycleSuite ||
      movementBrowser ||
      effectJourney ||
      actionContention ||
      disarm ||
      areaBrowser ||
      shoveAsideBrowser ||
      hideBrowser ||
      playerBrowser ||
      heatMetalBrowser ||
      heldEffectBrowser ||
      delegatedAttackBrowser ||
      summonTurnBrowser ||
      workload
    if (lifecycle) sceneOwners.add(owner.identity.userId)
    if (workload) workloadCampaignOwners.add(owner.identity.userId)
    characterFixtures.push({ userId: player.identity.userId, characterId })
    encounterCampaignAuthors.push({
      client: owner.client,
      ownerUserId: owner.identity.userId,
      playerUserId: player.identity.userId,
      characterId
    })
    blueprintAuthors.push({
      client: owner.client,
      userId: owner.identity.userId,
      gameSystemId: srdSystemRecord.id
    })
    for (const subjectKind of [
      'EQUIPMENT',
      'BACKGROUND',
      'CLASS',
      'RACE',
      ...(playerBrowser ||
      heatMetalBrowser ||
      heldEffectBrowser ||
      delegatedAttackBrowser ||
      summonTurnBrowser
        ? (['SPELL'] as const)
        : [])
    ] as const) {
      publicationAuthors.push({
        client: player.client,
        userId: player.identity.userId,
        systemId: srdSystemRecord.id,
        subjectKind
      })
      browserDraftAuthors.push({ client: player.client, subjectKind })
    }
    const { createDevelopmentCharacter } = await import('./developmentCharacterFixture')
    const { createDevelopmentSpellCharacter } = await import('./developmentSpellCharacterFixture')
    const { shield } = await import('@artificer-toolkit/source-data/srd/spells/shield.js')
    const { thunderwave } = await import('@artificer-toolkit/source-data/srd/spells/thunderwave.js')
    const { heatMetal } = await import('@artificer-toolkit/source-data/srd/spells/heat-metal.js')
    const { findFamiliar } =
      await import('@artificer-toolkit/source-data/srd/spells/find-familiar.js')
    const { huntersMark } =
      await import('@artificer-toolkit/source-data/srd/spells/hunters-mark.js')
    const spellCharacter = playerBrowser
      ? await createDevelopmentSpellCharacter(player.client, characterId, [shield, thunderwave])
      : heatMetalBrowser
        ? await createDevelopmentSpellCharacter(
            player.client,
            characterId,
            [heatMetal],
            [{ spellLevel: 2, slotCount: 1 }]
          )
        : heldEffectBrowser
          ? await createDevelopmentSpellCharacter(
              player.client,
              characterId,
              [huntersMark],
              [{ spellLevel: 1, slotCount: 1 }]
            )
          : delegatedAttackBrowser
            ? await createDevelopmentSpellCharacter(
                player.client,
                characterId,
                [findFamiliar],
                [{ spellLevel: 1, slotCount: 1 }],
                (await import('./fixtures/encounterDelegatedAttack')).createDelegatedAttackFeatures
              )
            : summonTurnBrowser
              ? await createDevelopmentSpellCharacter(
                  player.client,
                  characterId,
                  [findFamiliar],
                  [{ spellLevel: 1, slotCount: 1 }],
                  undefined,
                  (await import('./fixtures/encounterSummonTurn')).summonActsAfterOwner
                )
              : null
    const characterFixture =
      spellCharacter ?? (await createDevelopmentCharacter(player.client, characterId))
    const { SRD_RULES_CATALOGUE } = await import('@artificer-toolkit/source-data/srd/catalogue.js')
    const campaignInput = {
      name: 'Encounter execution fixture',
      format: 'ONGOING' as const,
      toneTags: ['HEROIC' as const],
      contentMaturity: 'STANDARD' as const,
      gameSystemId: srdSystemRecord.id,
      primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
    }
    const campaign = await owner.client.mutation(api.campaigns.create.create, campaignInput)
    for (const workloadPlayer of workloadPlayers)
      await cli(
        'encounters/developmentCampaign:admitFixturePlayer',
        {
          ownerUserId: owner.identity.userId,
          playerUserId: workloadPlayer.identity.userId,
          campaignId: campaign.id
        },
        false
      )
    let independentCampaignId: string | undefined
    if (workload) {
      await cli('accountEntitlements:setTier', { userId: owner.identity.userId, tier: 'GM' }, false)
      const independentCampaign = await owner.client.mutation(
        api.campaigns.create.create,
        campaignInput
      )
      independentCampaignId = independentCampaign.id
      for (const workloadPlayer of workloadPlayers)
        await cli(
          'encounters/developmentCampaign:admitFixturePlayer',
          {
            ownerUserId: owner.identity.userId,
            playerUserId: workloadPlayer.identity.userId,
            campaignId: independentCampaignId
          },
          false
        )
    }
    if (lifecycle) {
      const { createEncounterLifecyclePolicyFixture } =
        await import('./fixtures/encounterInitiative')
      const policies = createEncounterLifecyclePolicyFixture(owner.identity.userId, {
        includeMovementReactionPolicies: movementBrowser || workload
      })
      lifecyclePolicyFixtures.push(policies.cleanup)
      assert.deepEqual(await cli('content/import:bootstrap', policies.bootstrap, false), {
        inserted: 2,
        reused: 1,
        replaced: 0
      })
      assert.deepEqual(await cli('content/import:importDefinitions', policies.imported, false), {
        inserted: policies.imported.definitions.length,
        reused: 0,
        replaced: 0
      })
      if (disarm) {
        for (const subjectKind of ['EQUIPMENT', 'CREATURE'] as const) {
          publicationAuthors.push({
            client: owner.client,
            userId: owner.identity.userId,
            systemId: srdSystemRecord.id,
            subjectKind
          })
          browserDraftAuthors.push({ client: owner.client, subjectKind })
        }
        const { verifyEncounterDisarm } = await import('./developmentEncounterDisarm')
        await verifyEncounterDisarm({
          owner: owner.client,
          player: player.client,
          ownerUserId: owner.identity.userId,
          playerUserId: player.identity.userId,
          campaignId: campaign.id,
          characterId,
          otherEquipmentId: characterFixture.equipment.subjectId,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          },
          readTimeline: () => owner.client.encounterTimeline(campaign.id),
          browser: disarmBrowser
            ? async (fixture, verify) => {
                const { verifyEncounterDisarmBrowser } =
                  await import('../../web/tests/live-backend/encounterDisarm')
                owner.client.setAuth(await owner.fetchToken())
                player.client.setAuth(await player.fetchToken())
                await verifyEncounterDisarmBrowser(
                  {
                    ...fixture,
                    owner,
                    player,
                    campaign,
                    evidenceDirectory: fileURLToPath(
                      new URL(
                        '../../../local-validation/local-convex-proofs/disarm-vtt-browser-20260915/browser/attempt-' +
                          Date.now() +
                          '/',
                        import.meta.url
                      )
                    )
                  },
                  verify
                )
              }
            : undefined
        })
      }
      if (areaBrowser) {
        publicationAuthors.push({
          client: owner.client,
          userId: owner.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind: 'CREATURE'
        })
        browserDraftAuthors.push({ client: owner.client, subjectKind: 'CREATURE' })
        const { createAreaCaster, createAreaWolf } = await import('./fixtures/encounterArea')
        const creatures = [
          createAreaCaster(crypto.randomUUID(), 'Area caster'),
          createAreaWolf(crypto.randomUUID(), 'Area ally wolf'),
          createAreaWolf(crypto.randomUUID(), 'Area enemy wolf'),
          createAreaWolf(crypto.randomUUID(), 'Area far wolf')
        ] as const
        for (const creature of creatures) {
          const draft = await owner.client.mutation(api.content.drafts.save, {
            subjectKind: 'CREATURE',
            subjectId: creature.id,
            systemId: srdSystemRecord.id,
            label: creature.label,
            payload: creature
          })
          assert.ok(draft.updatedAt)
          await owner.client.mutation(api.content.publication.publishDraft, {
            subjectKind: 'CREATURE',
            subjectId: draft.subjectId,
            expectedDraftUpdatedAt: draft.updatedAt
          })
        }
        const { verifyEncounterArea } = await import('./developmentEncounterArea')
        await verifyEncounterArea({
          owner: owner.client,
          player: player.client,
          campaignId: campaign.id,
          characterId,
          playerUserId: player.identity.userId,
          casterId: creatures[0].id,
          allyId: creatures[1].id,
          enemyId: creatures[2].id,
          farId: creatures[3].id,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          },
          readTimeline: () => owner.client.encounterTimeline(campaign.id),
          browser: async (fixture, verify) => {
            const { verifyEncounterAreaBrowser } =
              await import('../../web/tests/live-backend/encounterArea')
            owner.client.setAuth(await owner.fetchToken())
            player.client.setAuth(await player.fetchToken())
            await verifyEncounterAreaBrowser(
              {
                ...fixture,
                owner,
                player,
                campaign,
                evidenceDirectory: fileURLToPath(
                  new URL(
                    '../../../local-validation/local-convex-proofs/area-vtt-browser-20261010/browser/attempt-' +
                      Date.now() +
                      '/',
                    import.meta.url
                  )
                )
              },
              verify
            )
          }
        })
      }
      if (shoveAsideBrowser) {
        publicationAuthors.push({
          client: owner.client,
          userId: owner.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind: 'CREATURE'
        })
        browserDraftAuthors.push({ client: owner.client, subjectKind: 'CREATURE' })
        const { createAreaWolf } = await import('./fixtures/encounterArea')
        const wolves = [
          createAreaWolf(crypto.randomUUID(), 'Shoving wolf'),
          createAreaWolf(crypto.randomUUID(), 'Shoved wolf')
        ] as const
        for (const wolf of wolves) {
          const draft = await owner.client.mutation(api.content.drafts.save, {
            subjectKind: 'CREATURE',
            subjectId: wolf.id,
            systemId: srdSystemRecord.id,
            label: wolf.label,
            payload: wolf
          })
          assert.ok(draft.updatedAt)
          await owner.client.mutation(api.content.publication.publishDraft, {
            subjectKind: 'CREATURE',
            subjectId: draft.subjectId,
            expectedDraftUpdatedAt: draft.updatedAt
          })
        }
        const { verifyEncounterShoveAside } = await import('./developmentEncounterShoveAside')
        await verifyEncounterShoveAside({
          owner: owner.client,
          campaignId: campaign.id,
          shoverId: wolves[0].id,
          targetId: wolves[1].id,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          },
          browser: async (fixture, verify) => {
            const { verifyEncounterShoveAsideBrowser } =
              await import('../../web/tests/live-backend/encounterShoveAside')
            owner.client.setAuth(await owner.fetchToken())
            await verifyEncounterShoveAsideBrowser(
              {
                ...fixture,
                owner,
                campaign,
                evidenceDirectory: fileURLToPath(
                  new URL(
                    '../../../local-validation/local-convex-proofs/shove-aside-vtt-browser-20261026/browser/attempt-' +
                      Date.now() +
                      '/',
                    import.meta.url
                  )
                )
              },
              verify
            )
          }
        })
      }
      if (playerBrowser) {
        if (!spellCharacter) throw new Error('The player journey needs its spell Character.')
        publicationAuthors.push({
          client: owner.client,
          userId: owner.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind: 'CREATURE'
        })
        browserDraftAuthors.push({ client: owner.client, subjectKind: 'CREATURE' })
        const { createPlayerJourneyWolf } = await import('./fixtures/encounterPlayer')
        const wolf = createPlayerJourneyWolf(crypto.randomUUID(), 'Journey wolf')
        const draft = await owner.client.mutation(api.content.drafts.save, {
          subjectKind: 'CREATURE',
          subjectId: wolf.id,
          systemId: srdSystemRecord.id,
          label: wolf.label,
          payload: wolf
        })
        assert.ok(draft.updatedAt)
        await owner.client.mutation(api.content.publication.publishDraft, {
          subjectKind: 'CREATURE',
          subjectId: draft.subjectId,
          expectedDraftUpdatedAt: draft.updatedAt
        })
        const { verifyEncounterPlayer } = await import('./developmentEncounterPlayer')
        await verifyEncounterPlayer({
          owner: owner.client,
          player: player.client,
          campaignId: campaign.id,
          characterId,
          playerUserId: player.identity.userId,
          wolfSourceId: wolf.id,
          spellSubjectIds: [...spellCharacter.spellSubjectIds.values()],
          classId: spellCharacter.classId,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          },
          readTimeline: () => owner.client.encounterTimeline(campaign.id),
          browser: async (fixture, verify) => {
            const { verifyEncounterPlayerBrowser } =
              await import('../../web/tests/live-backend/encounterPlayer')
            owner.client.setAuth(await owner.fetchToken())
            player.client.setAuth(await player.fetchToken())
            await verifyEncounterPlayerBrowser(
              {
                ...fixture,
                owner,
                player,
                campaign,
                evidenceDirectory: fileURLToPath(
                  new URL(
                    '../../../local-validation/local-convex-proofs/player-browser/browser/attempt-' +
                      Date.now() +
                      '/',
                    import.meta.url
                  )
                )
              },
              verify
            )
          }
        })
      }
      let journeyOgreAuthorsRegistered = false
      const publishJourneyOgre = async (label = 'Journey ogre') => {
        if (!journeyOgreAuthorsRegistered) {
          journeyOgreAuthorsRegistered = true
          publicationAuthors.push({
            client: owner.client,
            userId: owner.identity.userId,
            systemId: srdSystemRecord.id,
            subjectKind: 'CREATURE'
          })
          browserDraftAuthors.push({ client: owner.client, subjectKind: 'CREATURE' })
        }
        const { createHeatMetalOgre } = await import('./fixtures/encounterHeatMetal')
        const ogre = createHeatMetalOgre(crypto.randomUUID(), label)
        const draft = await owner.client.mutation(api.content.drafts.save, {
          subjectKind: 'CREATURE',
          subjectId: ogre.id,
          systemId: srdSystemRecord.id,
          label: ogre.label,
          payload: ogre
        })
        assert.ok(draft.updatedAt)
        await owner.client.mutation(api.content.publication.publishDraft, {
          subjectKind: 'CREATURE',
          subjectId: draft.subjectId,
          expectedDraftUpdatedAt: draft.updatedAt
        })
        return ogre
      }
      if (delegatedAttackBrowser) {
        if (!spellCharacter) throw new Error('The delegated journey needs its spell Character.')
        const ogre = await publishJourneyOgre()
        const { verifyEncounterDelegatedAttack } =
          await import('./developmentEncounterDelegatedAttack')
        await verifyEncounterDelegatedAttack({
          owner: owner.client,
          player: player.client,
          campaignId: campaign.id,
          characterId,
          playerUserId: player.identity.userId,
          creatureSourceId: ogre.id,
          spellSubjectIds: [...spellCharacter.spellSubjectIds.values()],
          classId: spellCharacter.classId,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          },
          browser: async (fixture, verify) => {
            const { verifyEncounterDelegatedAttackBrowser } =
              await import('../../web/tests/live-backend/encounterDelegatedAttack')
            owner.client.setAuth(await owner.fetchToken())
            player.client.setAuth(await player.fetchToken())
            await verifyEncounterDelegatedAttackBrowser(
              {
                ...fixture,
                owner,
                player,
                campaign,
                evidenceDirectory: fileURLToPath(
                  new URL(
                    '../../../local-validation/local-convex-proofs/delegated-attack-browser/browser/attempt-' +
                      Date.now() +
                      '/',
                    import.meta.url
                  )
                )
              },
              verify
            )
          }
        })
      }
      if (summonTurnBrowser) {
        if (!spellCharacter) throw new Error('The summon turn journey needs its spell Character.')
        const ogre = await publishJourneyOgre()
        const { verifyEncounterSummonTurn } = await import('./developmentEncounterSummonTurn')
        await verifyEncounterSummonTurn({
          owner: owner.client,
          player: player.client,
          campaignId: campaign.id,
          characterId,
          playerUserId: player.identity.userId,
          creatureSourceId: ogre.id,
          spellSubjectIds: [...spellCharacter.spellSubjectIds.values()],
          classId: spellCharacter.classId,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          },
          browser: async (fixture, verify) => {
            const { verifyEncounterSummonTurnBrowser } =
              await import('../../web/tests/live-backend/encounterSummonTurn')
            owner.client.setAuth(await owner.fetchToken())
            player.client.setAuth(await player.fetchToken())
            await verifyEncounterSummonTurnBrowser(
              {
                ...fixture,
                owner,
                player,
                campaign,
                evidenceDirectory: fileURLToPath(
                  new URL(
                    '../../../local-validation/local-convex-proofs/summon-turn-browser/browser/attempt-' +
                      Date.now() +
                      '/',
                    import.meta.url
                  )
                )
              },
              verify
            )
          }
        })
      }
      if (heatMetalBrowser) {
        if (!spellCharacter) throw new Error('The Heat Metal journey needs its spell Character.')
        const ogre = await publishJourneyOgre()
        const { verifyEncounterHeatMetal } = await import('./developmentEncounterHeatMetal')
        await verifyEncounterHeatMetal({
          owner: owner.client,
          player: player.client,
          campaignId: campaign.id,
          characterId,
          playerUserId: player.identity.userId,
          ogreSourceId: ogre.id,
          spellSubjectIds: [...spellCharacter.spellSubjectIds.values()],
          classId: spellCharacter.classId,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          },
          browser: async (fixture, verify) => {
            const { verifyEncounterHeatMetalBrowser } =
              await import('../../web/tests/live-backend/encounterHeatMetal')
            owner.client.setAuth(await owner.fetchToken())
            player.client.setAuth(await player.fetchToken())
            await verifyEncounterHeatMetalBrowser(
              {
                ...fixture,
                owner,
                player,
                campaign,
                evidenceDirectory: fileURLToPath(
                  new URL(
                    '../../../local-validation/local-convex-proofs/heat-metal-browser/browser/attempt-' +
                      Date.now() +
                      '/',
                    import.meta.url
                  )
                )
              },
              verify
            )
          }
        })
      }
      if (heldEffectBrowser) {
        if (!spellCharacter) throw new Error('The held effect journey needs its spell Character.')
        const marked = await publishJourneyOgre('Marked ogre')
        const next = await publishJourneyOgre('Next ogre')
        const { verifyEncounterHeldEffect } = await import('./developmentEncounterHeldEffect')
        await verifyEncounterHeldEffect({
          owner: owner.client,
          player: player.client,
          campaignId: campaign.id,
          characterId,
          playerUserId: player.identity.userId,
          markedSourceId: marked.id,
          nextSourceId: next.id,
          spellSubjectIds: [...spellCharacter.spellSubjectIds.values()],
          classId: spellCharacter.classId,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          },
          browser: async (fixture, verify) => {
            const { verifyEncounterHeldEffectBrowser } =
              await import('../../web/tests/live-backend/encounterHeldEffect')
            owner.client.setAuth(await owner.fetchToken())
            player.client.setAuth(await player.fetchToken())
            await verifyEncounterHeldEffectBrowser(
              {
                ...fixture,
                owner,
                player,
                campaign,
                evidenceDirectory: fileURLToPath(
                  new URL(
                    '../../../local-validation/local-convex-proofs/held-effect-browser/browser/attempt-' +
                      Date.now() +
                      '/',
                    import.meta.url
                  )
                )
              },
              verify
            )
          }
        })
      }
      if (hideBrowser) {
        publicationAuthors.push({
          client: owner.client,
          userId: owner.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind: 'CREATURE'
        })
        browserDraftAuthors.push({ client: owner.client, subjectKind: 'CREATURE' })
        const { createAreaWolf } = await import('./fixtures/encounterArea')
        const creatures = [
          createAreaWolf(crypto.randomUUID(), 'Hiding wolf'),
          createAreaWolf(crypto.randomUUID(), 'Sharp-eyed wolf'),
          createAreaWolf(crypto.randomUUID(), 'Keen-eyed wolf')
        ] as const
        for (const creature of creatures) {
          const draft = await owner.client.mutation(api.content.drafts.save, {
            subjectKind: 'CREATURE',
            subjectId: creature.id,
            systemId: srdSystemRecord.id,
            label: creature.label,
            payload: creature
          })
          assert.ok(draft.updatedAt)
          await owner.client.mutation(api.content.publication.publishDraft, {
            subjectKind: 'CREATURE',
            subjectId: draft.subjectId,
            expectedDraftUpdatedAt: draft.updatedAt
          })
        }
        const { verifyEncounterHide } = await import('./developmentEncounterHide')
        await verifyEncounterHide({
          owner: owner.client,
          player: player.client,
          campaignId: campaign.id,
          characterId,
          hiderId: creatures[0].id,
          watcherIds: [creatures[1].id, creatures[2].id],
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          },
          browser: async (fixture, verify) => {
            const { verifyEncounterHideBrowser } =
              await import('../../web/tests/live-backend/encounterHide')
            owner.client.setAuth(await owner.fetchToken())
            player.client.setAuth(await player.fetchToken())
            await verifyEncounterHideBrowser(
              {
                ...fixture,
                owner,
                player,
                campaign,
                evidenceDirectory: fileURLToPath(
                  new URL(
                    '../../../local-validation/local-convex-proofs/hide-vtt-browser-20261015/browser/attempt-' +
                      Date.now() +
                      '/',
                    import.meta.url
                  )
                )
              },
              verify
            )
          }
        })
      }
      if (effectJourney) {
        publicationAuthors.push({
          client: owner.client,
          userId: owner.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind: 'CREATURE'
        })
        browserDraftAuthors.push({
          client: owner.client,
          subjectKind: 'CREATURE'
        })
        const { encounterEffectCreature } = await import('./fixtures/encounterEffects')
        const effectDraft = await owner.client.mutation(api.content.drafts.save, {
          subjectKind: 'CREATURE',
          subjectId: crypto.randomUUID(),
          systemId: srdSystemRecord.id,
          label: encounterEffectCreature.label,
          payload: encounterEffectCreature
        })
        assert.ok(effectDraft.updatedAt)
        await owner.client.mutation(api.content.publication.publishDraft, {
          subjectKind: 'CREATURE',
          subjectId: effectDraft.subjectId,
          expectedDraftUpdatedAt: effectDraft.updatedAt
        })
        const targetEffectDraft = effectsBrowser
          ? await owner.client.mutation(api.content.drafts.save, {
              subjectKind: 'CREATURE',
              subjectId: crypto.randomUUID(),
              systemId: srdSystemRecord.id,
              label: 'Action-effect target creature',
              payload: {
                ...encounterEffectCreature,
                id: crypto.randomUUID(),
                label: 'Action-effect target creature'
              }
            })
          : null
        if (targetEffectDraft) {
          assert.ok(targetEffectDraft.updatedAt)
          await owner.client.mutation(api.content.publication.publishDraft, {
            subjectKind: 'CREATURE',
            subjectId: targetEffectDraft.subjectId,
            expectedDraftUpdatedAt: targetEffectDraft.updatedAt
          })
        }
        const { verifyEncounterEffects } = await import('./developmentEncounterEffects')
        const effectInput = {
          owner: owner.client,
          player: player.client,
          campaignId: campaign.id,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          creatureId: effectDraft.subjectId,
          targetCreatureId: targetEffectDraft?.subjectId
        }
        if (effectsBrowser) {
          if (!targetEffectDraft)
            throw new Error('Action-effect browser target fixture is unavailable.')
          const { RoomControl } = await import('./developmentRoomMeasurement')
          const roomControl = await RoomControl.open(owner.client)
          await verifyEncounterEffects({
            ...effectInput,
            targetCreatureId: targetEffectDraft.subjectId,
            playerUserId: player.identity.userId,
            saveTable: async () => {
              await roomControl.barrier(campaign.id)
            },
            browser: async (fixture, verify) => {
              const { verifyEncounterEffectsBrowser } =
                await import('../../web/tests/live-backend/encounterEffects')
              owner.client.setAuth(await owner.fetchToken())
              player.client.setAuth(await player.fetchToken())
              await verifyEncounterEffectsBrowser(
                {
                  ...fixture,
                  owner,
                  player,
                  campaign,
                  evidenceDirectory: fileURLToPath(
                    new URL(
                      '../../../local-validation/local-convex-proofs/effect-browser-20260916/browser/attempt-' +
                        Date.now() +
                        '/',
                      import.meta.url
                    )
                  )
                },
                verify
              )
            }
          })
        } else await verifyEncounterEffects(effectInput)
      }
      const result = lifecycleSuite
        ? await (
            await import('./developmentEncounterLifecycle')
          ).verifyEncounterLifecycle({
            owner: owner.client,
            player: player.client,
            anonymous: publicClient,
            campaignId: campaign.id
          })
        : null
      if (result) {
        const firstRun = await owner.client.mutation(api.encounters.runs.create, {
          campaignId: campaign.id,
          blueprintId: result.blueprint.id,
          commandId: crypto.randomUUID()
        })
        const secondRun = await owner.client.mutation(api.encounters.runs.create, {
          campaignId: campaign.id,
          blueprintId: result.blueprint.id,
          commandId: crypto.randomUUID()
        })
        const preparedRuns = await Promise.all(
          [firstRun, secondRun].map(async (run) => {
            assert.equal(run.status, 'PREPARED')
            assert.equal(run.actors.length, 1)
            const initiative = await owner.client.mutation(executeEncounterCommand, {
              command: {
                type: 'SET_INITIATIVE',
                encounterId: run.id,
                commandId: crypto.randomUUID(),
                expectedVersion: run.version,
                actorId: run.actors[0]!.id,
                initiative: 10,
                manualOrder: 0
              }
            })
            assert.equal(initiative.projection.status, 'PREPARED')
            return initiative.projection
          })
        )
        const startInputs = preparedRuns.map((run) => ({
          command: {
            type: 'START' as const,
            encounterId: run.id,
            commandId: crypto.randomUUID(),
            expectedVersion: run.version
          }
        }))
        const startPeer = new DevelopmentHttpClient(deploymentUrl.origin, { logger: false })
        owner.client.setAuth(await owner.fetchToken())
        startPeer.setAuth(await owner.fetchToken())
        const starts = await Promise.allSettled([
          owner.client.mutation(executeEncounterCommand, startInputs[0]!),
          startPeer.mutation(executeEncounterCommand, startInputs[1]!)
        ])
        assert.equal(starts.filter((entry) => entry.status === 'fulfilled').length, 1)
        const winnerIndex = starts.findIndex((entry) => entry.status === 'fulfilled')
        const winner = starts[winnerIndex]
        const loser = starts[1 - winnerIndex]
        if (!winner || winner.status !== 'fulfilled' || !loser || loser.status !== 'rejected')
          throw new Error('Native concurrent START did not produce one winner and one rejection.')
        assertDomainRejection(loser.reason, 'ACTIVE_ENCOUNTER_EXISTS')
        const loserIndex = 1 - winnerIndex
        assert.equal(winner.value.projection.status, 'ACTIVE')
        assert.deepEqual(
          (
            await owner.client.query(api.encounters.activeReads.active, {
              campaignId: campaign.id
            })
          ).encounter,
          winner.value.projection
        )
        assert.deepEqual(
          await owner.client.query(api.encounters.projectionReads.get, {
            encounterId: preparedRuns[loserIndex]!.id
          }),
          preparedRuns[loserIndex]
        )
        const winnerCompleted = await owner.client.mutation(executeEncounterCommand, {
          command: {
            type: 'COMPLETE',
            encounterId: winner.value.projection.id,
            commandId: crypto.randomUUID(),
            expectedVersion: winner.value.projection.version
          }
        })
        const loserStarted = await owner.client.mutation(
          executeEncounterCommand,
          startInputs[loserIndex]!
        )
        assert.equal(loserStarted.projection.status, 'ACTIVE')
        assert.deepEqual(
          (
            await owner.client.query(api.encounters.activeReads.active, {
              campaignId: campaign.id
            })
          ).encounter,
          loserStarted.projection
        )
        // An exact replay returns the stored receipt with the Run's current projection.
        assert.deepEqual(
          await owner.client.mutation(executeEncounterCommand, startInputs[winnerIndex]!),
          { ...winner.value, projection: winnerCompleted.projection }
        )
        await owner.client.mutation(executeEncounterCommand, {
          command: {
            type: 'COMPLETE',
            encounterId: loserStarted.projection.id,
            commandId: crypto.randomUUID(),
            expectedVersion: loserStarted.projection.version
          }
        })
        assert.equal(
          (
            await owner.client.query(api.encounters.activeReads.active, {
              campaignId: campaign.id
            })
          ).encounter,
          null
        )
        console.log(
          JSON.stringify({
            proof: 'V08 native concurrent START and replay',
            status: 'PASS',
            winnerRunId: winner.value.projection.id,
            loserRunId: loserStarted.projection.id
          })
        )
        const { verifyEncounterAutomation } = await import('./developmentEncounterAutomation')
        await verifyEncounterAutomation({
          owner: owner.client,
          player: player.client,
          campaignId: campaign.id,
          blueprint: result.blueprint,
          characterId,
          policies,
          sceneFixture: result,
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          }
        })
        const { verifyEncounterTransactions } = await import('./developmentEncounterTransactions')
        await verifyEncounterTransactions({
          checkpoint: async () => {
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(owner.client, campaign.id)
          },
          owner: owner.client,
          player: player.client,
          ownerUserId: owner.identity.userId,
          playerUserId: player.identity.userId,
          campaignId: campaign.id,
          fixture: result,
          concurrent: (actor, reference, args) =>
            (actor === 'OWNER' ? owner.client : player.client).mutation(reference, args, {
              skipQueue: true
            })
        })
      }
      if (movementBrowser || workload) {
        for (const policyCampaignId of [campaign.id, independentCampaignId]) {
          if (!policyCampaignId || (policyCampaignId === campaign.id && result)) continue
          const currentCampaign = await owner.client.query(api.campaigns.queries.get, {
            id: policyCampaignId
          })
          await owner.client.mutation(api.campaigns.update.update, {
            campaignId: policyCampaignId,
            expectedVersion: currentCampaign.version,
            additionalRulesCatalogueIds: [
              ...currentCampaign.additionalRulesCatalogueIds,
              policies.bootstrap.catalogue.id
            ]
          })
        }
      }
      if (movementBrowser) {
        const { readAuthoritativeSceneToken } = await import('./developmentEncounterCutover')
        const { awaitCampaignCheckpoint, awaitSceneCheckpoint } =
          await import('./developmentCheckpoint')
        const { prepareEncounterMovementFixture, publishMovementReactionCreature } =
          await import('./developmentEncounterMovement')
        const { verifyEncounterMovementBrowser } =
          await import('../../web/tests/live-backend/encounterMovement')
        owner.client.setAuth(await owner.fetchToken())
        publicationAuthors.push({
          client: owner.client,
          userId: owner.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind: 'CREATURE'
        })
        if (!policies.movementReaction)
          throw new Error('Movement reaction browser fixture policies are unavailable.')
        const creature = await publishMovementReactionCreature(
          owner.client,
          policies.movementReaction.eligibilityDefinitionId
        )
        const fixture = await prepareEncounterMovementFixture({
          owner: owner.client,
          player: player.client,
          playerUserId: player.identity.userId,
          playerCharacterId: characterId,
          campaignId: campaign.id,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          reactionCreatureId: creature.creatureId,
          biteFeatureId: creature.biteFeatureId,
          biteEffectId: creature.biteEffectId,
          scenario: passageBrowser ? 'PASSAGE' : 'REACTION'
        })
        owner.client.setAuth(await owner.fetchToken())
        player.client.setAuth(await player.fetchToken())
        let reactionAllowanceBefore: number | undefined
        let reactionRunVersion: number | undefined
        let passageRunVersion: number | undefined
        const readFog = async (client: typeof owner.client) => {
          const header = await client.query(api.scenes.recipientReads.header, {
            sceneId: fixture.scene.liveSceneId
          })
          const fogLayers: SceneFogLayer[] = []
          let cursor: string | null = null
          do {
            const layers: SceneFogLayersPage = await client.query(api.scenes.fogReads.layers, {
              sceneId: fixture.scene.liveSceneId,
              expectedVersion: header.version,
              paginationOpts: { cursor, numItems: 8 }
            })
            assert.equal(layers.version, header.version)
            assert.notEqual(layers.pageStatus, 'SplitRequired')
            for (const layer of layers.page) {
              const chunks: SceneFogLayer['chunks'] = []
              let offset = 0
              let isDone = false
              do {
                const page: SceneFogChunksPage = await client.query(api.scenes.fogReads.chunks, {
                  sceneId: fixture.scene.liveSceneId,
                  ownerUserId: layer.ownerUserId,
                  expectedVersion: header.version,
                  offset,
                  numItems: 8
                })
                assert.equal(page.version, header.version)
                assert.equal(page.ownerUserId, layer.ownerUserId)
                assert.equal(page.width, layer.width)
                assert.equal(page.height, layer.height)
                if (!page.isDone) assert.ok(page.nextOffset > offset)
                chunks.push(...page.page)
                offset = page.nextOffset
                isDone = page.isDone
              } while (!isDone)
              assert.equal(chunks.length, layer.chunkCount)
              fogLayers.push({
                ownerUserId: layer.ownerUserId,
                width: layer.width,
                height: layer.height,
                chunks
              })
            }
            if (!layers.isDone) assert.notEqual(layers.continueCursor, cursor)
            cursor = layers.isDone ? null : layers.continueCursor
          } while (cursor !== null)
          return { header, fogLayers }
        }
        const readMovementState = async () => {
          const [ownerToken, playerToken, ownerFog, playerFog, run, character] = await Promise.all([
            readAuthoritativeSceneToken(owner.client, {
              sceneId: fixture.scene.liveSceneId,
              tokenId: fixture.mover.tokenId
            }),
            readAuthoritativeSceneToken(player.client, {
              sceneId: fixture.scene.liveSceneId,
              tokenId: fixture.mover.tokenId
            }),
            readFog(owner.client),
            readFog(player.client),
            owner.client.query(api.encounters.projectionReads.get, {
              encounterId: fixture.run.id
            }),
            player.client.query(api.characters.sheet.get, { id: characterId })
          ])
          return {
            ownerToken,
            playerToken,
            ownerFog,
            playerFog,
            run,
            character
          }
        }
        const assertRecipientConvergence = async () => {
          const state = await readMovementState()
          assert.deepEqual(state.ownerToken.token, state.playerToken.token)
          assert.deepEqual(
            state.playerFog.fogLayers,
            state.ownerFog.fogLayers.filter(
              (layer) => layer.ownerUserId === null || layer.ownerUserId === player.identity.userId
            )
          )
        }
        let reactionIssuedMovement: Awaited<ReturnType<typeof readMovementState>> | undefined
        let completedMovement: Awaited<ReturnType<typeof readMovementState>> | undefined
        await verifyEncounterMovementBrowser({
          scenario: passageBrowser ? 'PASSAGE' : 'REACTION',
          owner,
          player,
          campaign,
          scene: {
            id: fixture.scene.liveSceneId,
            name: passageBrowser
              ? 'Movement passage browser scene'
              : 'Movement reaction browser scene',
            map: { width: passageBrowser ? 600 : 400, height: 200 }
          },
          mover: {
            actorId: fixture.mover.actorId,
            tokenId: fixture.mover.tokenId,
            label: 'Movement reaction mover',
            from: passageBrowser ? { x: 50, y: 50 } : { x: 150, y: 50 },
            to: passageBrowser ? { x: 550, y: 50 } : { x: 350, y: 50 }
          },
          reactor: fixture.reactor,
          evidenceDirectory: fileURLToPath(
            new URL(
              `../../../local-validation/local-convex-proofs/${passageBrowser ? 'scene-passage-coordinator-20260914' : 'scene-reaction-coordinator-20260913'}/browser/attempt-${Date.now()}/`,
              import.meta.url
            )
          ),
          // Exact retries repeat the tabletop's room frame, whose receipt the room replays.
          retryExactMovement: async (frame) => {
            const before = await readMovementState()
            const { result: replay } = await player.client.executeSceneCommand(
              frame.command,
              frame.expectedSessionSequence
            )
            // The room answers an exact retry with its stored receipt.
            assert.equal(replay?.commandId, frame.command.commandId)
            assert.deepEqual(
              await readMovementState(),
              before,
              'Exact movement replay must not append mechanics, Run, token, or fog projections.'
            )
          },
          retryExactUndo: async (submission) => {
            const before = await readMovementState()
            const { result: replay } = await owner.client.executeSceneCommand(
              submission.command.command,
              submission.command.expectedSessionSequence
            )
            // The room marks a replayed receipt `replayed` and returns the rest of it unchanged.
            assert.equal(replay?.replayed, true)
            assert.deepEqual(replay, { ...submission.result, replayed: true })
            assert.deepEqual(
              await readMovementState(),
              before,
              'Exact undo replay must not append Scene, fog, Run, timeline, or Character changes.'
            )
          },
          readPending: async () => {
            const pending = await owner.client.query(
              api.encounters.pendingReads.pendingRuleOccurrence,
              {
                encounterId: fixture.run.id
              }
            )
            return pending === null
              ? null
              : pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(pending)
          },
          readPlayerPending: async () => {
            const pending = await player.client.query(
              api.encounters.pendingReads.pendingRuleOccurrence,
              {
                encounterId: fixture.run.id
              }
            )
            return pending === null
              ? null
              : pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(pending)
          },
          revokePlayer: async () => {
            const current = await owner.client.query(api.campaigns.queries.get, { id: campaign.id })
            const membership = current.memberships.find(
              (entry) => entry.userId === player.identity.userId
            )
            assert.ok(membership)
            await owner.client.mutation(api.campaigns.membershipDeparture.removeMember, {
              campaignId: campaign.id,
              userId: player.identity.userId,
              commandId: crypto.randomUUID(),
              expectedCampaignVersion: current.version,
              expectedMembershipAccessStartedAt: membership.accessStartedAt
            })
            await assert.rejects(() =>
              player.client.query(api.encounters.pendingReads.pendingRuleOccurrence, {
                encounterId: fixture.run.id
              })
            )
          },
          verifyAuthoritative: async (stage, observedSceneVersion) => {
            // Room Scene and Run commits reach Convex at a checkpoint; read only once it holds them.
            await awaitCampaignCheckpoint(owner.client, campaign.id)
            await awaitSceneCheckpoint(
              owner.client,
              fixture.scene.liveSceneId,
              observedSceneVersion
            )
            if (stage === 'departed') {
              if (!completedMovement) throw new Error('Post-undo movement snapshot is unavailable.')
              const [ownerToken, ownerFog, run] = await Promise.all([
                readAuthoritativeSceneToken(owner.client, {
                  sceneId: fixture.scene.liveSceneId,
                  tokenId: fixture.mover.tokenId
                }),
                readFog(owner.client),
                owner.client.query(api.encounters.projectionReads.get, {
                  encounterId: fixture.run.id
                })
              ])
              assert.deepEqual(ownerToken.token, completedMovement.ownerToken.token)
              assert.deepEqual(ownerFog.fogLayers, completedMovement.ownerFog.fogLayers)
              assert.deepEqual(run, completedMovement.run)
              await assert.rejects(() =>
                player.client.query(api.scenes.recipientReads.header, {
                  sceneId: fixture.scene.liveSceneId
                })
              )
              return
            }
            const [ownerToken, playerToken, run, occurrence] = await Promise.all([
              readAuthoritativeSceneToken(owner.client, {
                sceneId: fixture.scene.liveSceneId,
                tokenId: fixture.mover.tokenId
              }),
              readAuthoritativeSceneToken(player.client, {
                sceneId: fixture.scene.liveSceneId,
                tokenId: fixture.mover.tokenId
              }),
              owner.client.query(api.encounters.projectionReads.get, {
                encounterId: fixture.run.id
              }),
              owner.client.query(api.encounters.pendingReads.pendingRuleOccurrence, {
                encounterId: fixture.run.id
              })
            ])
            if (passageBrowser) {
              const expectedPosition =
                stage === 'hydrated'
                  ? { x: 50, y: 50 }
                  : stage === 'passage-issued' || stage === 'passage-initiator-resolved'
                    ? { x: 150, y: 50 }
                    : stage === 'passage-resolved' || stage === 'reaction-issued'
                      ? occurrence?.kind === 'MOVEMENT_REACTION'
                        ? movementContact(
                            occurrence.choice.pathDistance,
                            { x: 50, y: 50 },
                            { x: 550, y: 50 }
                          )
                        : (() => {
                            throw new Error('Passage continuation reaction is not pending.')
                          })()
                      : { x: 550, y: 50 }
              assert.deepEqual(ownerToken.token.position, playerToken.token.position)
              for (const { token } of [ownerToken, playerToken])
                assert.ok(
                  Math.hypot(
                    token.position.x - expectedPosition.x,
                    token.position.y - expectedPosition.y
                  ) < 0.001,
                  'Committed position must match the browser drag within subpixel precision.'
                )
              assert.equal(run.id, fixture.run.id)
              if (stage === 'reconnected' || stage === 'replayed')
                await assertRecipientConvergence()
              // Movement exploration persists after the reactor leaves the current vision range.
              if (stage !== 'hydrated') {
                await readAuthoritativeSceneToken(player.client, {
                  sceneId: fixture.scene.liveSceneId,
                  tokenId: fixture.reactor.tokenId
                })
              } else {
                await assert.rejects(
                  () =>
                    readAuthoritativeSceneToken(player.client, {
                      sceneId: fixture.scene.liveSceneId,
                      tokenId: fixture.reactor.tokenId
                    }),
                  /Cutover fixture token is absent from the authoritative Scene\./
                )
              }
              if (stage === 'passage-issued') {
                assert.equal(occurrence?.kind, 'MOVEMENT_PASSAGE_CHOICE')
                assert.equal(actionAllowanceUsed(run, fixture.mover.actorId), 0)
                assert.equal(
                  (
                    await player.client.query(api.encounters.pendingReads.pendingRuleOccurrence, {
                      encounterId: fixture.run.id
                    })
                  )?.kind,
                  'MOVEMENT_PASSAGE_CHOICE'
                )
                passageRunVersion = run.version
              }
              if (stage === 'passage-initiator-resolved') {
                assert.equal(occurrence?.kind, 'D20_EVIDENCE')
                assert.equal(actionAllowanceUsed(run, fixture.mover.actorId), 0)
                assert.equal(run.version, passageRunVersion)
              }
              if (stage === 'passage-resolved') {
                assert.notEqual(passageRunVersion, undefined)
                assert.equal(occurrence?.kind, 'MOVEMENT_REACTION')
                assert.equal(actionAllowanceUsed(run, fixture.mover.actorId), 1)
                assert.equal(run.version, passageRunVersion! + 1)
                reactionAllowanceBefore = reactionAllowanceUsed(run, fixture.reactor.actorId)
                reactionRunVersion = run.version
              }
              if (stage === 'reaction-issued') {
                if (!occurrence || occurrence.kind !== 'MOVEMENT_REACTION')
                  throw new Error('Passage continuation reaction is not pending.')
                assert.deepEqual(
                  ownerToken.token.position,
                  movementContact(
                    occurrence.choice.pathDistance,
                    { x: 50, y: 50 },
                    { x: 550, y: 50 }
                  )
                )
                assert.equal(occurrence.choice.reactorActorId, fixture.reactor.actorId)
                assert.equal(occurrence.choice.reactorTokenId, fixture.reactor.tokenId)
                assert.ok(
                  occurrence.choice.options.some(
                    (option) => option.actionId === fixture.reactor.actionId
                  )
                )
                assert.equal(actionAllowanceUsed(run, fixture.mover.actorId), 1)
              }
              if (
                stage === 'reaction-resolved' ||
                stage === 'replayed' ||
                stage === 'reconnected'
              ) {
                assert.equal(reactionAllowanceBefore, 0)
                assert.notEqual(reactionRunVersion, undefined)
                assert.equal(occurrence, null)
                assert.equal(actionAllowanceUsed(run, fixture.mover.actorId), 1)
                assert.equal(reactionAllowanceUsed(run, fixture.reactor.actorId), 1)
                assert.equal(run.version, reactionRunVersion! + 1)
              }
              if (stage === 'reaction-issued') reactionIssuedMovement = await readMovementState()
              if (stage === 'reaction-resolved') completedMovement = await readMovementState()
              return
            }
            const expectedPosition =
              stage === 'hydrated'
                ? { x: 150, y: 50 }
                : stage === 'movement-issued' || stage === 'reaction-issued'
                  ? occurrence?.kind === 'MOVEMENT_REACTION'
                    ? movementContact(
                        occurrence.choice.pathDistance,
                        { x: 150, y: 50 },
                        { x: 350, y: 50 }
                      )
                    : (() => {
                        throw new Error('Movement reaction is not pending.')
                      })()
                  : { x: 350, y: 50 }
            assert.deepEqual(ownerToken.token.position, playerToken.token.position)
            for (const { token } of [ownerToken, playerToken])
              assert.ok(
                Math.hypot(
                  token.position.x - expectedPosition.x,
                  token.position.y - expectedPosition.y
                ) < 0.001,
                'Committed position must match the browser drag within subpixel precision.'
              )
            assert.equal(run.id, fixture.run.id)
            if (stage === 'reconnected' || stage === 'replayed') await assertRecipientConvergence()
            // The revealed, non-hidden reactor remains in the player's explored area.
            if (stage !== 'hydrated') {
              await readAuthoritativeSceneToken(player.client, {
                sceneId: fixture.scene.liveSceneId,
                tokenId: fixture.reactor.tokenId
              })
            } else {
              await assert.rejects(
                () =>
                  readAuthoritativeSceneToken(player.client, {
                    sceneId: fixture.scene.liveSceneId,
                    tokenId: fixture.reactor.tokenId
                  }),
                /Cutover fixture token is absent from the authoritative Scene\./
              )
            }
            if (stage === 'movement-issued' || stage === 'reaction-issued') {
              assert.equal(occurrence?.kind, 'MOVEMENT_REACTION')
              if (!occurrence || occurrence.kind !== 'MOVEMENT_REACTION')
                throw new Error('Movement reaction is not pending.')
              assert.equal(occurrence.choice.reactorActorId, fixture.reactor.actorId)
              assert.equal(occurrence.choice.reactorTokenId, fixture.reactor.tokenId)
              assert.ok(
                occurrence.choice.options.some(
                  (option) => option.actionId === fixture.reactor.actionId
                )
              )
              if (stage === 'reaction-issued') {
                reactionAllowanceBefore = reactionAllowanceUsed(run, fixture.reactor.actorId)
                reactionRunVersion = run.version
              }
            }
            if (stage === 'reaction-resolved') {
              assert.equal(occurrence, null)
              assert.notDeepEqual(run, fixture.run, 'The selected reaction must advance the Run.')
              assert.equal(reactionAllowanceBefore, 0)
              assert.equal(reactionAllowanceUsed(run, fixture.reactor.actorId), 1)
              if (reactionRunVersion === undefined)
                throw new Error('Reaction Run baseline is unavailable.')
              assert.equal(run.version, reactionRunVersion + 1)
            }
            if (stage === 'reaction-issued') reactionIssuedMovement = await readMovementState()
            if (stage === 'reaction-resolved') completedMovement = await readMovementState()
          },
          verifyUndoBaseline: async () => {
            if (!reactionIssuedMovement)
              throw new Error('Reaction geometry snapshot is unavailable.')
            if (!completedMovement) throw new Error('Completed movement snapshot is unavailable.')
            assert.equal(
              completedMovement.ownerToken.header.version,
              reactionIssuedMovement.ownerToken.header.version + 1
            )
            assert.equal(
              completedMovement.playerToken.header.version,
              reactionIssuedMovement.playerToken.header.version + 1
            )
            assert.deepEqual(await readMovementState(), completedMovement)
          },
          verifyCompletedUndo: async (submission) => {
            if (!reactionIssuedMovement)
              throw new Error('Reaction geometry snapshot is unavailable.')
            if (!completedMovement) throw new Error('Completed movement snapshot is unavailable.')
            await awaitSceneCheckpoint(
              owner.client,
              fixture.scene.liveSceneId,
              submission.result.version
            )
            const after = await readMovementState()
            const delta = submission.result.delta
            const undone = (delta?.kind === 'BATCH' ? delta.deltas : [delta]).find(
              (entry) => entry?.kind === 'TOKEN_MOVE_UNDONE'
            )
            if (undone?.kind !== 'TOKEN_MOVE_UNDONE')
              throw new Error('The room undo result has no token move undo.')
            assert.equal(undone.tokenId, fixture.mover.tokenId)
            assert.equal(submission.result.version, completedMovement.ownerToken.header.version + 1)
            assert.deepEqual(after.ownerToken.token.position, undone.position)
            assert.deepEqual(after.playerToken.token.position, undone.position)
            assert.deepEqual(after.ownerToken.token, reactionIssuedMovement.ownerToken.token)
            assert.deepEqual(after.playerToken.token, reactionIssuedMovement.playerToken.token)
            assert.equal(after.ownerToken.header.version, submission.result.version)
            assert.equal(after.playerToken.header.version, submission.result.version)
            assert.deepEqual(after.ownerFog.fogLayers, reactionIssuedMovement.ownerFog.fogLayers)
            assert.deepEqual(after.playerFog.fogLayers, reactionIssuedMovement.playerFog.fogLayers)
            assert.deepEqual(
              after.playerFog.fogLayers,
              after.ownerFog.fogLayers.filter(
                (layer) =>
                  layer.ownerUserId === null || layer.ownerUserId === player.identity.userId
              )
            )
            assert.deepEqual(after.run, completedMovement.run)
            assert.deepEqual(after.character, completedMovement.character)
            completedMovement = after
          }
        })
        console.log('Browser movement reaction, evidence, replay, reconnect, and departure passed.')
      }
      if (workload) {
        if (!independentCampaignId)
          throw new Error('V15 independent workload Campaign is unavailable.')
        if (!policies.movementReaction)
          throw new Error('V15 workload movement reaction policy is unavailable.')
        publicationAuthors.push({
          client: owner.client,
          userId: owner.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind: 'CREATURE'
        })
        browserDraftAuthors.push({ client: owner.client, subjectKind: 'CREATURE' })
        const { createCutoverWorkloadCreature } = await import('./fixtures/encounterAction')
        const workloadCreature = createCutoverWorkloadCreature(
          policies.movementReaction.eligibilityDefinitionId
        )
        const workloadDraft = await owner.client.mutation(api.content.drafts.save, {
          subjectKind: 'CREATURE',
          subjectId: crypto.randomUUID(),
          systemId: srdSystemRecord.id,
          label: workloadCreature.label,
          payload: workloadCreature
        })
        assert.ok(workloadDraft.updatedAt)
        await owner.client.mutation(api.content.publication.publishDraft, {
          subjectKind: 'CREATURE',
          subjectId: workloadDraft.subjectId,
          expectedDraftUpdatedAt: workloadDraft.updatedAt
        })
        // Each member keeps its Session rooms open for the whole workload, as a tabletop tab does.
        const workloadClient = () =>
          new DevelopmentHttpClient(deploymentUrl.origin, { logger: false, holdRooms: true })
        const workloadMembers = {
          gm: {
            owner: workloadClient(),
            peer: workloadClient(),
            userId: owner.identity.userId,
            fetchToken: owner.fetchToken
          },
          players: workloadPlayers.map(({ identity, fetchToken }) => ({
            client: workloadClient(),
            userId: identity.userId,
            fetchToken
          }))
        }
        const { verifyEncounterCutoverWorkload, verifyEncounterReactionContention } =
          await import('./developmentEncounterCutover')
        if (reactionContention)
          await verifyEncounterReactionContention({
            ...workloadMembers,
            campaignId: campaign.id,
            initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
            creatureId: workloadDraft.subjectId
          })
        else {
          const workloadResult = await verifyEncounterCutoverWorkload({
            ...workloadMembers,
            campaignId: campaign.id,
            independentCampaignId,
            initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
            creatureId: workloadDraft.subjectId,
            browserAccounts:
              process.env.V15_BROWSER_PROOF === '1'
                ? {
                    owner: {
                      email: owner.email,
                      password: owner.password,
                      username: owner.username
                    },
                    players: workloadPlayers.map(({ email, password, username }) => ({
                      email,
                      password,
                      username
                    })),
                    campaignPublicId: campaign.publicId
                  }
                : undefined,
            evidenceDirectory: process.env.CAMPAIGN_CUSTODY_EVIDENCE_DIRECTORY,
            preflightOnly: process.argv.includes('--encounter-v15-preflight')
          })
          console.log(`V15 native workload: ${JSON.stringify(workloadResult)}`)
        }
      }
      if (process.argv.includes('--encounter-cutover') || actionContention) {
        await cli(
          'accountEntitlements:setTier',
          { userId: owner.identity.userId, tier: 'GM' },
          false
        )
        const duplicateCampaign = await owner.client.mutation(
          api.campaigns.create.create,
          campaignInput
        )
        const contentionCampaign = await owner.client.mutation(
          api.campaigns.create.create,
          campaignInput
        )
        publicationAuthors.push({
          client: owner.client,
          userId: owner.identity.userId,
          systemId: srdSystemRecord.id,
          subjectKind: 'CREATURE'
        })
        browserDraftAuthors.push({
          client: owner.client,
          subjectKind: 'CREATURE'
        })
        const { automaticChargedCreature } = await import('./fixtures/encounterAction')
        const actionDraft = await owner.client.mutation(api.content.drafts.save, {
          subjectKind: 'CREATURE',
          subjectId: crypto.randomUUID(),
          systemId: srdSystemRecord.id,
          label: automaticChargedCreature.label,
          payload: automaticChargedCreature
        })
        assert.ok(actionDraft.updatedAt)
        await owner.client.mutation(api.content.publication.publishDraft, {
          subjectKind: 'CREATURE',
          subjectId: actionDraft.subjectId,
          expectedDraftUpdatedAt: actionDraft.updatedAt
        })
        const { verifyEncounterActionTransactions } =
          await import('./developmentEncounterActionTransactions')
        const actionPeer = new DevelopmentHttpClient(deploymentUrl.origin, {
          logger: false
        })
        const actionToken = await owner.fetchToken()
        owner.client.setAuth(actionToken)
        actionPeer.setAuth(actionToken)
        await verifyEncounterActionTransactions({
          owner: owner.client,
          peer: actionPeer,
          duplicateCampaignId: duplicateCampaign.id,
          contentionCampaignId: contentionCampaign.id,
          initiativePolicyDefinitionId: policies.scenarios[0]!.definitionId,
          initiativePolicyCatalogueId: policies.bootstrap.catalogue.id,
          creatureId: actionDraft.subjectId
        })
        console.log('Encounter action contention proof passed.')
      }
    } else {
      await player.client.mutation(api.campaigns.assignments.assign, {
        campaignId: campaign.id,
        characterId
      })
      const { verifyEncounterCharacterCommands } = await import('./developmentEncounterCharacter')
      await verifyEncounterCharacterCommands({
        owner: owner.client,
        player: player.client,
        anonymous: publicClient,
        campaignId: campaign.id,
        characterId
      })
    }
  } else if (process.argv.includes('--equipment-character')) {
    const author = await createAuthor()
    const other = await createAuthor()
    const characterId = crypto.randomUUID()
    characterFixtures.push({ userId: author.identity.userId, characterId })
    for (const subjectKind of ['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE'] as const) {
      publicationAuthors.push({
        client: author.client,
        userId: author.identity.userId,
        systemId: srdSystemRecord.id,
        subjectKind
      })
      browserDraftAuthors.push({ client: author.client, subjectKind })
    }
    const { verifyEquipmentCharacterDeletion } = await import('./developmentEquipmentCharacter')
    await verifyEquipmentCharacterDeletion({
      owner: author.client,
      other: other.client,
      anonymous: publicClient,
      characterId
    })
  } else if (process.argv.includes('--cleanup-campaign-custody')) {
    assert.equal(mode, 'local')
    const packet = resolve('local-validation/local-convex-proofs')
    const fileArgument = process.argv.find((arg) => arg.startsWith('--fixture-accounts='))
    assert.ok(fileArgument)
    const fixtureFile = resolve(fileArgument.slice('--fixture-accounts='.length))
    assert.ok(
      fixtureFile.startsWith(packet + sep),
      'Recovery input must be retained local evidence.'
    )
    const scope = record(JSON.parse(await readFile(fixtureFile, 'utf8')))
    const proofName = scope.proof
    assert.ok(typeof proofName === 'string')
    assert.match(
      proofName,
      /^(?:(?:custody-browser|authored-custody-deletion|vehicle-producers)-local|custody-local)-[0-9]{2}$/
    )
    const authoredDeletionRecovery = proofName.startsWith('authored-custody-deletion-')
    const completedCustodyRecovery = proofName.startsWith('custody-local-')
    assert.equal(fixtureFile, resolve(packet, proofName + '.fixture-accounts.json'))
    const completedProof = record(
      JSON.parse(await readFile(resolve(packet, proofName + '.metadata.json'), 'utf8'))
    )
    const completedCollector = record(
      JSON.parse(await readFile(resolve(packet, proofName + '.native-capture-status.json'), 'utf8'))
    )
    assert.equal(completedProof.target, 'phase82-local-linux')
    assert.equal(completedProof.exitCode, 1)
    assert.ok(typeof completedProof.startedAtUtc === 'string')
    assert.ok(typeof completedProof.completedAtUtc === 'string')
    assert.equal(scope.start, Date.parse(completedProof.startedAtUtc))
    assert.equal(scope.end, Date.parse(completedProof.completedAtUtc))
    assert.equal(completedCollector.collectorReady, true)
    assert.equal(completedCollector.collectorCompleted, true)
    assert.equal(completedCollector.collectorState, 'Completed')
    assert.equal(completedCollector.collectorTimedOut, false)
    assert.equal(completedCollector.proofExit, 1)
    const start = scope.start
    const end = scope.end
    assert.ok(typeof start === 'number' && typeof end === 'number')
    assert.ok(Array.isArray(scope.accounts) && scope.accounts.length === 3)
    const restored = []
    for (const raw of scope.accounts) {
      const expected = record(raw)
      assert.ok(typeof expected.email === 'string')
      assert.match(expected.email, /^draft_[0-9a-f]{12}@example\.invalid$/)
      assert.equal(typeof expected.createdAt, 'number')
      const user = record(
        await cli('adapter:findOne', {
          model: 'user',
          where: [{ field: 'email', value: expected.email }],
          select: ['_id', 'email', 'createdAt']
        })
      )
      assert.deepEqual(user, expected, 'Recover only the exact failed-proof synthetic identity.')
      assert.equal(typeof user._id, 'string')
      const session = randomBytes(32).toString('hex')
      await cli('adapter:create', {
        input: {
          model: 'session',
          data: {
            userId: user._id,
            token: session,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 30 * 60_000
          }
        }
      })
      const fetchToken = async () => responseToken(await auth('/convex/token', undefined, session))
      const client = new DevelopmentHttpClient(deploymentUrl.origin, {
        logger: false
      })
      client.setAuth(await fetchToken())
      const identity = await client.query(api.account.identity, {})
      assert.equal(identity.role, 'user')
      restored.push({
        client,
        fetchToken,
        identity,
        email: expected.email,
        session
      })
    }
    assert.equal(new Set(restored.map((entry) => entry.identity.userId)).size, 3)
    if (proofName.startsWith('vehicle-producers-')) {
      const original = record(
        JSON.parse(
          await readFile(
            resolve(
              'local-validation/local-convex-proofs/movement-replay-duplicates-20260916',
              proofName,
              'fixture-scope.json'
            ),
            'utf8'
          )
        )
      )
      assert.ok(typeof original.campaignId === 'string')
      assert.ok(Array.isArray(original.characterIds) && original.characterIds.length === 2)
      assert.ok(original.characterIds.every((value) => typeof value === 'string'))
      assert.deepEqual(
        restored.map((author) => ({ email: author.email, userId: author.identity.userId })),
        original.accounts
      )
      assert.equal(
        await cli(
          'characters/fixtureScopeReads:assertRemoved',
          {
            campaignId: original.campaignId,
            characterIds: original.characterIds,
            userIds: restored.map((author) => author.identity.userId),
            systemId: srdSystemRecord.id
          },
          false
        ),
        null
      )
      for (const author of restored) accounts.push(author)
      console.log(
        'Exact completed Vehicle proof scope has no Campaign, Character, route, publication, draft, source, assignment or private Character history; only native account cleanup registered.'
      )
    } else {
      const campaigns = await restored[0]!.client.query(api.campaigns.queries.list, {
        paginationOpts: { cursor: null, numItems: 2 }
      })
      assert.equal(campaigns.isDone, true)
      assert.equal(campaigns.page.length, 1)
      const campaign = await restored[0]!.client.query(api.campaigns.queries.get, {
        id: campaigns.page[0]!.id
      })
      assert.equal(campaign.name, 'Encounter execution fixture')
      assert.equal(campaign.status, 'ACTIVE')
      assert.equal(campaign.gameSystemId, srdSystemRecord.id)
      assert.ok(Date.parse(campaign.createdAt) >= start && Date.parse(campaign.createdAt) <= end)
      const ownerMemberships = campaign.memberships.filter((entry) => entry.role === 'OWNER')
      assert.equal(ownerMemberships.length, 1)
      const owner = restored.find((entry) => entry.identity.userId === ownerMemberships[0]!.userId)
      assert.ok(owner)
      const players = restored.filter((entry) => entry !== owner)
      assert.equal(players.length, 2)
      assert.equal(campaign.memberships.length, 3)
      const characterIds = players.map((player) => {
        const member = campaign.memberships.find((entry) => entry.userId === player.identity.userId)
        assert.equal(member?.role, 'PLAYER')
        assert.ok(member?.assignedCharacter)
        return member.assignedCharacter.id
      }) as [string, string]
      const shares = await owner.client.query(api.campaigns.contentShares.list, {
        campaignId: campaign.id,
        paginationOpts: { cursor: null, numItems: 2 }
      })
      assert.equal(shares.isDone, true)
      assert.equal(shares.page.length, authoredDeletionRecovery || completedCustodyRecovery ? 0 : 1)
      const share = shares.page[0]
      if (authoredDeletionRecovery || completedCustodyRecovery) {
        const original = record(
          JSON.parse(
            await readFile(
              completedCustodyRecovery
                ? resolve(packet, proofName + '.evidence', 'fixture-scope.json')
                : resolve(
                    'local-validation/local-convex-proofs/movement-replay-duplicates-20260916',
                    proofName,
                    'fixture-scope.json'
                  ),
              'utf8'
            )
          )
        )
        assert.equal(campaign.id, original.campaignId)
        assert.equal(campaign.createdAt, original.campaignCreatedAt)
        assert.ok(Array.isArray(original.characterIds))
        const originalCharacterIds = original.characterIds.map((value) => {
          assert.ok(typeof value === 'string')
          return value
        })
        assert.deepEqual(
          [...characterIds].sort((left, right) => left.localeCompare(right)),
          originalCharacterIds.sort((left, right) => left.localeCompare(right))
        )
        assert.ok(Array.isArray(original.accounts))
        assert.deepEqual(
          restored.map((author) => ({
            email: author.email,
            userId: author.identity.userId
          })),
          original.accounts
        )
        if (completedCustodyRecovery) {
          const fixture = {
            ownerUserId: owner.identity.userId,
            campaignId: campaign.id,
            gameSystemId: srdSystemRecord.id,
            userIds: restored.map((author) => author.identity.userId)
          }
          const { developmentCampaignInspectionSchema } =
            await import('@artificer-toolkit/schema/api/developmentCampaignLifecycle')
          const before = developmentCampaignInspectionSchema.parse(
            await cli('campaigns/developmentLifecycle:inspect', fixture, false)
          )
          assert.deepEqual(
            await owner.client.mutation(api.campaigns.deletion.remove, {
              campaignId: campaign.id,
              expectedVersion: campaign.version,
              confirmation: 'DELETE'
            }),
            { ok: true }
          )
          let removed = false
          for (let attempt = 0; attempt < 100; attempt++) {
            try {
              assert.equal(
                await cli(
                  'campaigns/developmentLifecycle:assertRemoved',
                  { fixture, descendants: before.descendants },
                  false
                ),
                null
              )
              removed = true
              break
            } catch {
              await new Promise((resolve) => setTimeout(resolve, 100))
            }
          }
          assert.equal(removed, true, 'Timed out waiting for exact Campaign inventory purge.')
        }
      } else {
        assert.ok(share)
        assert.equal(share.subjectKind, 'VEHICLE')
        assert.equal(share.sharedBy, owner.identity.userId)
      }
      if (!completedCustodyRecovery) {
        const cohort: CampaignCustodyCohort = {
          owner: owner.client,
          ownerUserId: owner.identity.userId,
          players: [players[0]!, players[1]!],
          playerUserIds: [players[0]!.identity.userId, players[1]!.identity.userId],
          characterIds,
          campaignId: campaign.id
        }
        custodyFixtureCohorts.push(cohort)
        encounterCampaignAuthors.push({
          client: owner.client,
          ownerUserId: owner.identity.userId,
          playerUserId: players[0]!.identity.userId,
          characterId: characterIds[0]
        })
      }
      for (const author of restored) {
        accounts.push(author)
        for (const subjectKind of [
          'EQUIPMENT',
          'BACKGROUND',
          'CLASS',
          'RACE',
          ...(author === owner ? ['VEHICLE' as const] : [])
        ] as const) {
          publicationAuthors.push({
            client: author.client,
            userId: author.identity.userId,
            systemId: srdSystemRecord.id,
            subjectKind
          })
          browserDraftAuthors.push({ client: author.client, subjectKind })
        }
      }
      for (const [index, player] of players.entries())
        characterFixtures.push({
          userId: player.identity.userId,
          characterId: characterIds[index]!
        })
      if (share) {
        const request = {
          campaignId: campaign.id,
          subjectKind: 'VEHICLE' as const,
          subjectId: share.subjectId,
          sharedBy: share.sharedBy,
          expectedCampaignVersion: campaign.version,
          commandId: crypto.randomUUID()
        }
        await assert.rejects(
          players[0]!.client.mutation(api.campaigns.contentShares.unshare, request),
          /owner|permission|authorized|cannot remove/i
        )
        const receipt = await owner.client.mutation(api.campaigns.contentShares.unshare, request)
        assert.equal(receipt.campaignVersion, campaign.version + 1)
        assert.deepEqual(receipt.removedShares, [
          {
            subjectKind: 'VEHICLE',
            subjectId: share.subjectId,
            sharedBy: share.sharedBy
          }
        ])
        assert.deepEqual(
          await owner.client.mutation(api.campaigns.contentShares.unshare, request),
          receipt
        )
        console.log(
          'Scoped preserved fixture: public unshare authority, exact replay and cargo evacuation passed.'
        )
      } else if (!completedCustodyRecovery) {
        console.log('Exact completed custody fixture identities validated for cleanup.')
      } else {
        console.log('Exact completed custody Campaign deleted and inventory purge verified.')
      }
    }
  } else if (process.argv.includes('--cleanup-campaign-lifecycle')) {
    assert.equal(mode, 'local')
    const packet = resolve('local-validation/local-convex-proofs')
    const attemptArgument = process.argv.find((arg) => arg.startsWith('--fixture-attempt='))
    assert.ok(attemptArgument)
    const attempt = attemptArgument.slice('--fixture-attempt='.length)
    assert.match(attempt, /^campaign-lifecycle-browser[0-9]{2}$/)
    const evidenceDirectory = resolve(packet, `${attempt}.evidence`)
    const fixtureFile = resolve(evidenceDirectory, 'fixture-scope.json')
    assert.equal(
      fixtureFile,
      resolve(packet, `${attempt}.evidence`, 'fixture-scope.json'),
      'Recovery input must be the retained fixture scope for this exact attempt.'
    )
    const scope = record(JSON.parse(await readFile(fixtureFile, 'utf8')))
    const completedProof = record(
      JSON.parse(await readFile(resolve(packet, `${attempt}.metadata.json`), 'utf8'))
    )
    const completedCollector = record(
      JSON.parse(await readFile(resolve(packet, `${attempt}.native-capture-status.json`), 'utf8'))
    )
    assert.equal(completedProof.target, 'phase82-local-linux')
    assert.equal(completedProof.exitCode, 1)
    assert.equal(completedCollector.collectorReady, true)
    assert.equal(completedCollector.collectorCompleted, true)
    assert.equal(completedCollector.collectorState, 'Completed')
    assert.equal(completedCollector.collectorTimedOut, false)
    assert.equal(completedCollector.proofExit, 1)
    assert.ok(typeof completedProof.startedAtUtc === 'string')
    assert.ok(typeof completedProof.completedAtUtc === 'string')
    const start = Date.parse(completedProof.startedAtUtc)
    const end = Date.parse(completedProof.completedAtUtc)
    assert.ok(Number.isSafeInteger(start) && Number.isSafeInteger(end) && start <= end)
    assert.ok(typeof scope.createdAtUtc === 'string')
    const scopeCreatedAt = Date.parse(scope.createdAtUtc)
    assert.ok(scopeCreatedAt >= start && scopeCreatedAt <= end)
    const roles = ['owner', 'player', 'outsider', 'invitee'] as const
    const restored: Array<{
      client: DevelopmentHttpClient
      email: string
      session: string
      userId: string
    }> = []
    for (const role of roles) {
      const expected = record(scope[role])
      assert.ok(typeof expected.email === 'string')
      assert.match(expected.email, /^draft_[0-9a-f]{12}@example\.invalid$/)
      assert.ok(typeof expected.userId === 'string')
      assert.match(
        expected.userId,
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      )
      const user = record(
        await cli('adapter:findOne', {
          model: 'user',
          where: [{ field: 'email', value: expected.email }],
          select: ['_id', 'email', 'createdAt']
        })
      )
      assert.ok(
        typeof user._id === 'string' && user._id.length > 0,
        'Recovery requires a provider identity.'
      )
      assert.equal(
        user.email,
        expected.email,
        'Recovery requires the exact retained fixture email.'
      )
      assert.ok(
        typeof user.createdAt === 'number' && user.createdAt >= start && user.createdAt <= end,
        'Recovery requires a provider identity created during the completed proof.'
      )
      const session = randomBytes(32).toString('hex')
      await cli('adapter:create', {
        input: {
          model: 'session',
          data: {
            userId: user._id,
            token: session,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            expiresAt: Date.now() + 30 * 60_000
          }
        }
      })
      const client = new DevelopmentHttpClient(deploymentUrl.origin, { logger: false })
      client.setAuth(await responseToken(await auth('/convex/token', undefined, session)))
      const identity = await client.query(api.account.identity, {})
      assert.equal(
        identity.userId,
        expected.userId,
        'Restored session resolved an unexpected identity.'
      )
      assert.equal(identity.role, 'user')
      restored.push({ client, email: expected.email, session, userId: expected.userId })
    }
    assert.equal(new Set(restored.map((fixture) => fixture.userId)).size, roles.length)
    const owner = restored[0]!
    const player = restored[1]!
    const campaigns = await owner.client.query(api.campaigns.queries.list, {
      paginationOpts: { cursor: null, numItems: 8 }
    })
    assert.equal(campaigns.isDone, true)
    assert.ok(campaigns.page.length <= 4, 'Unexpected lifecycle fixture Campaign count.')
    for (const campaign of campaigns.page) {
      assert.equal(campaign.name, 'Encounter execution fixture')
      assert.equal(campaign.gameSystemId, srdSystemRecord.id)
      const createdAt = Date.parse(campaign.createdAt)
      assert.ok(createdAt >= start && createdAt <= end)
    }
    accounts.push(...restored)
    campaignLifecycleAuthors.push({
      client: owner.client,
      ownerUserId: owner.userId,
      userIds: restored.map((fixture) => fixture.userId),
      deletions: new Map<string, DevelopmentCampaignInspection>()
    })
    blueprintAuthors.push({
      client: owner.client,
      userId: owner.userId,
      gameSystemId: srdSystemRecord.id
    })
    for (const subjectKind of ['BACKGROUND'] as const) {
      publicationAuthors.push({
        client: owner.client,
        userId: owner.userId,
        systemId: srdSystemRecord.id,
        subjectKind
      })
      browserDraftAuthors.push({ client: owner.client, subjectKind })
    }
    for (const subjectKind of ['EQUIPMENT', 'BACKGROUND', 'CLASS', 'RACE'] as const) {
      publicationAuthors.push({
        client: player.client,
        userId: player.userId,
        systemId: srdSystemRecord.id,
        subjectKind
      })
      browserDraftAuthors.push({ client: player.client, subjectKind })
    }
    for (const key of ['characterId', 'archivedCharacterId', 'unrelatedCharacterId'] as const) {
      const characterId = scope[key]
      assert.ok(typeof characterId === 'string')
      assert.match(characterId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)
      characterFixtures.push({ userId: player.userId, characterId })
    }
  } else if (process.argv.includes('--cleanup-equipment-capacity')) {
    const email = process.argv.find((arg) => arg.startsWith('--fixture-email='))?.split('=')[1]
    const createdAt = Number(
      process.argv.find((arg) => arg.startsWith('--fixture-created-at='))?.split('=')[1]
    )
    assert.ok(email && /^draft_[0-9a-f]{12}@example\.invalid$/.test(email))
    assert.ok(Number.isSafeInteger(createdAt) && createdAt > 0)
    const user = record(
      await cli('adapter:findOne', {
        model: 'user',
        where: [{ field: 'email', value: email }],
        select: ['_id', 'email', 'createdAt']
      })
    )
    assert.equal(user.email, email)
    assert.equal(user.createdAt, createdAt, 'Recovery must name the exact original fixture.')
    assert.equal(typeof user._id, 'string')
    const fixture: (typeof accounts)[number] = {
      email,
      session: randomBytes(32).toString('hex')
    }
    accounts.push(fixture)
    await cli('adapter:create', {
      input: {
        model: 'session',
        data: {
          userId: user._id,
          token: fixture.session,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          expiresAt: Date.now() + 30 * 60_000
        }
      }
    })
    const jwt = await responseToken(await auth('/convex/token', undefined, fixture.session))
    fixture.client = new DevelopmentHttpClient(deploymentUrl.origin, {
      logger: false
    })
    fixture.client.setAuth(jwt)
    const identity = await fixture.client.query(api.account.identity, {})
    assert.equal(identity.role, 'user')
    publicationAuthors.push({
      client: fixture.client,
      userId: identity.userId,
      systemId: srdSystemRecord.id,
      subjectKind: 'EQUIPMENT'
    })
    browserDraftAuthors.push({
      client: fixture.client,
      subjectKind: 'EQUIPMENT'
    })
    playerTierFixtures.push(identity.userId)
    const generations = new Map<number, string>()
    for (const item of await ownedSubjects(
      { userId: identity.userId, systemId: srdSystemRecord.id },
      'EQUIPMENT'
    )) {
      const match = /^Capacity generation (\d+)$/.exec(item.label)
      assert.ok(match, 'Recovery may remove only named capacity fixtures.')
      const generation = Number(match[1])
      assert.ok(generation < 500 && !generations.has(generation))
      generations.set(generation, item.id)
    }
    const { cleanupEquipmentCapacity } = await import('./developmentEquipmentCapacity')
    await cleanupEquipmentCapacity(
      fixture.client,
      [...generations].sort(([a], [b]) => a - b).map(([, id]) => id)
    )
    assert.deepEqual(
      (
        await fixture.client.query(api.content.equipmentOptions.list, {
          systemId: srdSystemRecord.id
        })
      )
        .map((item) => item.value)
        .sort(),
      srdBaselineContent.subjects.equipment.map((item) => item.id).sort()
    )
    console.log(
      `Recovered ${generations.size} remaining capacity roots; exact canonical option UUIDs restored.`
    )
  } else if (process.argv.includes('--equipment-capacity')) {
    const author = await createAuthor()
    playerTierFixtures.push(author.identity.userId)
    await cli(
      'content/development:setFixturePlayerTier',
      { userId: author.identity.userId, enabled: true },
      false
    )
    publicationAuthors.push({
      client: author.client,
      userId: author.identity.userId,
      systemId: srdSystemRecord.id,
      subjectKind: 'EQUIPMENT'
    })
    browserDraftAuthors.push({
      client: author.client,
      subjectKind: 'EQUIPMENT'
    })
    const { verifyEquipmentCapacity } = await import('./developmentEquipmentCapacity')
    await verifyEquipmentCapacity({
      owner: author.client,
      userId: author.identity.userId
    })
  } else if (
    process.argv.includes('--publication') ||
    process.argv.includes('--publication-class') ||
    process.argv.includes('--publication-feat') ||
    process.argv.includes('--publication-equipment')
  ) {
    const author = await createAuthor()
    const other = await createAuthor()
    const subjectKind = process.argv.includes('--publication-class')
      ? 'CLASS'
      : process.argv.includes('--publication-feat')
        ? 'FEAT'
        : process.argv.includes('--publication-equipment')
          ? 'EQUIPMENT'
          : 'BACKGROUND'
    const source =
      subjectKind === 'CLASS'
        ? srdBaselineContent.subjects.classes.find((item) => item.label === 'Fighter')
        : subjectKind === 'FEAT'
          ? srdBaselineContent.subjects.feats.find((item) => item.label === 'Grappler')
          : subjectKind === 'EQUIPMENT'
            ? [...srdBaselineContent.subjects.equipment].sort(
                (a, b) => JSON.stringify(b).length - JSON.stringify(a).length
              )[0]
            : srdBaselineContent.subjects.backgrounds.find((item) => item.label === 'Acolyte')
    assert.ok(source)
    publicationAuthors.push({
      client: author.client,
      userId: author.identity.userId,
      systemId: source.systemId,
      subjectKind
    })
    browserDraftAuthors.push({ client: author.client, subjectKind })
    const draft = authoredDraftDtoSchema.parse(
      await author.client.mutation(api.content.drafts.duplicate, {
        subjectKind,
        subjectId: source.id
      })
    )
    const { verifyPublication } = await import('./developmentPublication')
    await verifyPublication({
      owner: author.client,
      other: other.client,
      anonymous: publicClient,
      draft
    })
    if (subjectKind === 'EQUIPMENT') {
      const { verifyEquipmentPublicationRaces } = await import('./developmentEquipmentPublication')
      await verifyEquipmentPublicationRaces({
        owner: author.client,
        trackDraft: (created) =>
          drafts.push({
            client: author.client,
            subjectKind: 'EQUIPMENT',
            subjectId: created.subjectId
          })
      })
    }
    if (subjectKind === 'CLASS') {
      const fireball = srdBaselineContent.subjects.spells.find((item) => item.label === 'Fireball')
      assert.ok(fireball, 'Canonical Fireball is required for Class publication races.')
      publicationAuthors.push({
        client: author.client,
        userId: author.identity.userId,
        systemId: fireball.systemId,
        subjectKind: 'SPELL'
      })
      browserDraftAuthors.push({ client: author.client, subjectKind: 'SPELL' })
      const champion = srdBaselineContent.subjects.classes.find((item) => item.label === 'Champion')
      assert.ok(champion, 'Canonical Champion is required for Class publication races.')
      const { verifyClassPublicationRaces } = await import('./developmentClassPublication')
      await verifyClassPublicationRaces({
        owner: author.client,
        fighterId: source.id,
        championId: champion.id,
        fireballId: fireball.id,
        trackDraft: (created) =>
          drafts.push({
            client: author.client,
            subjectKind: created.subjectKind,
            subjectId: created.subjectId
          })
      })
    }
  } else if (
    process.argv.includes('--authoring-browser') ||
    process.argv.includes('--guided-copy-browser') ||
    process.argv.includes('--publication-browser') ||
    process.argv.includes('--publication-class-browser') ||
    process.argv.includes('--publication-feat-browser') ||
    process.argv.includes('--publication-equipment-browser')
  ) {
    const author = await createAuthor()
    const classBrowser = process.argv.includes('--publication-class-browser')
    const featBrowser = process.argv.includes('--publication-feat-browser')
    const equipmentBrowser = process.argv.includes('--publication-equipment-browser')
    const subjectKind = classBrowser
      ? 'CLASS'
      : featBrowser
        ? 'FEAT'
        : equipmentBrowser
          ? 'EQUIPMENT'
          : 'BACKGROUND'
    const source = classBrowser
      ? srdBaselineContent.subjects.classes.find((item) => item.label === 'Fighter')
      : featBrowser
        ? srdBaselineContent.subjects.feats.find((item) => item.label === 'Grappler')
        : equipmentBrowser
          ? srdBaselineContent.subjects.equipment.find((item) => item.label === 'Longsword +1')
          : srdBaselineContent.subjects.backgrounds.find((item) => item.label === 'Acolyte')
    assert.ok(source, 'Canonical source is required for the authoring journey.')
    browserDraftAuthors.push({ client: author.client, subjectKind })
    const publicationBrowser =
      classBrowser ||
      featBrowser ||
      equipmentBrowser ||
      process.argv.includes('--publication-browser')
    if (publicationBrowser) {
      publicationAuthors.push({
        client: author.client,
        userId: author.identity.userId,
        systemId: source.systemId,
        subjectKind
      })
    }
    let publishedItem:
      | BackgroundAuthoredDto
      | ClassAuthoredDto
      | FeatAuthoredDto
      | EquipmentAuthoredDto
      | null = null
    let latestSavedDraft: AuthoredDraftResult | null = null
    const equipmentOptions = featBrowser
      ? []
      : await author.client.query(api.content.equipmentOptions.list, {
          systemId: source.systemId,
          ...(equipmentBrowser ? { excludeVariants: true } : {})
        })
    if (!featBrowser)
      assert.ok(equipmentOptions[0], 'Canonical equipment is required for the Guided selector.')
    const equipmentParent =
      equipmentBrowser && 'parentEquipmentId' in source
        ? equipmentOptions.find((item) => item.value === source.parentEquipmentId)
        : undefined
    if (equipmentBrowser)
      assert.ok(equipmentParent, 'The canonical variant must have a visible base item.')
    const { verifyNativeAuthoring } = await import('../../web/tests/live-backend/nativeAuthoring')
    let start: Parameters<typeof verifyNativeAuthoring>[0]['start']
    if (process.argv.includes('--guided-copy-browser') || publicationBrowser) {
      start = {
        kind: 'COPY',
        sourceLabel: source.label,
        verifyCopied: async () => {
          const owned = authoredDraftListPageSchema.parse(
            await author.client.query(api.content.drafts.list, {
              subjectKind,
              paginationOpts: { numItems: 48, cursor: null }
            })
          )
          assert.equal(owned.isDone, true)
          assert.equal(owned.page.length, 1, 'One UI copy must create exactly one owned draft.')
          const copied = authoredDraftDtoSchema.parse(
            await author.client.query(api.content.drafts.get, {
              subjectKind,
              subjectId: owned.page[0].subjectId
            })
          )
          assert.notEqual(copied.subjectId, source.id)
          assert.equal(copied.userId, author.identity.userId)
          assert.equal(copied.systemId, source.systemId)
          assert.equal(copied.label, `${source.label} Copy`)
          assert.equal(copied.draftState, 'DRAFT_ONLY')
          if (equipmentParent) {
            assert.equal(copied.payload.parentEquipmentId, equipmentParent.value)
          }
          drafts.push({
            client: author.client,
            subjectKind,
            subjectId: copied.subjectId
          })
          return { publicId: copied.publicId, label: copied.label }
        }
      }
    } else {
      const copied = authoredDraftDtoSchema.parse(
        await author.client.mutation(api.content.drafts.duplicate, {
          subjectKind,
          subjectId: source.id
        })
      )
      drafts.push({
        client: author.client,
        subjectKind,
        subjectId: copied.subjectId
      })
      start = { kind: 'EDIT', publicId: copied.publicId, label: copied.label }
    }
    await verifyNativeAuthoring({
      domain: classBrowser
        ? 'class'
        : featBrowser
          ? 'feat'
          : equipmentBrowser
            ? 'equipment'
            : 'background',
      evidenceDirectory: classBrowser
        ? 'local-validation/local-convex-proofs/phase82-native-authoring-browser-closure'
        : featBrowser
          ? 'local-validation/local-convex-proofs/phase82-native-authoring-browser-closure'
          : equipmentBrowser
            ? 'local-validation/local-convex-proofs/phase82-equipment-frontend'
            : publicationBrowser
              ? 'local-validation/local-convex-proofs/phase82-native-authoring-browser-closure'
              : 'local-validation/local-convex-proofs/phase82-foundation',
      email: author.email,
      password: author.password,
      start,
      equipmentOptionLabel: equipmentParent?.label ?? equipmentOptions[0]?.label,
      verifySaved: async (label) => {
        const draft = drafts.find((entry) => entry.client === author.client)
        assert.ok(draft)
        const saved = authoredDraftDtoSchema.parse(
          await author.client.query(api.content.drafts.get, {
            subjectKind: draft.subjectKind,
            subjectId: draft.subjectId
          })
        )
        assert.equal(saved?.label, label)
        assert.equal(saved?.payload.label, label)
        assert.equal(saved?.userId, author.identity.userId)
        if (equipmentParent) {
          assert.equal(
            saved.payload.parentEquipmentId,
            equipmentParent.value,
            'Saving a copied variant must preserve its canonical parent.'
          )
        }
        if (publicationBrowser) {
          assert.ok(saved)
          const exported = artificerPortableContentDtoSchema.parse(
            await author.client.query(api.content.exports.get, {
              subjectKind,
              id: draft.subjectId,
              view: 'draft'
            })
          )
          assert.equal(exported.item.kind, subjectKind)
          assert.deepEqual(exported.item.data, stripPortableMetadata(saved.payload))
        }
        if (publishedItem) {
          const active = authoredDetailResponseSchemas[subjectKind].parse(
            await author.client.query(api.content.details.get, {
              subjectKind,
              id: draft.subjectId
            })
          )
          assert.deepEqual(
            active?.item,
            publishedItem,
            'Saving working edits must not change the active document.'
          )
          assert.equal(saved?.draftState, 'ACTIVE_WITH_DRAFT')
        }
        latestSavedDraft = saved
      },
      verifyExported: publicationBrowser
        ? async (exported) => {
            assert.ok(publishedItem)
            assert.equal(exported.item.kind, subjectKind)
            assert.deepEqual(exported.item.data, stripPortableMetadata(publishedItem))
            if (equipmentParent) {
              assert.equal(
                exported.references.find(
                  (item) => item.kind === 'EQUIPMENT' && item.id === equipmentParent.value
                )?.label,
                equipmentParent.label,
                'Portable Equipment must retain its readable parent reference.'
              )
            }
          }
        : undefined,
      verifyPublished: publicationBrowser
        ? async (label) => {
            const draft = drafts.find((entry) => entry.client === author.client)
            assert.ok(draft)
            const active = authoredDetailResponseSchemas[subjectKind].parse(
              await author.client.query(api.content.details.get, {
                subjectKind,
                id: draft.subjectId
              })
            )
            assert.ok(active?.item)
            assert.equal(active.item.label, label)
            assert.equal(active.item.id, draft.subjectId)
            assert.equal(active.item.userId, author.identity.userId)
            assert.equal(active.item.systemId, source.systemId)
            assert.equal(active.item.status, 'ACTIVE')
            assert.equal(active.hasDraft, false)
            assert.equal(
              await author.client.query(api.content.drafts.get, {
                subjectKind,
                subjectId: draft.subjectId
              }),
              null
            )
            assert.equal(
              (
                await author.client.query(api.content.catalogue.counts, {
                  subjectKind,
                  systemId: source.systemId
                })
              ).ownedCount,
              1
            )
            publishedItem = active.item
          }
        : undefined,
      verifyAfterActiveDeletion: publicationBrowser
        ? async (label) => {
            const draft = drafts.find((entry) => entry.client === author.client)
            assert.ok(draft)
            assert.ok(latestSavedDraft)
            assert.equal(latestSavedDraft.label, label)
            const retained = authoredDraftDtoSchema.parse(
              await author.client.query(api.content.drafts.get, {
                subjectKind: draft.subjectKind,
                subjectId: draft.subjectId
              })
            )
            assert.equal(
              await author.client.query(api.content.details.get, {
                subjectKind,
                id: draft.subjectId,
                view: 'active'
              }),
              null,
              'Native active reads must not expose the deleted owned content.'
            )
            assert.equal(
              await publicClient.query(api.content.details.get, {
                subjectKind,
                id: draft.subjectId
              }),
              null,
              'Public native reads must not expose the deleted owned active content.'
            )
            assert.equal(
              (
                await author.client.query(api.content.catalogue.counts, {
                  subjectKind,
                  systemId: source.systemId
                })
              ).ownedCount,
              0
            )
            assert.deepEqual(
              {
                subjectId: retained.subjectId,
                publicId: retained.publicId,
                payload: retained.payload,
                checksum: checksumRuleDocument(retained.payload)
              },
              {
                subjectId: latestSavedDraft.subjectId,
                publicId: latestSavedDraft.publicId,
                payload: latestSavedDraft.payload,
                checksum: checksumRuleDocument(latestSavedDraft.payload)
              }
            )
            assert.equal(retained.draftState, 'DRAFT_ONLY')
            assert.equal(retained.baseActiveUpdatedAt, null)
            const master = authoredDetailResponseSchemas[subjectKind].parse(
              await publicClient.query(api.content.details.get, {
                subjectKind,
                id: source.id
              })
            )
            assert.ok(master?.item)
            assert.deepEqual(master.item, JSON.parse(JSON.stringify(source)))
          }
        : undefined,
      verifyAfterDraftDeletion: publicationBrowser
        ? async () => {
            const draft = drafts.find((entry) => entry.client === author.client)
            assert.ok(draft)
            assert.equal(
              await author.client.query(api.content.drafts.get, {
                subjectKind: draft.subjectKind,
                subjectId: draft.subjectId
              }),
              null
            )
            assert.equal(
              (
                await author.client.query(api.content.catalogue.counts, {
                  subjectKind,
                  systemId: source.systemId
                })
              ).ownedCount,
              0
            )
            const ownedDrafts = authoredDraftListPageSchema.parse(
              await author.client.query(api.content.drafts.list, {
                subjectKind,
                paginationOpts: { numItems: 48, cursor: null }
              })
            )
            assert.equal(ownedDrafts.isDone, true)
            assert.deepEqual(ownedDrafts.page, [])
          }
        : undefined
    })
  } else if (process.argv.includes('--account-deletion-browser')) {
    assert.equal(mode, 'local')
    const attempt = process.argv
      .find((argument) => argument.startsWith('--fixture-attempt='))
      ?.slice('--fixture-attempt='.length)
    assert.ok(attempt)
    assert.match(attempt, /^account-deletion-browser[a-z0-9-]{2,80}$/u)
    const evidenceDirectory = resolve('local-validation/local-convex-proofs', attempt + '.evidence')
    const [
      { createDevelopmentAccountDeletionFixture },
      { verifyAccountDeletionBrowser },
      { campaignChatPageDtoSchema, deletedCampaignAuthorLabel },
      { developmentAccountDeletionInspectResultSchema }
    ] = await Promise.all([
      import('./developmentAccountDeletionFixture'),
      import('../../web/tests/live-backend/accountDeletion'),
      import('@artificer-toolkit/schema/api/campaignCommunication'),
      import('@artificer-toolkit/schema/api/developmentAccountDeletion')
    ])
    const fixture = await createDevelopmentAccountDeletionFixture({ createAuthor, cli })
    type DeletionScope = 'IDENTITY' | 'CHARACTERS' | 'AUTHORED' | 'DEFERRED'
    type DeletionCapture = Record<DeletionScope, unknown>
    type CatalogueRow = Record<string, unknown> & { _id: string }
    const scopes: DeletionScope[] = ['IDENTITY', 'CHARACTERS', 'AUTHORED', 'DEFERRED']
    const captureDeletionState = async (): Promise<DeletionCapture> => {
      const inspections = await Promise.all(
        scopes.map(async (scope) => {
          const result = developmentAccountDeletionInspectResultSchema.parse(
            await cli(
              'developmentAccountDeletion:inspect',
              {
                auditorUserId: fixture.auditor.identity.userId,
                subjectUserId: fixture.subject.identity.userId,
                authUserId: fixture.subjectAuthUserId,
                email: fixture.subject.email,
                scope,
                known: fixture.known
              },
              false
            )
          )
          assert.deepEqual(result.known, fixture.known)
          const state: unknown = JSON.parse(result.stateJson)
          return [scope, state] as const
        })
      )
      return Object.fromEntries(inspections) as DeletionCapture
    }
    const catalogue = (captured: DeletionCapture) => {
      const tables: Record<string, CatalogueRow[]> = {}
      for (const state of Object.values(captured)) {
        assert.ok(state && typeof state === 'object' && !Array.isArray(state))
        for (const [name, value] of Object.entries(state)) {
          assert.ok(Array.isArray(value), 'Malformed account-deletion catalogue table.')
          const rows = value.map((item: unknown) => {
            assert.ok(item && typeof item === 'object' && !Array.isArray(item) && '_id' in item)
            assert.equal(typeof item._id, 'string')
            return item as CatalogueRow
          })
          tables[name] = [
            ...new Map([...(tables[name] ?? []), ...rows].map((row) => [row._id, row])).values()
          ]
        }
      }
      return tables
    }
    const assertPrivateCleanup = (captured: DeletionCapture) => {
      const tables = catalogue(captured)
      for (const name of [
        'providerUsers',
        'providerAccounts',
        'providerSessions',
        'userProfiles',
        'characters',
        'characterPlayStates',
        'characterDrafts',
        'characterDraftPayloads',
        'authoredRoots',
        'authoredImportRefs',
        'contentSources',
        'reusableDefinitions',
        'reusableDefinitionDrafts',
        'encounterBlueprints',
        'encounterBlueprintUpdates',
        'characterCommandReceipts',
        'characterActiveRuleEffects',
        'userRollHistory',
        'accountEntitlements',
        'socialProfiles',
        'notificationFeedItems'
      ]) {
        assert.ok(tables[name], 'Required cleanup catalogue is missing: ' + name)
        assert.deepEqual(tables[name], [], 'Native account deletion retains private state: ' + name)
      }
      assert.equal(
        tables.authoredDrafts?.some((row) => row.userId === fixture.subject.identity.userId) ??
          false,
        false,
        'Native account deletion retains an owned authored draft.'
      )
      const privateSubjectIds = new Set([
        ...fixture.known.characterIds,
        ...fixture.known.rootReferences.map((reference) => reference.id)
      ])
      assert.equal(
        tables.authoredRouteIds?.some(
          (row) => typeof row.subjectId === 'string' && privateSubjectIds.has(row.subjectId)
        ) ?? false,
        false,
        'Native account deletion retains private route identities.'
      )
      const sources = new Set(fixture.known.sourceIds)
      assert.equal(
        tables.authoredVersions?.some(
          (row) => typeof row.contentSourceId === 'string' && sources.has(row.contentSourceId)
        ) ?? false,
        false,
        'Native account deletion retains owned authored versions.'
      )
      assert.ok(baseline)
      const prior = catalogue(baseline)
      for (const name of ['authoredDependentRoots', 'authoredDrafts', 'authoredVersions']) {
        const retainedIds = new Set((tables[name] ?? []).map((row) => row._id))
        const protectedRows = (prior[name] ?? []).filter(
          (row) =>
            name === 'authoredDependentRoots' ||
            (name === 'authoredDrafts'
              ? row.userId !== fixture.subject.identity.userId
              : typeof row.contentSourceId === 'string' && !sources.has(row.contentSourceId))
        )
        assert.equal(
          protectedRows.every((row) => retainedIds.has(row._id)),
          true,
          'Native account deletion removes protected shared state: ' + name
        )
      }
    }
    const assertFinalDeferredCleanup = (captured: DeletionCapture) => {
      const finalTables = catalogue(captured)
      const retainedAssets = finalTables.mediaAssets ?? []
      // The subject's own assets are purged, never transferred (ADR 0012 amendment); only a map a
      // shared Campaign still references is retained, and this fixture has none.
      assert.deepEqual(retainedAssets, [], 'Native account deletion retains media.')
      for (const name of [
        'charactersWithPortrait',
        'sceneDefinitions',
        'campaignScenes',
        'authoredImageSlots',
        'socialProfiles',
        'socialBlocks',
        'campaignInvites',
        'socialApplications',
        'socialReports',
        'socialModerationActions',
        'notificationFeedItems',
        'notificationDeliveryIntents',
        'campaignCopyJobs',
        'campaignCopyStagedNotebookSections'
      ])
        assert.deepEqual(
          finalTables[name] ?? [],
          [],
          'Deferred account cleanup retains subject state: ' + name
        )
    }

    let baseline: DeletionCapture | undefined
    let deleted: DeletionCapture | undefined
    let historicalChat: unknown
    let historicalSession: unknown
    let historicalRun: unknown
    let subjectRemovedFromCleanup = false
    const removeDeletedSubjectFromCleanup = () => {
      if (subjectRemovedFromCleanup) return
      const cleanupIndex = accounts.findIndex((account) => account.email === fixture.subject.email)
      assert.notEqual(cleanupIndex, -1)
      accounts.splice(cleanupIndex, 1)
      subjectRemovedFromCleanup = true
    }
    let journeyError: unknown
    try {
      await verifyAccountDeletionBrowser({
        accounts: {
          subject: {
            email: fixture.subject.email,
            password: fixture.subject.password,
            userId: fixture.subject.identity.userId,
            username: fixture.subject.username
          },
          auditor: {
            email: fixture.auditor.email,
            password: fixture.auditor.password,
            userId: fixture.auditor.identity.userId,
            username: fixture.auditor.username
          }
        },
        evidenceDirectory,
        prepareFinalDeletion: async () => {
          for (const campaignId of [
            fixture.ids.ownedActiveCampaignId,
            fixture.ids.ownedArchivedCampaignId
          ]) {
            const campaign = await fixture.subject.client.query(api.campaigns.queries.get, {
              id: campaignId
            })
            assert.ok(campaign.status === 'ACTIVE' || campaign.status === 'ARCHIVED')
            assert.deepEqual(
              await fixture.subject.client.mutation(api.campaigns.deletion.remove, {
                campaignId,
                expectedVersion: campaign.version,
                confirmation: 'DELETE'
              }),
              { ok: true }
            )
            // Deletion runs as a bounded job; the Campaign still blocks account deletion until it ends.
            await waitForCampaignDeletion(fixture.subject.client, campaignId, 'Account deletion')
          }
          assert.deepEqual(
            await cli(
              'developmentAccountDeletionRollback:verifyRollback',
              {
                fixture: {
                  auditorUserId: fixture.auditor.identity.userId,
                  subjectUserId: fixture.subject.identity.userId,
                  authUserId: fixture.subjectAuthUserId,
                  email: fixture.subject.email
                },
                sessionToken: fixture.subject.session,
                command: {
                  email: fixture.subject.email,
                  currentPassword: fixture.subject.password
                }
              },
              false
            ),
            { rolledBack: true }
          )
        },
        verifyState: async (stage) => {
          let current = await captureDeletionState()
          if (stage === 'READY') {
            baseline = current
            historicalChat = campaignChatPageDtoSchema.parse(
              await fixture.auditor.client.query(api.campaigns.chat.list, {
                campaignId: fixture.ids.sharedCampaignId,
                room: 'TABLE',
                limit: 50
              })
            )
            historicalSession = await fixture.auditor.client.query(api.campaigns.sessions.get, {
              campaignId: fixture.ids.sharedCampaignId,
              sessionNumber: fixture.ids.sessionNumber
            })
            historicalRun = await fixture.auditor.client.query(api.encounters.projectionReads.get, {
              encounterId: fixture.ids.runId
            })
            return
          }
          assert.ok(baseline)
          if (
            stage === 'INVALID_EMAIL_NO_WRITE' ||
            stage === 'WRONG_PASSWORD_NO_WRITE' ||
            stage === 'OWNED_CAMPAIGNS_REFUSED'
          ) {
            assert.deepEqual(current, baseline)
            return
          }
          if (stage === 'DELETED') {
            // The request signs the subject out and schedules a staged deletion (ADR 0040): poll,
            // with a bound, until its steps have removed the account and every owned row.
            for (let pass = 0; pass < 120; pass += 1) {
              try {
                assertPrivateCleanup(current)
                break
              } catch {
                await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
                current = await captureDeletionState()
              }
            }
          }
          assertPrivateCleanup(current)
          if (stage === 'DELETED') {
            const beforeChat = campaignChatPageDtoSchema.parse(historicalChat)
            const afterChat = campaignChatPageDtoSchema.parse(
              await fixture.auditor.client.query(api.campaigns.chat.list, {
                campaignId: fixture.ids.sharedCampaignId,
                room: 'TABLE',
                limit: 50
              })
            )
            assert.deepEqual(afterChat, {
              ...beforeChat,
              entries: beforeChat.entries.map((entry) =>
                entry.authorUserId === fixture.subject.identity.userId
                  ? { ...entry, authorUsername: deletedCampaignAuthorLabel }
                  : entry
              )
            })
            assert.deepEqual(
              await fixture.auditor.client.query(api.campaigns.sessions.get, {
                campaignId: fixture.ids.sharedCampaignId,
                sessionNumber: fixture.ids.sessionNumber
              }),
              historicalSession
            )
            // Runs are Campaign-owned (ADR 0033), so a finished Session does not freeze one: the
            // open Run stays and only the deleted account's Character actor leaves it. The room
            // holds the Run and removes that actor itself (D74); the barrier publishes the room's
            // committed state so Convex reflects the removal (D90).
            const beforeRun = encounterGmProjectionDtoSchema.parse(historicalRun)
            const { awaitCampaignCheckpoint } = await import('./developmentCheckpoint')
            await awaitCampaignCheckpoint(fixture.auditor.client, fixture.ids.sharedCampaignId)
            const afterRun = encounterGmProjectionDtoSchema.parse(
              await fixture.auditor.client.query(api.encounters.projectionReads.get, {
                encounterId: fixture.ids.runId
              })
            )
            assert.equal(afterRun.status, beforeRun.status)
            assert.deepEqual(
              afterRun.actors,
              beforeRun.actors.filter((actor) => actor.sourceId !== fixture.ids.characterId)
            )
            await assert.rejects(
              fixture.subject.client.query(api.account.identity, {}),
              /Unauthenticated/
            )
            deleted = current
            removeDeletedSubjectFromCleanup()
            return
          }
          assert.ok(deleted)
          for (const scope of ['IDENTITY', 'CHARACTERS', 'AUTHORED'] as const)
            assert.deepEqual(current[scope], deleted[scope])
          if (stage === 'RELOAD_DENIED') {
            let previous = current
            let stable = false
            for (let pass = 0; pass < 20; pass += 1) {
              let finalState = true
              try {
                assertFinalDeferredCleanup(previous)
              } catch {
                finalState = false
              }
              await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
              const next = await captureDeletionState()
              if (finalState && JSON.stringify(next) === JSON.stringify(previous)) {
                assertFinalDeferredCleanup(next)
                previous = next
                stable = true
                break
              }
              previous = next
            }
            assert.equal(stable, true, 'Deferred account cleanup did not converge.')
            assertFinalDeferredCleanup(previous)
          }
        }
      })
    } catch (error) {
      journeyError = error
    }

    const branchCleanupErrors: unknown[] = []
    try {
      const subjectAuthUser = await cli('adapter:findOne', {
        model: 'user',
        where: [{ field: 'email', value: fixture.subject.email }],
        select: ['_id', 'email']
      })
      if (subjectAuthUser === null) removeDeletedSubjectFromCleanup()
      const owners = [
        ...(subjectAuthUser === null
          ? []
          : [
              {
                author: fixture.subject,
                campaignNames: new Set([
                  'F12 subject-owned archived Campaign',
                  'F12 subject-owned active Campaign'
                ])
              }
            ]),
        {
          author: fixture.auditor,
          campaignNames: new Set(['F12 auditor-owned shared Campaign'])
        }
      ]
      for (const { author, campaignNames } of owners) {
        const campaigns = await author.client.query(api.campaigns.queries.list, {
          paginationOpts: { cursor: null, numItems: 8 }
        })
        assert.equal(campaigns.isDone, true)
        for (const campaign of campaigns.page.filter(({ name }) => campaignNames.has(name))) {
          assert.deepEqual(
            await author.client.mutation(api.campaigns.deletion.remove, {
              campaignId: campaign.id,
              expectedVersion: campaign.version,
              confirmation: 'DELETE'
            }),
            { ok: true }
          )
          // Account deletion refuses while an owned Campaign's deletion job is still running.
          await waitForCampaignDeletion(author.client, campaign.id, 'Account deletion')
        }
      }
    } catch (error) {
      branchCleanupErrors.push(error)
    }
    if (journeyError || branchCleanupErrors.length)
      throw new AggregateError(
        [...(journeyError ? [journeyError] : []), ...branchCleanupErrors],
        'F12 account-deletion journey or fixture cleanup failed.'
      )
  } else if (process.argv.includes('--recovery-browser')) {
    const author = await createAuthor()
    const other = await createAuthor()
    const unknownEmail = `unknown-${author.email}`
    recoveryFixtures.push(author.email, unknownEmail)
    const code = '654321'
    const replacementPassword = `Recovered_8${randomBytes(24).toString('base64url')}!`
    await cli('adapter:create', {
      input: {
        model: 'verification',
        data: {
          identifier: `forget-password-otp-${author.email}`,
          value: `${createHash('sha256').update(code).digest('base64url')}:0`,
          expiresAt: Date.now() + 15 * 60_000,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      }
    })
    const { verifyPasswordRecoveryBrowser } =
      await import('../../web/tests/live-backend/passwordRecovery')
    await verifyPasswordRecoveryBrowser({
      email: author.email,
      unknownEmail,
      password: author.password,
      replacementPassword,
      code,
      screenshotDirectory: fileURLToPath(
        new URL(
          '../../../local-validation/local-convex-proofs/phase82-auth-closure/',
          import.meta.url
        )
      ),
      verifySessions: async () => {
        await assert.rejects(author.client.query(api.account.identity, {}), /Unauthenticated/)
        assert.equal(
          (await other.client.query(api.account.identity, {})).userId,
          other.identity.userId
        )
        assert.equal(
          (
            await auth('/sign-in/email', {
              email: author.email,
              password: author.password
            })
          ).status,
          401
        )
        assert.equal(
          (
            await auth('/email-otp/reset-password', {
              email: author.email,
              otp: code,
              password: replacementPassword
            })
          ).status,
          400
        )
        assert.equal(
          await cli('adapter:findOne', {
            model: 'verification',
            where: [
              {
                field: 'identifier',
                value: `forget-password-otp-${author.email}`
              }
            ],
            select: ['_id']
          }),
          null
        )
      }
    })
    // The reset revoked the author's session (verifySessions), so cleanup must not sign it in again.
    const recovered = accounts.find((fixture) => fixture.email === author.email)
    if (recovered) delete recovered.session
  } else if (
    process.argv.includes('--auth-browser') ||
    process.argv.includes('--profile-browser')
  ) {
    const author = await createAuthor()
    const other = process.argv.includes('--profile-browser') ? await createAuthor() : null
    const profileUsername = author.username.replace('Draft_', 'Reader_')
    const profileBio = 'Private profile proof for the first account.'
    const socialBaseline = other
      ? await author.client.mutation(api.social.profiles.initialize, {})
      : null
    const profile = other
      ? {
          username: profileUsername,
          bio: profileBio,
          other: {
            username: other.username,
            password: other.password,
            bio: 'Separate private profile for the second account.'
          },
          screenshotDirectory: fileURLToPath(
            new URL(
              '../../../local-validation/local-convex-proofs/phase82-foundation/',
              import.meta.url
            )
          ),
          // What the second account reads natively while the first holds `visibility`.
          verifyVisibility: async (visibility: 'Private' | 'Public') => {
            const viewed = await other.client.query(api.account.publicProfile, {
              username: profileUsername.toLowerCase()
            })
            if (visibility === 'Private') assert.equal(viewed, null)
            else
              assert.deepEqual(viewed, {
                username: profileUsername.toUpperCase(),
                bio: profileBio,
                avatarRevision: null
              })
            assert.equal(
              (await author.client.query(api.account.profile, {})).visibility,
              visibility.toUpperCase()
            )
            // Social eligibility and its minimal identity do not move with profile visibility.
            assert.deepEqual(
              await author.client.query(api.social.profiles.getEligibility, {}),
              socialBaseline
            )
          }
        }
      : undefined
    if (other && profile) {
      await other.client.mutation(api.account.updateProfile, {
        bio: profile.other.bio
      })
    }
    if (process.argv.includes('--avatar')) {
      const { default: sharp } = await import('sharp')
      const image = await sharp({
        create: { width: 64, height: 64, channels: 3, background: '#ac4f29' }
      })
        .png()
        .toBuffer()
      const intent = await author.client.mutation(api.media.assets.createAvatarUpload, {
        originalFileName: 'development-avatar.png',
        declaredMimeType: 'image/png',
        declaredBytes: image.byteLength,
        idempotencyKey: crypto.randomUUID()
      })
      assert.ok(
        new URL(intent.url).searchParams.get('X-Amz-SignedHeaders')?.includes('content-length')
      )
      const oversized = await fetch(intent.url, {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: new Uint8Array(image.byteLength + 1)
      })
      await oversized.body?.cancel()
      assert.equal(oversized.status, 403, 'R2 must reject a body larger than its signed size.')
      const uploaded = await fetch(intent.url, {
        method: 'PUT',
        headers: { 'content-type': 'image/png' },
        body: new Uint8Array(image)
      })
      await uploaded.body?.cancel()
      assert.equal(uploaded.status, 200)
      const save = {
        assetId: intent.assetId,
        crop: { x: 0, y: 0, width: 1, height: 1 }
      }
      const binding = await author.client.action(api.media.avatarActions.saveAvatar, save)
      assert.equal(binding.assetId, intent.assetId)
      assert.deepEqual(
        await author.client.action(api.media.avatarActions.saveAvatar, save),
        binding
      )
      const delivery = await author.client.action(api.media.avatarActions.getAvatarImage, {
        variantKind: 'THUMBNAIL'
      })
      assert.ok(delivery)
      const delivered = await fetch(delivery.url)
      assert.equal(delivered.status, 200)
      const result = await sharp(Buffer.from(await delivered.arrayBuffer())).metadata()
      assert.equal(result.format, 'webp')
      assert.equal(result.width, 64)
      console.log(
        'R2 signed-size rejection, upload, Node processing, replay and private delivery passed.'
      )
    }
    const { verifyAuthenticatedBrowserSession } =
      await import('../../web/tests/live-backend/authenticatedSession')
    await verifyAuthenticatedBrowserSession({
      email: author.email,
      password: author.password,
      profile,
      verifyBearer: async (jwt) => {
        const bearerClient = (token: string) => {
          const client = new DevelopmentHttpClient(deploymentUrl.origin, { logger: false })
          client.setAuth(token)
          return client
        }
        assert.equal(
          (await bearerClient(jwt).query(api.account.identity, {})).userId,
          author.identity.userId
        )
        const [header, payload, signature] = jwt.split('.')
        const forged = `${header}.${payload}.${[...signature!].reverse().join('')}`
        assert.notEqual(forged, jwt)
        await assert.rejects(
          bearerClient(forged).query(api.account.identity, {}),
          /InvalidAuthHeader/
        )
        await assert.rejects(publicClient.query(api.account.identity, {}), /Unauthenticated/)
      },
      verifyRevoked: async (jwt) => {
        const browserClient = new DevelopmentHttpClient(deploymentUrl.origin, {
          logger: false
        })
        browserClient.setAuth(jwt)
        await assert.rejects(browserClient.query(api.account.identity, {}), /Unauthenticated/)
      }
    })
    if (other && profile) {
      await assert.rejects(publicClient.query(api.account.profile, {}), /Unauthenticated/)
      await assert.rejects(
        author.client.query(api.account.profile, {
          // @ts-expect-error Verify a non-TypeScript caller cannot select another profile.
          userId: other.identity.userId
        }),
        /validator|extra field/i
      )
      const spoofed = {
        userId: other.identity.userId,
        bio: 'Must not overwrite another account.'
      }
      await assert.rejects(
        author.client.mutation(api.account.updateProfile, spoofed),
        /validator|extra field/i
      )
      assert.deepEqual(await author.client.query(api.account.profile, {}), {
        username: profile.username.toUpperCase(),
        bio: profile.bio,
        visibility: 'PRIVATE'
      })
      assert.deepEqual(await other.client.query(api.account.profile, {}), {
        username: profile.other.username,
        bio: profile.other.bio,
        visibility: 'PRIVATE'
      })
      console.log(
        'Profile privacy, server state, anonymous denial and owner-argument rejection passed.'
      )
    }
  } else if (process.argv.includes('--signed-in-request-audit')) {
    assert.equal(mode, 'local', 'The request audit reads the verified local backend log.')
    const adminKey = process.env.CONVEX_SELF_HOSTED_ADMIN_KEY
    assert.ok(adminKey, 'Local fixture CLI credentials are required.')
    const author = await createAuthor()
    const { verifySignedInRequestAudit } =
      await import('../../web/tests/live-backend/signedInRequestAudit')
    await verifySignedInRequestAudit({
      email: author.email,
      password: author.password,
      systemId: srdSystemRecord.id,
      readFunctionLog: async (cursor) => {
        const response = await fetch(
          new URL(`/api/stream_function_logs?cursor=${cursor}`, deploymentUrl.origin),
          { headers: { Authorization: `Convex ${adminKey}` } }
        )
        assert.equal(response.status, 200)
        return response.json()
      },
      callMarker: () => author.client.query(api.account.identity, {})
    })
  } else if (process.argv.includes('--authoring-resolver')) {
    const author = await createAuthor()
    const input = {
      mapId: 'proficiencyGrant',
      systemId: srdSystemRecord.id,
      values: {
        proficiencyKind: 'SKILL',
        selectionKind: 'GRANTED',
        authoringModeKind: 'SELECTED',
        level: 'FULL'
      }
    }
    await assert.rejects(
      publicClient.query(api.authoring.nodeRuntime.resolve, input),
      /Unauthenticated/
    )
    const result = expandNodeRuntimeResponse(
      await author.client.query(api.authoring.nodeRuntime.resolve, input)
    )
    const nodes = result.steps.flatMap((step) => step.sections.flatMap((section) => section.nodes))
    const skills = nodes.find((node) => node.id === 'skillIds')
    assert.ok(skills && 'options' in skills)
    assert.deepEqual(
      skills.options?.map((option) => ({
        value: option.value,
        label: option.label
      })),
      srdSystemRecord.skills.map((skill) => ({
        value: skill.id,
        label: skill.label
      }))
    )
    const normalized = await author.client.query(api.authoring.nodeRuntime.normalizeValues, {
      ...input,
      values: {
        ...input.values,
        skillIds: [srdSystemRecord.skills[0].id, 'invalid']
      }
    })
    assert.deepEqual(record(normalized.values).skillIds, [srdSystemRecord.skills[0].id])
    const nested = expandNodeRuntimeResponse(
      await author.client.query(api.authoring.nodeRuntime.resolve, {
        mapId: 'background',
        systemId: srdSystemRecord.id,
        values: {
          label: 'Development resolver proof',
          proficiencies: [input.values]
        }
      })
    )
    assert.ok(
      nested.scopes.some(
        (scope) =>
          scope.mapId === 'proficiencyGrant' && JSON.stringify(scope.path) === '["proficiencies",0]'
      )
    )
    const background = srdBaselineContent.subjects.backgrounds[0]
    const backgroundInput = {
      mapId: 'background',
      systemId: background.systemId,
      values: JSON.parse(JSON.stringify(background))
    }
    const started = performance.now()
    const complete = expandNodeRuntimeResponse(
      await author.client.query(api.authoring.nodeRuntime.resolve, backgroundInput)
    )
    const resolvedMs = Math.round(performance.now() - started)
    const normalizedBackground = await author.client.query(
      api.authoring.nodeRuntime.normalizeValues,
      backgroundInput
    )
    assert.deepEqual(
      record(normalizedBackground.values).startingEquipment,
      background.startingEquipment
    )
    const equipmentScope = complete.scopes.find((scope) => scope.mapId === 'startingEquipmentItem')
    assert.ok(equipmentScope, 'The full canonical Background must resolve its nested equipment.')
    const equipmentNode = equipmentScope.steps
      .flatMap((step) => step.sections.flatMap((section) => section.nodes))
      .find((node) => node.id === 'equipmentIds')
    assert.ok(equipmentNode && 'options' in equipmentNode && equipmentNode.options?.length)
    const spell = srdBaselineContent.subjects.spells[0]
    const characterClass = srdBaselineContent.subjects.classes[0]
    const nestedInput = {
      mapId: 'background',
      systemId: srdSystemRecord.id,
      values: {
        features: [
          {
            id: crypto.randomUUID(),
            label: 'Spell training',
            order: 0,
            grants: {
              spells: [
                {
                  id: crypto.randomUUID(),
                  grantKind: 'SPELL_GRANT',
                  order: 0,
                  selectionKind: 'GRANTED',
                  scalingKind: 'PER_LEVEL',
                  progression: {
                    scalingSource: 'CLASS_LEVEL',
                    classId: characterClass.id,
                    levels: [
                      {
                        id: crypto.randomUUID(),
                        level: 1,
                        order: 0,
                        authoringModeKind: 'SELECTED',
                        spellIds: [spell.id, 'invalid']
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      }
    }
    const authoredChoices = expandNodeRuntimeResponse(
      await author.client.query(api.authoring.nodeRuntime.resolve, nestedInput)
    )
    for (const [mapId, nodeId, expected] of [
      ['spellGrantProgression', 'classId', characterClass],
      ['spellGrantLevel', 'spellIds', spell]
    ] as const) {
      const scope = authoredChoices.scopes.find((scope) => scope.mapId === mapId)
      const node = scope?.steps
        .flatMap((step) => step.sections.flatMap((section) => section.nodes))
        .find((node) => node.id === nodeId)
      assert.ok(node && 'options' in node, `Missing ${mapId}.${nodeId}`)
      assert.ok(
        node.options?.some(
          (option) => option.value === expected.id && option.label === expected.label
        ),
        `Expected canonical ${expected.id} in ${mapId}.${nodeId}`
      )
    }
    const normalizedAuthored = await author.client.query(
      api.authoring.nodeRuntime.normalizeValues,
      nestedInput
    )
    const normalizedFeatures = record(normalizedAuthored.values).features
    assert.ok(Array.isArray(normalizedFeatures))
    const spellGrants = record(record(normalizedFeatures[0]).grants).spells
    assert.ok(Array.isArray(spellGrants))
    const progression = record(record(spellGrants[0]).progression)
    assert.equal(progression.classId, characterClass.id)
    assert.ok(Array.isArray(progression.levels))
    assert.deepEqual(record(progression.levels[0]).spellIds, [spell.id])
    console.log(
      JSON.stringify({
        background: background.label,
        resolvedMs,
        scopes: complete.scopes.length,
        equipmentOptions: equipmentNode.options.length
      })
    )
    console.log(
      'Native authoring auth denial, exact SRD choices, normalization, Background equipment and nested spell/class paths passed.'
    )
  } else {
    const groups: Array<{
      subjectKind: AuthoredSubjectKind
      sources: readonly { id: string; label: string; systemId: string }[]
    }> = [
      {
        subjectKind: 'BACKGROUND',
        sources: srdBaselineContent.subjects.backgrounds
      },
      { subjectKind: 'CLASS', sources: srdBaselineContent.subjects.classes },
      {
        subjectKind: 'CREATURE',
        sources: srdBaselineContent.subjects.creatures
      },
      {
        subjectKind: 'EQUIPMENT',
        sources: srdBaselineContent.subjects.equipment
      },
      { subjectKind: 'FEAT', sources: srdBaselineContent.subjects.feats },
      { subjectKind: 'RACE', sources: srdBaselineContent.subjects.races },
      { subjectKind: 'SPELL', sources: srdBaselineContent.subjects.spells },
      { subjectKind: 'VEHICLE', sources: srdBaselineContent.subjects.vehicles }
    ]
    const draftRecoveryOnly = process.argv.includes('--draft-recovery')
    const examples = (draftRecoveryOnly ? groups.slice(0, 1) : groups).map(
      ({ subjectKind, sources }) => {
        assert.ok(sources.length, `Missing canonical ${subjectKind} examples.`)
        return {
          subjectKind,
          source: sources.reduce((current, item) => (depth(item) > depth(current) ? item : current))
        }
      }
    )
    if (!draftRecoveryOnly) {
      assert.ok(
        examples.some(({ source }) => depth(source) > 16),
        'Include an actual deeply nested canonical record.'
      )
    }
    const first = await createAuthor()
    const second = await createAuthor()

    for (const { source, subjectKind } of examples) {
      const master = { subjectKind, subjectId: source.id }
      const responseSchema = authoredDetailResponseSchemas[subjectKind]
      const publicDetail = responseSchema.parse(
        await publicClient.query(api.content.details.get, {
          subjectKind,
          id: source.id.toUpperCase(),
          meta: Object.keys(responseSchema._zod.def.innerType.shape.meta._zod.def.innerType.shape)
        })
      )
      assert.ok(publicDetail?.item)
      assert.deepEqual(publicDetail.item, JSON.parse(JSON.stringify(source)))
      assert.equal(publicDetail.permissions.canCopy, false)
      assert.equal(
        (
          await publicClient.query(api.content.details.get, {
            subjectKind,
            id: publicDetail.publicId
          })
        )?.item?.id,
        source.id
      )
      await assert.rejects(
        publicClient.mutation(api.content.drafts.duplicate, master),
        /Unauthenticated/
      )
      const copied = authoredDraftDtoSchema.parse(
        await first.client.mutation(api.content.drafts.duplicate, master)
      )
      const lookup = { subjectKind, subjectId: copied.subjectId }
      drafts.push({ client: first.client, ...lookup })
      assert.notEqual(copied.subjectId, source.id)
      assert.equal(copied.userId, first.identity.userId)
      assert.equal(copied.systemId, source.systemId)
      assert.equal(depth(copied.payload), depth(source))
      const listInput = {
        subjectKind,
        paginationOpts: { cursor: null, numItems: 1 }
      }
      await assert.rejects(
        publicClient.query(api.content.drafts.list, listInput),
        /Unauthenticated/
      )
      const firstPage = authoredDraftListPageSchema.parse(
        await first.client.query(api.content.drafts.list, listInput)
      )
      const { payload: _payload, ...expectedSummary } = copied
      assert.deepEqual(firstPage.page, [expectedSummary])
      assert.deepEqual((await second.client.query(api.content.drafts.list, listInput)).page, [])
      if (draftRecoveryOnly) {
        const extra = await first.client.mutation(api.content.drafts.duplicate, master)
        const extraLookup = { subjectKind, subjectId: extra.subjectId }
        drafts.push({ client: first.client, ...extraLookup })
        const head = await first.client.query(api.content.drafts.list, listInput)
        assert.equal(head.page.length, 1)
        assert.equal(head.isDone, false)
        const tail = await first.client.query(api.content.drafts.list, {
          ...listInput,
          paginationOpts: { numItems: 1, cursor: head.continueCursor }
        })
        assert.deepEqual(
          [...head.page, ...tail.page].map((draft) => draft.subjectId).sort(),
          [copied.subjectId, extra.subjectId].sort()
        )
        await first.client.mutation(api.content.drafts.discard, extraLookup)
      }
      const detailLookup = {
        subjectKind,
        id: copied.publicId,
        view: 'draft' as const
      }
      const copiedDetail = responseSchema.parse(
        await first.client.query(api.content.details.get, detailLookup)
      )
      assert.deepEqual(copiedDetail?.draft, copied)
      assert.deepEqual(
        copiedDetail?.item,
        responseSchema._zod.def.innerType.shape.item.parse(copied.payload)
      )
      assert.equal(await publicClient.query(api.content.details.get, detailLookup), null)
      assert.equal(await second.client.query(api.content.details.get, detailLookup), null)
      assert.equal(
        await first.client.query(api.content.details.get, {
          ...detailLookup,
          view: 'active'
        }),
        null
      )
      assert.deepEqual(await first.client.query(api.content.drafts.get, lookup), copied)
      assert.equal(await second.client.query(api.content.drafts.get, lookup), null)
      await assert.rejects(
        second.client.mutation(api.content.drafts.discard, lookup),
        /Draft not found/
      )
      const command = {
        ...lookup,
        systemId: copied.systemId,
        label: `${copied.label} verified`,
        payload: {
          ...copied.payload,
          userId: second.identity.userId,
          status: 'ACTIVE'
        }
      }
      await assert.rejects(
        second.client.mutation(api.content.drafts.save, command),
        /cannot be edited/
      )
      await assert.rejects(
        first.client.mutation(api.content.drafts.save, {
          ...command,
          subjectId: source.id
        }),
        /cannot be edited/
      )
      const saved = authoredDraftDtoSchema.parse(
        await first.client.mutation(api.content.drafts.save, command)
      )
      assert.equal(saved.publicId, copied.publicId)
      assert.equal(saved.payload.userId, first.identity.userId)
      assert.equal(saved.payload.status, 'DRAFT')
      assert.equal(saved.label, command.label)
      assert.deepEqual(saved.payload, {
        ...copied.payload,
        label: command.label
      })
      assert.deepEqual(await first.client.query(api.content.drafts.get, lookup), saved)
      assert.equal(
        (await first.client.query(api.content.drafts.list, listInput)).page[0]?.label,
        command.label
      )
      if (subjectKind === 'BACKGROUND') {
        const invalid = await first.client.mutation(api.content.drafts.save, {
          ...command,
          payload: { features: 'unfinished' }
        })
        const recovery = await first.client.query(api.content.details.get, detailLookup)
        assert.equal(recovery?.item, null)
        assert.deepEqual(recovery?.draft, invalid)
        assert.ok(recovery?.validationIssues?.some((issue) => issue.path[0] === 'features'))
      }
      await first.client.mutation(api.content.drafts.discard, lookup)
      assert.equal(await first.client.query(api.content.drafts.get, lookup), null)
      assert.deepEqual((await first.client.query(api.content.drafts.list, listInput)).page, [])
      console.log(
        JSON.stringify({
          subjectKind,
          sourceLabel: source.label,
          sourceDepth: depth(source),
          payloadBytes: Buffer.byteLength(JSON.stringify(saved.payload)),
          roundTrip: 'PASS',
          nativeDetail: 'PASS',
          nativeDraftRecovery: 'PASS',
          foreignDenial: 'PASS',
          masterEditDenial: 'PASS',
          discard: 'PASS'
        })
      )
    }
    assert.equal(
      (await publicClient.query(api.application.featureFlags, {})).publicSignUpEnabled,
      false
    )
    console.log(
      JSON.stringify({
        target: { mode, selector },
        nativeAuthentication: 'PASS',
        closedSignupUnchanged: 'PASS'
      })
    )
  }
} catch (error) {
  // Preserve the check's failure even if cleanup also fails. No auth response is logged.
  proofErrors.push(error)
  console.error(error instanceof Error ? error.message.slice(0, 3000) : 'Draft check failed.')
}
if (retainVttFixtureAfterFailure) {
  console.error('Retained the private VTT diagnostic fixture for a section resume.')
} else {
  try {
    await cleanup()
    if (vttCheckpointMode) await rm(vttCheckpointPath, { force: true })
  } catch (error) {
    throw new AggregateError(
      [...proofErrors, error],
      'Development proof fixture cleanup incomplete.'
    )
  }
}
if (proofErrors.length) throw proofErrors[0]
