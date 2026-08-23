import type { AuthoredVersionRecord, DBLike } from '@artificer-toolkit/db'
import type { AuthoredVersionVector } from '@artificer-toolkit/schema/projections/identity'
import type { RaceAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  CampaignAuthoredSource,
  CampaignCharacterContentOverlay
} from './campaignCharacterContent.js'

const checksum = (value: string) => value.repeat(64)
const ids = {
  campaign: 'campaign-1',
  parentRace: 'race-parent',
  parentVersion: 'race-parent-version-1',
  subrace: 'race-subrace',
  subraceVersion: 'race-subrace-version-1',
  system: 'system-1',
  user: 'user-1'
} as const

const mocks = vi.hoisted(() => ({
  findActiveByIds: vi.fn(),
  findExactVersions: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createAuthoredVersionRepository: () => ({
    findActiveByIds: mocks.findActiveByIds,
    findExactVersions: mocks.findExactVersions
  })
}))

const { hydrateCampaignSelectedContent } = await import('./campaignCharacterContent.js')

const parentDependency = {
  subjectKind: 'RACE' as const,
  subjectId: ids.parentRace,
  versionId: ids.parentVersion,
  version: 1,
  checksum: checksum('a')
} satisfies AuthoredVersionVector[number]

const parentRace = {
  id: ids.parentRace,
  label: 'Pinned parent race',
  description: '',
  category: 'BASE',
  selectionMode: 'DIRECT',
  size: 'MEDIUM',
  speeds: [],
  userId: ids.user,
  systemId: ids.system
} satisfies RaceAuthored

const subrace = {
  id: ids.subrace,
  label: 'Campaign subrace',
  description: '',
  category: 'SUBRACE',
  parentRaceId: ids.parentRace,
  userId: ids.user,
  systemId: ids.system
} satisfies RaceAuthored

const subraceSource = {
  subjectKind: 'RACE',
  subjectId: ids.subrace,
  authoredVersionId: ids.subraceVersion,
  authoredVersion: 1,
  authoredChecksum: checksum('b'),
  compiledProjectionChecksum: checksum('c'),
  authoredDependencies: [parentDependency],
  authored: subrace
} satisfies CampaignAuthoredSource

const parentRecord = {
  authored: {
    subjectKind: 'RACE',
    subjectId: ids.parentRace,
    versionId: ids.parentVersion,
    version: 1,
    documentSchemaVersion: 1,
    checksum: parentDependency.checksum,
    document: parentRace
  },
  compiled: {
    subjectKind: 'RACE',
    subjectId: ids.parentRace,
    authoredVersionId: ids.parentVersion,
    authoredVersion: 1,
    authoredChecksum: parentDependency.checksum,
    projectionSchemaVersion: 1,
    compilerVersion: 'subject-compiler-v1',
    vocabularySnapshotId: 'snapshot-1',
    vocabularySnapshotVersion: 1,
    vocabularySnapshotChecksum: checksum('d'),
    authoredDependencies: [],
    projectionChecksum: checksum('e'),
    projection: {}
  }
} satisfies AuthoredVersionRecord

describe('Campaign Character current-share hydration', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findActiveByIds.mockResolvedValue(new Map())
    mocks.findExactVersions.mockResolvedValue(new Map([[`RACE:${ids.parentRace}`, parentRecord]]))
  })

  it('resolves a shared subrace parent from its exact current projection dependency', async () => {
    const overlay: CampaignCharacterContentOverlay = {
      campaignId: ids.campaign,
      userId: ids.user,
      latest: new Map([[`RACE:${ids.subrace}`, subraceSource]]),
      sharesByRoot: new Map()
    }

    const content = await hydrateCampaignSelectedContent({} as DBLike, overlay, {
      raceIds: [ids.subrace],
      classIds: [],
      backgroundIds: [],
      equipmentIds: [],
      featIds: [],
      systemId: ids.system
    })

    expect(mocks.findExactVersions).toHaveBeenCalledWith({ entries: [parentDependency] })
    expect(mocks.findActiveByIds).not.toHaveBeenCalled()
    const resolvedSubrace = content.races[0]
    expect(resolvedSubrace?.category).toBe('SUBRACE')
    if (!resolvedSubrace || resolvedSubrace.category !== 'SUBRACE') {
      throw new Error('Expected the Campaign subrace to resolve.')
    }
    expect(resolvedSubrace.subrace.parentLabel).toBe('Pinned parent race')
  })

  it('uses the Character owner/master boundary when no Campaign share supplies the source', async () => {
    const overlay: CampaignCharacterContentOverlay = {
      campaignId: ids.campaign,
      userId: ids.user,
      latest: new Map(),
      sharesByRoot: new Map()
    }

    await hydrateCampaignSelectedContent({} as DBLike, overlay, {
      raceIds: [ids.subrace],
      classIds: [],
      backgroundIds: [],
      equipmentIds: [],
      featIds: [],
      systemId: ids.system
    })

    expect(mocks.findActiveByIds).toHaveBeenCalledWith({
      subjectKind: 'RACE',
      subjectIds: [ids.subrace],
      systemId: ids.system,
      userId: ids.user,
      includeMaster: true
    })
  })
})
