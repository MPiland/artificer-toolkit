import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthoredVersionRecord, DBLike } from '@artificer-toolkit/db'
import {
  characterRulePolicyInputSchema,
  type CharacterRulePolicyInput
} from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'

import { dnd5e2014CharacterPolicyDocument } from '../rules/systems/dnd5e/2014/characterPolicy.js'
import type { CampaignCharacterContentOverlay } from './campaignCharacterContent.js'

const identifiers = {
  character: 'character-1',
  parentRace: 'parent-race-1',
  parentVersion: 'parent-race-version-1',
  subrace: 'subrace-1',
  subraceVersion: 'subrace-version-1',
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

const { createEmptyCharacterAuthored } = await import('./builderService.js')
const { loadCurrentCharacterAuthoredVersionVector } = await import('./characterMechanicsCompiler.js')

const checksum = (value: string) => value.repeat(64)

const emptyRegistry: CharacterAssemblyRegistry = {
  backgrounds: {},
  classes: {},
  equipment: {},
  feats: {},
  features: {},
  races: {},
  spells: {}
}

function rulePolicyInput(): CharacterRulePolicyInput {
  const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
    (candidate) => candidate.modelKey === 'character-policy'
  )
  if (!fixture) throw new Error('Character policy fixture is missing.')
  return characterRulePolicyInputSchema.parse(fixture.input)
}

function versionRecord(input: {
  dependencies?: AuthoredVersionRecord['compiled']['authoredDependencies']
  subjectId: string
  versionId: string
}): AuthoredVersionRecord {
  return {
    authored: {
      subjectKind: 'RACE',
      subjectId: input.subjectId,
      versionId: input.versionId,
      version: 1,
      documentSchemaVersion: 1,
      checksum: checksum(input.subjectId),
      document: {}
    },
    compiled: {
      subjectKind: 'RACE',
      subjectId: input.subjectId,
      authoredVersionId: input.versionId,
      authoredVersion: 1,
      authoredChecksum: checksum(input.subjectId),
      projectionSchemaVersion: 1,
      compilerVersion: 'subject-compiler-v1',
      vocabularySnapshotId: 'snapshot-1',
      vocabularySnapshotVersion: 1,
      vocabularySnapshotChecksum: checksum('snapshot'),
      authoredDependencies: input.dependencies ?? [],
      projectionChecksum: checksum(input.versionId),
      projection: {}
    }
  } as unknown as AuthoredVersionRecord
}

describe('Character mechanics authored version vector', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findActiveByIds.mockResolvedValue(new Map())
  })

  it('includes a selected subrace’s exact immutable parent dependency', async () => {
    const parent = versionRecord({
      subjectId: identifiers.parentRace,
      versionId: identifiers.parentVersion
    })
    const subrace = versionRecord({
      subjectId: identifiers.subrace,
      versionId: identifiers.subraceVersion,
      dependencies: [
        {
          subjectKind: 'RACE',
          subjectId: identifiers.parentRace,
          versionId: identifiers.parentVersion,
          version: 1,
          checksum: checksum(identifiers.parentRace)
        }
      ]
    })
    mocks.findActiveByIds.mockImplementation(async ({ subjectKind }: { subjectKind: string }) =>
      subjectKind === 'RACE' ? new Map([[identifiers.subrace, subrace]]) : new Map()
    )
    mocks.findExactVersions.mockResolvedValue(new Map([[`RACE:${identifiers.parentRace}`, parent]]))
    const character = createEmptyCharacterAuthored({
      id: identifiers.character,
      systemId: identifiers.system,
      userId: identifiers.user
    })
    character.intent.race = { raceId: identifiers.subrace }

    await expect(
      loadCurrentCharacterAuthoredVersionVector({
        db: {} as DBLike,
        character,
        rulePolicyInput: rulePolicyInput(),
        ruleRegistry: emptyRegistry
      })
    ).resolves.toEqual([
      {
        subjectKind: 'RACE',
        subjectId: identifiers.parentRace,
        versionId: identifiers.parentVersion,
        version: 1,
        checksum: checksum(identifiers.parentRace)
      },
      {
        subjectKind: 'RACE',
        subjectId: identifiers.subrace,
        versionId: identifiers.subraceVersion,
        version: 1,
        checksum: checksum(identifiers.subrace)
      }
    ])
    expect(mocks.findActiveByIds).toHaveBeenCalledWith({
      subjectKind: 'RACE',
      subjectIds: [identifiers.subrace],
      systemId: identifiers.system,
      userId: identifiers.user,
      includeMaster: true
    })
    expect(mocks.findExactVersions).toHaveBeenCalledWith({
      entries: [
        {
          subjectKind: 'RACE',
          subjectId: identifiers.parentRace,
          versionId: identifiers.parentVersion,
          version: 1,
          checksum: checksum(identifiers.parentRace)
        }
      ]
    })
  })

  it('includes a Campaign-owned subrace’s exact immutable parent dependency', async () => {
    const parent = versionRecord({
      subjectId: identifiers.parentRace,
      versionId: identifiers.parentVersion
    })
    const overlay = {
      campaignId: 'campaign-1',
      bindings: new Map([
        [
          `RACE:${identifiers.subrace}`,
          {
            contentVersionId: 'campaign-content-version-1',
            subjectKind: 'RACE',
            subjectId: identifiers.subrace,
            revision: 1,
            authoredVersionId: identifiers.subraceVersion,
            authoredVersion: 1,
            authoredChecksum: checksum(identifiers.subrace),
            compiledProjectionChecksum: checksum('compiled-subrace'),
            authoredDependencies: [
              {
                subjectKind: 'RACE',
                subjectId: identifiers.parentRace,
                versionId: identifiers.parentVersion,
                version: 1,
                checksum: checksum(identifiers.parentRace)
              }
            ],
            authored: {}
          }
        ]
      ]),
      latest: new Map()
    } as unknown as CampaignCharacterContentOverlay
    mocks.findExactVersions.mockResolvedValue(new Map([[`RACE:${identifiers.parentRace}`, parent]]))
    const character = createEmptyCharacterAuthored({
      id: identifiers.character,
      systemId: identifiers.system,
      userId: identifiers.user
    })
    character.intent.race = { raceId: identifiers.subrace }

    await expect(
      loadCurrentCharacterAuthoredVersionVector({
        db: {} as DBLike,
        character,
        campaignContent: overlay,
        rulePolicyInput: rulePolicyInput(),
        ruleRegistry: emptyRegistry
      })
    ).resolves.toEqual([
      {
        subjectKind: 'RACE',
        subjectId: identifiers.parentRace,
        versionId: identifiers.parentVersion,
        version: 1,
        checksum: checksum(identifiers.parentRace)
      },
      {
        subjectKind: 'RACE',
        subjectId: identifiers.subrace,
        versionId: identifiers.subraceVersion,
        version: 1,
        checksum: checksum(identifiers.subrace)
      }
    ])
  })

})
