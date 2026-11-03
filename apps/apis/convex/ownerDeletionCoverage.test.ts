// @vitest-environment node
import { describe, expect, it } from 'vitest'
import schema from './schema'

/**
 * PLATFORM-26.2: every table that records who created it needs an owner permanent-delete path
 * (an API mutation plus the UI action that calls it), a documented exemption, or a pending ruling.
 * A new owner-created kind therefore cannot ship without delete.
 */
const OWNER_FIELDS = [
  'ownerUserId',
  'authorUserId',
  'creatorUserId',
  'createdByUserId',
  'userId',
  'recipientUserId'
]

type DeleteKind = {
  tables: string[]
  /** API function `<module path under apps/apis/convex>.<export>`. */
  api: string
  /** Web source file that calls the delete, and the `convexApi` path it must reference. */
  ui: { file: string; calls: string }
}

const DELETE_KINDS: Record<string, DeleteKind> = {
  'authored content': {
    tables: ['authoredRoots'],
    api: 'content/deletion.deleteActive',
    ui: { file: 'data/authoredOperations.ts', calls: 'content.deletion.deleteActive' }
  },
  'authored drafts': {
    tables: ['authoredDrafts'],
    api: 'content/drafts.discard',
    ui: { file: 'data/authoredOperations.ts', calls: 'content.drafts.discard' }
  },
  Campaigns: {
    tables: ['campaigns'],
    api: 'campaigns/deletion.remove',
    ui: {
      file: 'domains/campaigns/components/CampaignSettings.tsx',
      calls: 'campaigns.deletion.remove'
    }
  },
  Scenes: {
    tables: ['sceneDefinitionSaves', 'sceneDefinitions'],
    api: 'scenes/definitions.remove',
    ui: {
      file: 'domains/campaigns/vtt/SceneDeleteAction.tsx',
      calls: 'scenes.definitions.remove'
    }
  },
  vehicles: {
    tables: ['campaignVehicles'],
    api: 'campaigns/vehicles.remove',
    ui: {
      file: 'domains/campaigns/components/CampaignVehicles/CampaignVehicles.tsx',
      calls: 'campaigns.vehicles.lifecycle'
    }
  },
  notebooks: {
    tables: ['campaignNotebookSections'],
    api: 'campaigns/notebooks.remove',
    ui: {
      file: 'domains/campaigns/components/CampaignNotebook.tsx',
      calls: 'campaigns.notebooks.remove'
    }
  },
  'session notes': {
    tables: ['campaignSessionNotes'],
    api: 'campaigns/sessionNotes.remove',
    ui: {
      file: 'domains/campaigns/components/CampaignSessionNotes.tsx',
      calls: 'campaigns.sessionNotes.remove'
    }
  },
  'session references': {
    tables: ['campaignSessionReferences'],
    api: 'campaigns/sessionReferences.remove',
    ui: {
      file: 'domains/campaigns/components/CampaignSessionReferences.tsx',
      calls: 'campaigns.sessionReferences.remove'
    }
  },
  'chat messages': {
    tables: ['campaignConversationEntries'],
    api: 'campaigns/chat.unsend',
    ui: { file: 'domains/campaigns/components/CampaignChat.tsx', calls: 'campaigns.chat.unsend' }
  },
  'currency systems': {
    tables: ['campaignCurrencySystems'],
    api: 'campaigns/currencySystems.remove',
    ui: {
      file: 'domains/campaigns/components/CurrencySystemEditor.tsx',
      calls: 'campaigns.currencySystems.remove'
    }
  },
  'Social listing drafts': {
    tables: ['socialListings'],
    api: 'social/listingDrafts.remove',
    ui: { file: 'domains/social/SocialListingFormPage.tsx', calls: 'social.listingDrafts.remove' }
  },
  'uploaded media': {
    tables: ['mediaAssets'],
    api: 'media/authoredAssets.remove',
    ui: { file: 'data/media.ts', calls: 'media.authoredAssets.remove' }
  },
  'roll history': {
    tables: ['userRollHistory'],
    api: 'rolls.discard',
    ui: { file: 'data/rolls.ts', calls: 'rolls.discard' }
  },
  'Encounter blueprints': {
    tables: ['encounterBlueprints', 'encounterBlueprintUpdates'],
    api: 'encounters/blueprints.remove',
    ui: {
      file: 'domains/campaigns/components/CampaignEncounters.tsx',
      calls: 'encounters.blueprints.remove'
    }
  }
}

