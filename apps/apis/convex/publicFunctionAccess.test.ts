// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { convexTest } from '../tests/convexTest'
import authSchema from './betterAuth/schema'
import http from './http'
import schema from './schema'

/**
 * Who may call each public function (PLATFORM-27; inventory and evidence in
 * docs/validation/platform-27-t1-authorization-sweep-2026-11-03.md). Every rule but `public` and
 * `development` reads the caller from `ctx.auth` (`requireIdentity`/`getAuthenticatedProfile`, which
 * also refuse banned accounts):
 * - `self`: reads or writes only the caller's own records, keyed by that identity.
 * - `owner`: the caller must own the record a client-supplied id names.
 * - `member`: active Campaign membership (`requireCampaignAuthority`), plus any narrower
 *   assignment, visibility or authorship check.
 * - `gm`: the Campaign's owner role.
 * - `superadmin`: `requireSuperadmin`.
 * - `signedIn`: any signed-in caller, filtered by the target's own visibility rules.
 * - `public`: signed-out callers allowed, for the reviewed reason given.
 * - `development`: refused outside the local fixture deployment, for the reason given.
 */
type Access =
  | 'self'
  | 'owner'
  | 'member'
  | 'gm'
  | 'superadmin'
  | 'signedIn'
  | { public: string }
  | { development: string }

const fixtureOnly = {
  development:
    'requireFixtureAccount: a localhost SITE_URL and a draft_<hex>@example.invalid fixture account'
}
const platformArt = {
  public: 'Platform (SRD) content art is public reference; draft art requires the draft owner'
}
const platformSystems = {
  public:
    'The systems table holds only platform Systems written by the internal import; user-authored Systems are deferred'
}

