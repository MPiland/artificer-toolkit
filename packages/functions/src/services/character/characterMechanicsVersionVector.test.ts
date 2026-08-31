import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { AuthoredVersionRecord, DBLike } from '@artificer-toolkit/db'
import {
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyOutput
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
const { loadCurrentCharacterAuthoredVersionVector } =
  await import('./characterMechanicsCompiler.js')

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

function rulePolicyOutput(): CharacterRulePolicyOutput {
  const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
    (candidate) => candidate.modelKey === 'character-policy'
  )
  if (!fixture) throw new Error('Character policy fixture is missing.')
  return characterRulePolicyOutputSchema.parse(fixture.expected)
}

function rulePolicyOutputWithSpellDependencies(): {
  acceptedSpellIds: string[]
  output: CharacterRulePolicyOutput
} {
  const acceptedSpellIds = [
    'spell-access',
    'spell-class-learned',
    'spell-class-prepared',
    'spell-preparation-learned',
    'spell-preparation-prepared'
  ]
  const base = rulePolicyOutput()
  return {
    acceptedSpellIds,
    output: characterRulePolicyOutputSchema.parse({
      ...base,
      spellAccess: [
        {
          sequence: 0,
          accessId: 'accepted-access',
          sourceInstanceId: 'source-instance',
          spellId: acceptedSpellIds[0],
          sourceFeatureId: 'spellcasting',
          grantId: 'spell-grant',
          sourceKind: 'CLASS',
          sourceId: 'class-1',
          owningClassId: 'class-1',
          timingKind: 'CLASS_LEVEL',
          timingLevel: 1,
          attributes: ['KNOWN'],
          acquisition: 'KNOWN',
          castMode: 'SPELL_SLOT',
          castAtLevel: null,
          castingAbility: 'INTELLIGENCE',
          charge: null,
          learned: true,
          prepared: false
        }
      ],
      classSpellStates: [
        {
          classId: 'class-1',
          learnedSpellIds: [acceptedSpellIds[1]],
          preparedSpellIds: [acceptedSpellIds[2]]
        }
      ],
      spellPreparation: {
        sources: [
          {
            classId: 'class-1',
            sourceIds: ['class-1'],
            preparedSpellLimit: 5,
            maxPreparableSpellLevel: 1,
            learnedSpellIds: [acceptedSpellIds[3], acceptedSpellIds[0]],
            preparedSpellIds: [acceptedSpellIds[4]],
            availableSpellIds: ['available-only']
          }
        ],
        requestDecision: null
      }
    })
  }
}

function versionRecord(input: {
  dependencies?: AuthoredVersionRecord['compiled']['authoredDependencies']
  subjectKind?: AuthoredVersionRecord['authored']['subjectKind']
  subjectId: string
  versionId: string
}): AuthoredVersionRecord {
  const subjectKind = input.subjectKind ?? 'RACE'
  return {
    authored: {
      subjectKind,
      subjectId: input.subjectId,
      versionId: input.versionId,
      version: 1,
      documentSchemaVersion: 1,
      checksum: checksum(input.subjectId),
      document: {}
    },
    compiled: {
      subjectKind,
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
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: identifiers.user
    })
    character.intent.race = { raceId: identifiers.subrace }

    await expect(
      loadCurrentCharacterAuthoredVersionVector({
        db: {} as DBLike,
        character,
        rulePolicyOutput: rulePolicyOutput(),
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
    const overlay = {
      campaignId: 'campaign-1',
      userId: identifiers.user,
      latest: new Map([
        [
          `RACE:${identifiers.subrace}`,
          {
            subjectKind: 'RACE',
            subjectId: identifiers.subrace,
            authoredVersionId: identifiers.subraceVersion,
            authoredVersion: 1,
            authoredChecksum: checksum(identifiers.subrace),
            compiledProjectionChecksum: checksum('compiled-subrace'),
            authoredDependencies: subrace.compiled.authoredDependencies,
            authored: subrace.authored.document
          }
        ]
      ]),
      sharesByRoot: new Map()
    } satisfies CampaignCharacterContentOverlay
    mocks.findExactVersions.mockResolvedValue(new Map([[`RACE:${identifiers.parentRace}`, parent]]))
    const character = createEmptyCharacterAuthored({
      id: identifiers.character,
      systemId: identifiers.system,
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: identifiers.user
    })
    character.intent.race = { raceId: identifiers.subrace }

    await expect(
      loadCurrentCharacterAuthoredVersionVector({
        db: {} as DBLike,
        character,
        campaignContent: overlay,
        rulePolicyOutput: rulePolicyOutput(),
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

  it('persists only authoritative output Spell sources', async () => {
    const { acceptedSpellIds, output } = rulePolicyOutputWithSpellDependencies()
    const spellRecords = new Map(
      acceptedSpellIds.map((spellId) => [
        spellId,
        versionRecord({
          subjectKind: 'SPELL',
          subjectId: spellId,
          versionId: `${spellId}-version`
        })
      ])
    )
    mocks.findActiveByIds.mockImplementation(async ({ subjectKind }: { subjectKind: string }) =>
      subjectKind === 'SPELL' ? spellRecords : new Map()
    )
    const character = createEmptyCharacterAuthored({
      id: identifiers.character,
      systemId: identifiers.system,
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: identifiers.user
    })

    const vector = await loadCurrentCharacterAuthoredVersionVector({
      db: {} as DBLike,
      character,
      rulePolicyOutput: output,
      ruleRegistry: emptyRegistry
    })

    expect(vector.map(({ subjectId }) => subjectId)).toEqual([...acceptedSpellIds].sort())
    expect(vector.some(({ subjectId }) => subjectId === 'available-only')).toBe(false)
    expect(mocks.findActiveByIds).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectKind: 'SPELL',
        subjectIds: acceptedSpellIds
      })
    )
  })

  it('fails closed when an authoritative output Spell has no exact active source', async () => {
    const { output } = rulePolicyOutputWithSpellDependencies()
    output.spellAccess[0]!.spellId = 'missing-spell'
    const character = createEmptyCharacterAuthored({
      id: identifiers.character,
      systemId: identifiers.system,
      primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
      userId: identifiers.user
    })

    await expect(
      loadCurrentCharacterAuthoredVersionVector({
        db: {} as DBLike,
        character,
        rulePolicyOutput: output,
        ruleRegistry: emptyRegistry
      })
    ).rejects.toThrow('requires an active SPELL "missing-spell"')
  })
})