/** Kinds whose delete semantics need a user ruling or belong to another slice. */
const PENDING: Record<string, { tables: string[]; reason: string }> = {
  Characters: {
    tables: ['characters', 'characterPlayStates', 'characterDrafts'],
    reason: 'BUILDER-5 owns Character deletion'
  },
  'Campaign announcements': {
    tables: ['campaignAnnouncements'],
    reason: 'delivered to members as notifications; ruling needed on retracting them'
  },
  'Campaign sessions': {
    tables: ['campaignSessions'],
    reason: 'other members own notes, RSVPs and attendance on the session; ruling needed'
  },
  'Custom sources and reusable definitions': {
    tables: ['contentSources', 'reusableDefinitions', 'reusableDefinitionDrafts'],
    reason: 'other accounts and Campaigns may depend on a published source; ruling needed'
  },
  'Import jobs': {
    tables: ['importJobs', 'importPreviewSessions'],
    reason: 'job history with created content attached; ruling needed'
  },
  'Published Social listings': {
    tables: [],
    reason: 'OPEN/CLOSED listings carry other accounts applications; ruling needed'
  },
  'VTT map uploads': {
    tables: [],
    reason: 'map assets share the mediaAssets table with Scene references; ruling needed'
  }
}

/** Owner-keyed tables that are not user-created content, with why they need no delete path. */
const NOT_OWNER_CONTENT: Record<string, string> = {
  accountEntitlements: 'account plan',
  accountDeletionJobs: 'deletion job',
  userProfiles: 'the account itself',
  accountUsageEntries: 'usage accounting',
  notificationFeedItems: 'notification inbox',
  notificationDeliveryIntents: 'notification delivery',
  systemVocabularySnapshots: 'derived snapshot',
  authoredImportRefs: 'derived reference',
  authoredCatalogueOwnerCounts: 'derived counter',
  authoredRouteIds: 'derived route for authoredRoots',
  sceneFogSaves: 'child of a Scene definition',
  sceneFogLayers: 'child of a Scene definition',
  sceneLiveEntities: 'child of a live Scene',
  campaignDeletionJobs: 'deletion job',
  campaignCopyJobs: 'copy job, cancellable',
  campaignInvites: 'recipient-owned invitation',
  campaignSessionRsvps: 'membership state',
  campaignConversationMembers: 'membership state',
  campaignMemberships: 'membership state',
  campaignCharacterAssignments: 'membership state',
  socialProfileInvalidations: 'derived',
  socialProfiles: 'part of the account profile',
  importUploadClaims: 'upload bookkeeping',
  characterReceiptPurgeJobs: 'purge job'
}

const apiSources = import.meta.glob('./**/*.ts', { query: '?raw', import: 'default' })
const webSources = import.meta.glob('../../web/src/**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default'
})

async function source(files: Record<string, () => Promise<unknown>>, key: string) {
  const load = files[key]
  if (!load) throw new Error(`Missing source file ${key}`)
  return String(await load())
}

const classified = [
  ...Object.values(DELETE_KINDS).flatMap((kind) => kind.tables),
  ...Object.values(PENDING).flatMap((kind) => kind.tables),
  ...Object.keys(NOT_OWNER_CONTENT)
]

describe('owner delete coverage', () => {
  it('classifies every owner-keyed table in the schema', () => {
    const ownerKeyed = Object.entries(schema.tables)
      .filter(([, table]) => {
        const document = JSON.stringify(table.validator.json)
        return OWNER_FIELDS.some((field) => document.includes(`"${field}"`))
      })
      .map(([name]) => name)
    expect(ownerKeyed.filter((name) => !classified.includes(name))).toEqual([])
  })

  it('names only tables the schema defines', () => {
    expect(classified.filter((name) => !(name in schema.tables))).toEqual([])
  })

  describe.each(Object.entries(DELETE_KINDS))('%s', (_kind, entry) => {
    const [modulePath, exportName] = entry.api.split('.') as [string, string]

    it('has an API delete mutation', async () => {
      expect(await source(apiSources, `./${modulePath}.ts`)).toMatch(
        new RegExp(`export const ${exportName} = (mutation|action)\\(`)
      )
    })

    it('has a UI action that calls the delete', async () => {
      expect(await source(webSources, `../../web/src/${entry.ui.file}`)).toContain(entry.ui.calls)
    })
  })

  it('keeps the pending list to the rulings recorded in docs/validation', () => {
    expect(Object.keys(PENDING).sort()).toEqual(
      [
        'Campaign announcements',
        'Campaign sessions',
        'Characters',
        'Custom sources and reusable definitions',
        'Import jobs',
        'Published Social listings',
        'VTT map uploads'
      ].sort()
    )
  })
})