const ACCESS: Record<string, Record<string, Access>> = {
  account: {
    identity: 'self',
    profile: 'self',
    publicProfile: 'signedIn',
    rollPreferences: 'self',
    session: { public: 'Session bootstrap: signed-out and banned callers get user null' },
    setAuthoringExperience: 'self',
    setAutoRollDice: 'self',
    setGmRollVisibility: 'self',
    setProfileVisibility: 'self',
    updateProfile: 'self'
  },
  accountEntitlements: { get: 'self' },
  application: {
    featureFlags: { public: 'Deployment feature flags the sign-up page reads before sign-in' }
  },
  'authoring/nodeRuntime': { normalizeValues: 'self', resolve: 'self' },
  'campaigns/announcements': { create: 'gm', get: 'member', list: 'member' },
  'campaigns/archive': { archive: 'gm' },
  'campaigns/assignments': { assign: 'member', unassign: 'member' },
  'campaigns/characterControllers': { setControllers: 'gm' },
  'campaigns/characterSheet': {
    basics: 'member',
    execute: 'member',
    executeRoll: 'member',
    get: 'member',
    panel: 'member',
    preparationOptions: 'member',
    restPreview: 'member'
  },
  'campaigns/chat': { edit: 'member', list: 'member', send: 'member', unsend: 'member' },
  'campaigns/clock': {
    advance: 'gm',
    configure: 'gm',
    dismissRecoveryPrompt: 'gm',
    get: 'member',
    initialize: 'gm',
    pause: 'gm',
    reconcile: 'gm',
    recoveryPrompts: 'gm',
    reset: 'gm',
    rewind: 'gm',
    start: 'gm'
  },
  'campaigns/contentShares': { list: 'member', share: 'member', unshare: 'member' },
  'campaigns/conversations': { list: 'member', markRead: 'member', open: 'member' },
  'campaigns/copy': { copy: 'gm' },
  'campaigns/copyJobs': { begin: 'gm', cancel: 'owner', list: 'self', progress: 'owner' },
  'campaigns/create': { create: 'self' },
  'campaigns/currencySystems': { list: 'member', remove: 'gm', save: 'gm' },
  'campaigns/deletion': { remove: 'gm', status: 'owner' },
  'campaigns/developmentLifecycle': { verifyDeletionRollback: fixtureOnly },
  'campaigns/events': { list: 'member' },
  'campaigns/gmReads': { adjustments: 'member', conditions: 'member' },
  'campaigns/gmWrites': {
    deleteAdjustment: 'gm',
    deleteCondition: 'gm',
    saveAdjustment: 'gm',
    saveCondition: 'gm'
  },
  'campaigns/inventoryAudit': { list: 'gm' },
  'campaigns/inventoryCleanup': { pending: 'member', retry: 'gm' },
  'campaigns/inventoryOwners': { transferVersions: 'member', version: 'member' },
  'campaigns/inventoryTransfers': { transfer: 'member' },
  'campaigns/membershipDeparture': { leave: 'member', removeMember: 'gm' },
  'campaigns/notebooks': { create: 'member', list: 'member', remove: 'member', update: 'member' },
  'campaigns/ownership': { accept: 'member', request: 'gm' },
  'campaigns/partyInventory': { currencies: 'member', equipmentOptions: 'member', items: 'member' },
  'campaigns/partyInventoryCommands': { mutate: 'gm' },
  'campaigns/playSettings': { get: 'member', options: 'member', save: 'gm' },
  'campaigns/queries': {
    contentUsage: 'gm',
    get: 'member',
    list: 'self',
    liveAuthority: 'member',
    settings: 'gm'
  },
  'campaigns/rolls': { execute: 'member', executePrivate: 'gm', reveal: 'gm' },
  'campaigns/sessionAttendance': { list: 'member', set: 'gm' },
  'campaigns/sessionFinish': { finish: 'gm' },
  'campaigns/sessionNotes': {
    create: 'member',
    list: 'member',
    remove: 'member',
    update: 'member'
  },
  'campaigns/sessionReferences': { create: 'gm', list: 'gm', remove: 'gm' },
  'campaigns/sessionRsvps': { list: 'member', set: 'member' },
  'campaigns/sessions': {
    create: 'gm',
    get: 'member',
    latestOpen: 'member',
    list: 'member',
    update: 'gm'
  },
  'campaigns/update': { update: 'gm' },
  'campaigns/vehicleInventory': { currencies: 'member', items: 'member' },
  'campaigns/vehicles': {
    create: 'gm',
    definitionOptions: 'member',
    lifecycle: 'gm',
    list: 'member',
    remove: 'gm',
    update: 'gm'
  },
  'characters/builder': { activeCharacter: 'owner' },
  'characters/commit': { commit: 'owner' },
  'characters/drafts': {
    create: 'self',
    discard: 'owner',
    get: 'owner',
    list: 'self',
    save: 'owner'
  },
  'characters/equipmentOptions': { list: 'owner' },
  'characters/extraOptions': { list: 'owner' },
  'characters/list': { list: 'self' },
  'characters/panels': { get: 'owner' },
  'characters/preparationOptions': { get: 'owner' },
  'characters/rest': { preview: 'owner' },
  'characters/sheet': { get: 'owner' },
  'characters/sheetCommands': { execute: 'owner' },
  'characters/sheetSlices': {
    concentrationRoomRoute: 'owner',
    get: 'owner',
    liveAuthority: 'owner'
  },
  'content/catalogue': {
    counts: {
      public:
        'Platform (SRD) catalogue counts are public reference; owned content counts only for the signed-in owner'
    }
  },
  'content/classPublicationActions': { publishDraft: 'owner' },
  'content/definitions': {
    create: 'self',
    get: 'owner',
    list: 'self',
    publish: 'owner',
    saveDraft: 'owner'
  },
  'content/deletion': { deleteActive: 'owner' },
  'content/details': {
    get: {
      public:
        'Platform (SRD) detail pages are public reference; owned roots and drafts require the owner'
    }
  },
  'content/drafts': {
    discard: 'owner',
    duplicate: 'owner',
    get: 'owner',
    list: 'self',
    save: 'owner'
  },
  'content/equipmentOptions': { list: 'self' },
  'content/exports': { get: 'owner' },
  'content/publication': { publishDraft: 'owner' },
  'content/systems': {
    capability: 'self',
    get: platformSystems,
    list: platformSystems,
    summary: platformSystems
  },
  'contentSnapshots/access': { issueAccess: 'self' },
  'contentSnapshots/manifest': { catalogue: 'self', manifest: 'self' },
  'encounters/actionChoices': { get: 'member', items: 'member', optional: 'member' },
  'encounters/actionTargetModifiers': { get: 'member' },
  'encounters/activeReads': { active: 'member', decisionSettlement: 'member' },
  'encounters/actorTokenBindings': { execute: 'gm' },
  'encounters/blueprints': { create: 'self', list: 'self', update: 'owner' },
  'encounters/developmentLifecycle': { verifyRollback: fixtureOnly },
  'encounters/healthDisplay': { share: 'gm' },
  'encounters/pendingReads': { pendingRuleOccurrence: 'member' },
  'encounters/projectionReads': {
    actorSides: 'gm',
    get: 'member',
    list: 'member',
    pendingPrepared: 'member'
  },
  'encounters/runs': { create: 'gm', deletePrepared: 'gm' },
  'encounters/sceneBindings': { get: 'member' },
  'imports/jobs': { begin: 'self', cancel: 'owner', list: 'self', progress: 'owner' },
  'imports/preview': { create: 'self' },
  'imports/uploads': { create: 'self', finalize: 'owner' },
  'liveSessions/developmentMeasurement': {
    checkpointDocumentSizes: fixtureOnly,
    closeWindow: fixtureOnly,
    openWindow: fixtureOnly
  },
  'liveSessions/tickets': { issue: 'member' },
  'loot/tables': { get: 'gm', live: 'gm', save: 'gm' },
  'media/assets': { avatar: 'self', createAvatarUpload: 'self', removeAvatar: 'self' },
  'media/authoredActions': { getImage: platformArt, save: 'owner' },
  'media/authoredAssets': { binding: platformArt, createUpload: 'owner', remove: 'owner' },
  'media/avatarActions': {
    getAvatarImage: 'self',
    getProfileAvatarImage: 'signedIn',
    saveAvatar: 'self'
  },
  'media/characterPortraitActions': { getImage: 'owner', save: 'owner' },
  'media/characterPortraitAssets': {
    bindingForCharacter: 'owner',
    createUpload: 'owner',
    remove: 'owner'
  },
  'media/library': { attachImage: 'owner', list: 'self' },
  'media/libraryActions': { getImage: 'owner' },
  'media/vttMapActions': { finalize: 'owner', getDelivery: 'member' },
  'media/vttMapAssets': { createUpload: 'gm' },
  notifications: {
    feed: 'self',
    markAllSeen: 'self',
    markRead: 'owner',
    preferences: 'self',
    updatePreferences: 'self'
  },
  rolls: {
    addAfterRollDie: 'self',
    clearHistory: 'self',
    declineAfterRollDice: 'self',
    discard: 'self',
    execute: 'owner',
    executeConfiguration: 'self',
    history: 'self'
  },
  'scenes/definitionReads': { entities: 'gm', get: 'gm', list: 'gm', listLive: 'gm' },
  'scenes/definitions': { append: 'gm', begin: 'gm', publish: 'gm', remove: 'gm' },
  'scenes/fogReads': { chunks: 'member', layers: 'member' },
  'scenes/liveReads': { entities: 'gm', header: 'gm' },
  'scenes/presentations': { get: 'member', set: 'gm', setLive: 'gm' },
  'scenes/recipientActions': { encounterBindings: 'member', entities: 'member' },
  'scenes/recipientReads': { header: 'member' },
  'scenes/showings': { current: 'member', show: 'gm', stop: 'gm' },
  'social/admissionLists': {
    listListingApplications: 'owner',
    listListingInvitations: 'owner',
    listOwnApplications: 'self',
    listReceivedInvitations: 'self'
  },
  'social/applications': {
    decide: 'owner',
    getOwn: 'owner',
    submit: 'signedIn',
    withdraw: 'owner'
  },
  'social/blockLists': { list: 'self' },
  'social/blocks': { create: 'self', getStatus: 'self', remove: 'self' },
  'social/discovery': { getListing: 'signedIn', getProfile: 'signedIn' },
  'social/discoveryLists': { browse: 'signedIn', search: 'signedIn' },
  'social/invitationReads': { getForListing: 'owner', getReceived: 'self' },
  'social/invitations': { accept: 'self', create: 'owner', decline: 'self', revoke: 'owner' },
  'social/listingDrafts': {
    create: 'owner',
    get: 'owner',
    list: 'self',
    remove: 'owner',
    update: 'owner'
  },
  'social/listingModeration': { action: 'superadmin' },
  'social/listings': {
    close: 'owner',
    getOwned: 'owner',
    listOwned: 'self',
    open: 'owner',
    update: 'owner'
  },
  'social/moderation': { list: 'superadmin', open: 'superadmin', review: 'superadmin' },
  'social/profileModeration': { action: 'superadmin' },
  'social/profiles': { getEligibility: 'self', initialize: 'self', updatePreference: 'self' },
  'social/reports': { create: 'signedIn' }
}

/**
 * Every argument naming a user, and why it is not the caller's identity. A public function reads
 * its caller only from `ctx.auth`.
 */
const USER_ID_ARGS: Record<string, Record<string, string>> = {
  'campaigns/characterControllers:setControllers': {
    controllerUserIds: 'Players the GM names as controllers; each must be an active PLAYER member'
  },
  'campaigns/chat:list': { directUserId: 'The direct-message peer; must be an active member' },
  'campaigns/chat:send': { directUserId: 'The direct-message peer; must be an active member' },
  'campaigns/conversations:open': {
    directUserId: 'The direct-message peer; must be an active member'
  },
  'campaigns/developmentLifecycle:verifyDeletionRollback': {
    ownerUserId: 'The fixture owner; must equal the caller',
    userIds: 'The fixture accounts the rollback checks'
  },
  'campaigns/membershipDeparture:removeMember': { userId: 'The member the GM removes' },
  'campaigns/ownership:request': {
    recipientUserId: 'The proposed new owner; must be an active PLAYER member'
  },
  'characters/commit:commit': { userId: 'Character payload field; replaced by the caller' },
  'characters/drafts:save': { userId: 'Character payload field; replaced by the caller' },
  'encounters/developmentLifecycle:verifyRollback': {
    ownerUserId: 'The fixture owner; must equal the caller'
  },
  'scenes/definitions:append': {
    controlledByUserIds: 'Scene entity controllers the GM authors'
  },
  'scenes/fogReads:chunks': {
    ownerUserId: 'The fog layer to read; a player may read only their own or the shared layer'
  }
}

type ConvexFunction = {
  isPublic?: boolean
  isQuery?: boolean
  isMutation?: boolean
  isAction?: boolean
  exportArgs: () => string
}

// The Better Auth component's functions are callable only by this app's own functions, not by clients.
const modules = import.meta.glob<Record<string, unknown>>([
  './**/*.ts',
  '!./**/*.*.ts',
  '!./_generated/**',
  '!./betterAuth/**',
  '!./schema.ts'
])

async function readPublicFunctions() {
  const functions = new Map<string, ConvexFunction>()
  for (const [path, load] of Object.entries(modules))
    for (const [name, value] of Object.entries(await load())) {
      const candidate = value as ConvexFunction
      if (
        typeof value === 'function' &&
        candidate.isPublic &&
        (candidate.isQuery || candidate.isMutation || candidate.isAction)
      )
        functions.set(`${path.slice(2, -3)}:${name}`, candidate)
    }
  return functions
}

const declared = Object.entries(ACCESS).flatMap(([module, rules]) =>
  Object.entries(rules).map(([name, access]) => ({ name: `${module}:${name}`, access }))
)

it('declares an access rule for every public function', { timeout: 300_000 }, async () => {
  const functions = await readPublicFunctions()

  expect(
    [...functions.keys()].filter((name) => !declared.some((rule) => rule.name === name))
  ).toEqual([])
  expect(declared.map(({ name }) => name).filter((name) => !functions.has(name))).toEqual([])
  expect(
    declared.filter(({ access }) => typeof access === 'object' && !Object.values(access)[0]?.trim())
  ).toEqual([])

  // Field names, at any depth, that name a user by id.
  const userIdArgs = [...functions].flatMap(([name, fn]) =>
    [
      ...new Set(
        [...fn.exportArgs().matchAll(/"(\w*[uU]serIds?)":\{"fieldType"/g)].map(([, key]) => key)
      )
    ].map((key) => `${name} ${key}`)
  )
  expect(userIdArgs.sort()).toEqual(
    Object.entries(USER_ID_ARGS)
      .flatMap(([name, args]) => Object.keys(args).map((key) => `${name} ${key}`))
      .sort()
  )
})

const workerSecret =
  'The live-session Worker secret (x-artificer-live-session-secret), then the room epoch fence'
const workerSecretAndUser = `${workerSecret} and the signed-in member's own JWT`
const betterAuth = 'Better Auth: sign-in, session and account routes, limited to SITE_URL origins'

/** Who may call each HTTP route. */
const HTTP_ROUTE_ACCESS: Record<string, string> = {
  'GET /.well-known/openid-configuration': betterAuth,
  'GET /api/auth/*': betterAuth,
  'POST /api/auth/*': betterAuth,
  'POST /live-sessions/activate': workerSecret,
  'POST /live-sessions/begin-drain': workerSecret,
  'POST /live-sessions/bootstrap': workerSecretAndUser,
  'POST /live-sessions/capture': workerSecretAndUser,
  'POST /live-sessions/checkpoint': workerSecret,
  'POST /live-sessions/present': workerSecret,
  'POST /live-sessions/recover-storage': workerSecret,
  'POST /live-sessions/release': workerSecret,
  'POST /live-sessions/room-authorization': workerSecret,
  'POST /live-sessions/room-inputs': workerSecret,
  'POST /live-sessions/room-scene-capture': workerSecret
}

it('declares an access rule for every HTTP route', () => {
  expect(
    http
      .getRoutes()
      .map(([path, method]) => `${method} ${path}`)
      .sort()
  ).toEqual(Object.keys(HTTP_ROUTE_ACCESS).sort())
})

afterEach(() => {
  vi.unstubAllEnvs()
})

it('refuses every live-session route without the Worker secret', async () => {
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', 'coverage-test-live-session-secret-32-bytes')
  const t = convexTest(schema, import.meta.glob('./**/*.*s'))
  t.registerComponent('betterAuth', authSchema, import.meta.glob('./betterAuth/**/*.*s'))
  const workerRoutes = Object.entries(HTTP_ROUTE_ACCESS).filter(([, access]) =>
    access.startsWith(workerSecret)
  )
  const statuses = await Promise.all(
    workerRoutes.map(async ([route]) => {
      const [method, path] = route.split(' ')
      const response = await t.fetch(path, { method, body: '{}' })
      return `${route} ${response.status}`
    })
  )
  expect(statuses).toEqual(workerRoutes.map(([route]) => `${route} 401`))
})
