import type { AuthoredVersionRecord, CampaignContentShare, DBLike } from '@artificer-toolkit/db'
import { characterRulePolicyOutputSchema } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterMechanicsProjection } from '@artificer-toolkit/schema/projections/characterMechanics'
import type { SystemVocabularySnapshot } from '@artificer-toolkit/schema/projections/systemVocabulary'
import type { CharacterAssemblyRegistry } from '@artificer-toolkit/shared/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CampaignCharacterContentOverlay } from './campaignCharacterContent.js'
import { dnd5e2014CharacterPolicyDocument } from '../rules/systems/dnd5e/2014/characterPolicy.js'

const checksum = (value: string) => value.repeat(64)

function createCampaignShare(subjectId: string): CampaignContentShare {
  return {
    campaignId: 'campaign-1',
    subjectKind: 'SPELL',
    subjectId,
    sharedBy: 'campaign-owner',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
}

const mocks = vi.hoisted(() => ({
  findActive: vi.fn(),
  findActiveByIds: vi.fn(),
  findById: vi.fn(),
  findExactVersions: vi.fn(),
  findCurrentVersions: vi.fn(),
  lockShareAuthorizationsForUse: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createAuthoredVersionRepository: () => ({
    findActive: mocks.findActive,
    findActiveByIds: mocks.findActiveByIds,
    findExactVersions: mocks.findExactVersions,
    findCurrentVersions: mocks.findCurrentVersions
  }),
  createCampaignContentShareRepository: () => ({
    lockShareAuthorizationsForUse: mocks.lockShareAuthorizationsForUse
  }),
  createSystemVocabularySnapshotRepository: () => ({ findById: mocks.findById })
}))

const {
  createCharacterCommittedSheetSpells,
  extendCharacterCommittedSheetSourcesWithActiveRoots,
  loadCharacterCommittedSheetSources,
  lockCharacterCommittedSheetCampaignShareUses,
  lockCharacterCommittedSheetCurrentSourceUses,
  removeCharacterCommittedSheetSourceLoss,
  retainCharacterCommittedSheetRuleSources,
  reduceCharacterCommittedSheetSourcesToRuleOutputSpells
} = await import('./characterCommittedSheetSources.js')
const { createEmptyCharacterAuthored } = await import('./builderService.js')

const entry = {
  subjectKind: 'EQUIPMENT' as const,
  subjectId: 'equipment-1',
  versionId: 'equipment-version-1',
  version: 1,
  checksum: checksum('a')
}

const mechanics = {
  characterId: 'character-1',
  authoredVersionVector: [entry],
  systemVocabularySnapshotId: 'snapshot-1',
  systemVocabularySnapshotVersion: 1,
  systemVocabularySnapshotChecksum: checksum('b')
} as CharacterMechanicsProjection

const vocabularySnapshot = {
  snapshotId: 'snapshot-1',
  systemId: 'system-1',
  snapshotVersion: 1,
  schemaVersion: 1,
  checksum: checksum('b'),
  document: {
    id: 'system-1',
    label: 'System',
    rulesetCode: 'dnd5e',
    rulesetVersion: '2014',
    userId: 'user-1',
    alignments: [],
    challengeRatings: [],
    conditionTypes: [],
    creatureTypes: [],
    currencies: [],
    damageTypes: [],
    heritages: [],
    languages: [],
    lifestyles: [],
    magicSchools: [],
    passives: [],
    rarities: [],
    senses: [],
    skills: [],
    speeds: [],
    terrains: []
  }
} satisfies SystemVocabularySnapshot

const pinnedRecord = {
  authored: {
    subjectKind: entry.subjectKind,
    subjectId: entry.subjectId,
    versionId: entry.versionId,
    version: entry.version,
    documentSchemaVersion: 1,
    checksum: entry.checksum,
    document: {
      kind: 'EQUIPMENT',
      id: entry.subjectId,
      label: 'Pinned equipment',
      description: null,
      rarityId: 'common',
      category: 'WEAPON',
      properties: [],
      systemId: 'system-1',
      userId: 'user-1'
    }
  },
  compiled: {
    subjectKind: entry.subjectKind,
    subjectId: entry.subjectId,
    authoredVersionId: entry.versionId,
    authoredVersion: entry.version,
    authoredChecksum: entry.checksum,
    projectionSchemaVersion: 1,
    compilerVersion: 'subject-compiler-v1',
    vocabularySnapshotId: vocabularySnapshot.snapshotId,
    vocabularySnapshotVersion: vocabularySnapshot.snapshotVersion,
    vocabularySnapshotChecksum: vocabularySnapshot.checksum,
    authoredDependencies: [],
    projectionChecksum: checksum('c'),
    projection: {}
  }
} satisfies AuthoredVersionRecord

function createSpellRecord(input: {
  id: string
  systemId?: string
  userId: string
}): AuthoredVersionRecord {
  const versionId = `${input.id}-version-1`
  const authoredChecksum = checksum('s')
  return {
    authored: {
      subjectKind: 'SPELL',
      subjectId: input.id,
      versionId,
      version: 1,
      documentSchemaVersion: 1,
      checksum: authoredChecksum,
      document: {
        kind: 'SPELL',
        id: input.id,
        label: input.id,
        description: '',
        castingTime: { unit: 'ROUND', amount: 1 },
        level: 1,
        classIds: ['class-1'],
        magicSchoolId: 'evocation',
        systemId: input.systemId ?? 'system-1',
        userId: input.userId
      }
    },
    compiled: {
      subjectKind: 'SPELL',
      subjectId: input.id,
      authoredVersionId: versionId,
      authoredVersion: 1,
      authoredChecksum,
      projectionSchemaVersion: 1,
      compilerVersion: 'subject-compiler-v1',
      vocabularySnapshotId: vocabularySnapshot.snapshotId,
      vocabularySnapshotVersion: vocabularySnapshot.snapshotVersion,
      vocabularySnapshotChecksum: vocabularySnapshot.checksum,
      authoredDependencies: [],
      projectionChecksum: checksum('p'),
      projection: {}
    }
  }
}

function toVectorEntry(record: AuthoredVersionRecord) {
  return {
    subjectKind: record.authored.subjectKind,
    subjectId: record.authored.subjectId,
    versionId: record.authored.versionId,
    version: record.authored.version,
    checksum: record.authored.checksum
  }
}

describe('loadCharacterCommittedSheetSources', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findActive.mockResolvedValue({
      ...pinnedRecord,
      authored: { ...pinnedRecord.authored, versionId: 'equipment-version-2', version: 2 }
    })
    mocks.findById.mockResolvedValue(vocabularySnapshot)
    mocks.findExactVersions.mockResolvedValue(
      new Map([[`${entry.subjectKind}:${entry.subjectId}`, pinnedRecord]])
    )
    mocks.findCurrentVersions.mockResolvedValue(new Map())
    mocks.findActiveByIds.mockResolvedValue(new Map())
    mocks.lockShareAuthorizationsForUse.mockResolvedValue({ locked: [], missing: [] })
  })

  it('uses the pinned authored version after the root has a newer active version', async () => {
    const sources = await loadCharacterCommittedSheetSources({
      db: {} as DBLike,
      mechanics
    })

    expect(mocks.findExactVersions).toHaveBeenCalledWith({
      entries: mechanics.authoredVersionVector,
      verifyCompiledDependencies: false
    })
    expect(mocks.findActive).not.toHaveBeenCalled()
    expect(sources.recordsByRoot.get('EQUIPMENT:equipment-1')?.authored.document.label).toBe(
      'Pinned equipment'
    )
  })

  it('extends the exact vector with an explicitly selected active root', async () => {
    const dependency = {
      subjectKind: 'EQUIPMENT' as const,
      subjectId: 'equipment-parent',
      versionId: 'equipment-parent-version-1',
      version: 1,
      checksum: checksum('d')
    }
    const dependencyRecord = {
      ...pinnedRecord,
      authored: {
        ...pinnedRecord.authored,
        subjectId: dependency.subjectId,
        versionId: dependency.versionId,
        checksum: dependency.checksum,
        document: { ...pinnedRecord.authored.document, id: dependency.subjectId }
      },
      compiled: {
        ...pinnedRecord.compiled,
        subjectId: dependency.subjectId,
        authoredVersionId: dependency.versionId,
        authoredChecksum: dependency.checksum
      }
    } satisfies AuthoredVersionRecord
    const activeRecord = {
      ...pinnedRecord,
      authored: {
        ...pinnedRecord.authored,
        subjectId: 'equipment-2',
        versionId: 'equipment-version-2',
        document: { ...pinnedRecord.authored.document, id: 'equipment-2' }
      },
      compiled: {
        ...pinnedRecord.compiled,
        subjectId: 'equipment-2',
        authoredVersionId: 'equipment-version-2',
        authoredDependencies: [dependency]
      }
    } satisfies AuthoredVersionRecord
    mocks.findActiveByIds.mockResolvedValue(new Map([['equipment-2', activeRecord]]))
    mocks.findCurrentVersions.mockResolvedValue(
      new Map([[`${dependency.subjectKind}:${dependency.subjectId}`, dependencyRecord]])
    )

    const { sources, campaignShareUses } =
      await extendCharacterCommittedSheetSourcesWithActiveRoots({
        db: {} as DBLike,
        sources: {
          mechanics,
          recordsByRoot: new Map([['EQUIPMENT:equipment-1', pinnedRecord]]),
          vocabularySnapshot
        },
        roots: [{ subjectKind: 'EQUIPMENT', subjectId: 'equipment-2' }],
        systemId: 'system-1',
        userId: 'user-1'
      })

    expect(mocks.findActiveByIds).toHaveBeenCalledWith({
      subjectKind: 'EQUIPMENT',
      subjectIds: ['equipment-2'],
      systemId: 'system-1',
      userId: 'user-1',
      includeMaster: true
    })
    expect(sources.mechanics.authoredVersionVector).toContainEqual({
      subjectKind: 'EQUIPMENT',
      subjectId: 'equipment-2',
      versionId: 'equipment-version-2',
      version: 1,
      checksum: entry.checksum
    })
    expect(sources.mechanics.authoredVersionVector).toContainEqual(dependency)
    expect(campaignShareUses).toEqual([])
  })

  it('admits only requested exact owner and Master Spells without Campaign evidence', async () => {
    const ownerSpell = createSpellRecord({ id: 'owner-spell', userId: 'user-1' })
    const masterSpell = createSpellRecord({ id: 'master-spell', userId: 'master' })
    const unrelatedSpell = createSpellRecord({ id: 'unrelated-spell', userId: 'user-1' })
    mocks.findActiveByIds.mockResolvedValue(
      new Map([
        [ownerSpell.authored.subjectId, ownerSpell],
        [masterSpell.authored.subjectId, masterSpell],
        [unrelatedSpell.authored.subjectId, unrelatedSpell]
      ])
    )

    const { sources, campaignShareUses } =
      await extendCharacterCommittedSheetSourcesWithActiveRoots({
        db: {} as DBLike,
        sources: {
          mechanics,
          recordsByRoot: new Map([['EQUIPMENT:equipment-1', pinnedRecord]]),
          vocabularySnapshot
        },
        roots: [
          { subjectKind: 'SPELL', subjectId: ownerSpell.authored.subjectId },
          { subjectKind: 'SPELL', subjectId: masterSpell.authored.subjectId }
        ],
        systemId: 'system-1',
        userId: 'user-1'
      })

    expect(createCharacterCommittedSheetSpells(sources)).toEqual(
      new Map([
        [ownerSpell.authored.subjectId, ownerSpell.authored.document],
        [masterSpell.authored.subjectId, masterSpell.authored.document]
      ])
    )
    expect(sources.recordsByRoot.has('SPELL:unrelated-spell')).toBe(false)
    expect(campaignShareUses).toEqual([])
  })

  it('admits an exact real Campaign Spell and locks its current identity', async () => {
    const spell = createSpellRecord({ id: 'campaign-spell', userId: 'campaign-owner' })
    const expected = toVectorEntry(spell)
    const share = createCampaignShare(spell.authored.subjectId)
    const overlay: CampaignCharacterContentOverlay = {
      campaignId: share.campaignId,
      userId: 'user-1',
      latest: new Map([
        [
          'SPELL:campaign-spell',
          {
            subjectKind: 'SPELL',
            subjectId: spell.authored.subjectId,
            authoredVersionId: spell.authored.versionId,
            authoredVersion: spell.authored.version,
            authoredChecksum: spell.authored.checksum,
            compiledProjectionChecksum: spell.compiled.projectionChecksum,
            authoredDependencies: [],
            authored: spell.authored.document
          }
        ]
      ]),
      sharesByRoot: new Map([['SPELL:campaign-spell', share]])
    }
    mocks.findCurrentVersions.mockResolvedValue(new Map([['SPELL:campaign-spell', spell]]))

    const extension = await extendCharacterCommittedSheetSourcesWithActiveRoots({
      campaignContentOverlay: overlay,
      db: {} as DBLike,
      sources: {
        mechanics,
        recordsByRoot: new Map([['EQUIPMENT:equipment-1', pinnedRecord]]),
        vocabularySnapshot
      },
      roots: [{ subjectKind: 'SPELL', subjectId: spell.authored.subjectId }],
      systemId: 'system-1',
      userId: 'user-1'
    })

    expect(extension.sources.mechanics.authoredVersionVector).toContainEqual(expected)
    expect(extension.campaignShareUses).toEqual([
      {
        campaignId: share.campaignId,
        subjectKind: 'SPELL',
        subjectId: spell.authored.subjectId,
        sharedBy: share.sharedBy,
        expectedAuthoredVersionId: spell.authored.versionId,
        expectedAuthoredVersion: spell.authored.version,
        expectedAuthoredChecksum: spell.authored.checksum
      }
    ])

    mocks.lockShareAuthorizationsForUse.mockResolvedValue({ locked: [share], missing: [] })
    await lockCharacterCommittedSheetCampaignShareUses({
      campaignId: share.campaignId,
      campaignShareUses: extension.campaignShareUses,
      characterId: 'character-1',
      db: {} as DBLike
    })
    expect(mocks.lockShareAuthorizationsForUse).toHaveBeenCalledWith({
      campaignId: share.campaignId,
      shares: [
        {
          subjectKind: 'SPELL',
          subjectId: spell.authored.subjectId,
          sharedBy: share.sharedBy,
          versionId: spell.authored.versionId,
          version: spell.authored.version,
          checksum: spell.authored.checksum
        }
      ]
    })

    mocks.findCurrentVersions.mockResolvedValue(new Map([['SPELL:campaign-spell', spell]]))
    await lockCharacterCommittedSheetCurrentSourceUses({
      currentSourceUses: extension.currentSourceUses,
      characterId: 'character-1',
      db: {} as DBLike
    })
    expect(mocks.findCurrentVersions).toHaveBeenLastCalledWith({
      entries: [expected],
      verifyCompiledDependencies: false
    })
  })

  it.each(['missing', 'synthetic', 'wrong-system', 'stale'] as const)(
    'fails closed for a %s requested Campaign Spell',
    async (failure) => {
      const spell = createSpellRecord({
        id: `${failure}-spell`,
        systemId: failure === 'wrong-system' ? 'other-system' : 'system-1',
        userId: 'campaign-owner'
      })
      const key = `SPELL:${spell.authored.subjectId}`
      const share = createCampaignShare(spell.authored.subjectId)
      const overlay: CampaignCharacterContentOverlay = {
        campaignId: share.campaignId,
        userId: 'user-1',
        latest:
          failure === 'missing'
            ? new Map()
            : new Map([
                [
                  key,
                  {
                    subjectKind: 'SPELL',
                    subjectId: spell.authored.subjectId,
                    authoredVersionId: spell.authored.versionId,
                    authoredVersion: spell.authored.version,
                    authoredChecksum: spell.authored.checksum,
                    compiledProjectionChecksum: spell.compiled.projectionChecksum,
                    authoredDependencies: [],
                    authored: spell.authored.document
                  }
                ]
              ]),
        sharesByRoot: failure === 'synthetic' ? new Map() : new Map([[key, share]])
      }
      mocks.findCurrentVersions.mockResolvedValue(
        failure === 'stale' ? new Map() : new Map([[key, spell]])
      )

      await expect(
        extendCharacterCommittedSheetSourcesWithActiveRoots({
          campaignContentOverlay: overlay,
          db: {} as DBLike,
          sources: {
            mechanics,
            recordsByRoot: new Map([['EQUIPMENT:equipment-1', pinnedRecord]]),
            vocabularySnapshot
          },
          roots: [{ subjectKind: 'SPELL', subjectId: spell.authored.subjectId }],
          systemId: 'system-1',
          userId: 'user-1'
        })
      ).rejects.toThrow()
    }
  )

  it('reduces replaced and cleared Spells from authoritative output without changing non-Spells', () => {
    const priorSpell = createSpellRecord({ id: 'prior-spell', userId: 'user-1' })
    const replacementSpell = createSpellRecord({ id: 'replacement-spell', userId: 'user-1' })
    const fixedSpell = createSpellRecord({ id: 'fixed-spell', userId: 'user-1' })
    const sources = {
      mechanics: {
        ...mechanics,
        authoredVersionVector: [
          entry,
          toVectorEntry(priorSpell),
          toVectorEntry(replacementSpell),
          toVectorEntry(fixedSpell)
        ]
      },
      recordsByRoot: new Map([
        ['EQUIPMENT:equipment-1', pinnedRecord],
        ['SPELL:prior-spell', priorSpell],
        ['SPELL:replacement-spell', replacementSpell],
        ['SPELL:fixed-spell', fixedSpell]
      ]),
      vocabularySnapshot
    }

    const replaced = reduceCharacterCommittedSheetSourcesToRuleOutputSpells({
      sources,
      rulePolicyOutput: {
        spellAccess: [{ spellId: fixedSpell.authored.subjectId }],
        classSpellStates: [],
        spellPreparation: {
          sources: [
            { learnedSpellIds: [], preparedSpellIds: [replacementSpell.authored.subjectId] }
          ]
        }
      }
    })
    expect(replaced.mechanics.authoredVersionVector[0]).toEqual(entry)
    expect(
      replaced.mechanics.authoredVersionVector
        .filter((candidate) => candidate.subjectKind === 'SPELL')
        .map((candidate) => candidate.subjectId)
    ).toEqual(['replacement-spell', 'fixed-spell'])

    const cleared = reduceCharacterCommittedSheetSourcesToRuleOutputSpells({
      sources,
      rulePolicyOutput: { spellAccess: [], classSpellStates: [], spellPreparation: { sources: [] } }
    })
    expect(cleared.mechanics.authoredVersionVector).toEqual([entry])
    expect(cleared.recordsByRoot).toEqual(new Map([['EQUIPMENT:equipment-1', pinnedRecord]]))
  })

  it('fails closed when authoritative output requires a missing exact Spell', () => {
    expect(() =>
      reduceCharacterCommittedSheetSourcesToRuleOutputSpells({
        sources: {
          mechanics,
          recordsByRoot: new Map([['EQUIPMENT:equipment-1', pinnedRecord]]),
          vocabularySnapshot
        },
        rulePolicyOutput: {
          spellAccess: [],
          classSpellStates: [],
          spellPreparation: {
            sources: [{ learnedSpellIds: [], preparedSpellIds: ['missing-spell'] }]
          }
        }
      })
    ).toThrow('missing exact required Spell source "missing-spell"')
  })

  it('preserves an existing exact pin instead of resolving the root current pointer again', async () => {
    mocks.findActiveByIds.mockResolvedValue(
      new Map([
        [
          entry.subjectId,
          {
            ...pinnedRecord,
            authored: {
              ...pinnedRecord.authored,
              versionId: 'equipment-version-2',
              version: 2
            }
          }
        ]
      ])
    )

    const existingSources = {
      mechanics,
      recordsByRoot: new Map([['EQUIPMENT:equipment-1', pinnedRecord]]),
      vocabularySnapshot
    }
    const extension = await extendCharacterCommittedSheetSourcesWithActiveRoots({
      db: {} as DBLike,
      sources: existingSources,
      roots: [{ subjectKind: 'EQUIPMENT', subjectId: entry.subjectId }],
      systemId: 'system-1',
      userId: 'user-1'
    })

    expect(extension.sources).toBe(existingSources)
    expect(extension.currentSourceUses).toEqual([])
    expect(mocks.findActiveByIds).not.toHaveBeenCalled()
  })

  it('removes only the unavailable root while preserving an unrelated old exact pin', () => {
    const removedSpell = createSpellRecord({ id: 'removed-spell', userId: 'user-1' })
    const sources = {
      mechanics: {
        ...mechanics,
        authoredVersionVector: [entry, toVectorEntry(removedSpell)]
      },
      recordsByRoot: new Map([
        ['EQUIPMENT:equipment-1', pinnedRecord],
        ['SPELL:removed-spell', removedSpell]
      ]),
      vocabularySnapshot
    }

    const result = removeCharacterCommittedSheetSourceLoss({
      roots: [{ subjectKind: 'SPELL', subjectId: removedSpell.authored.subjectId }],
      sources
    })

    expect(result).toEqual({
      kind: 'EXACT',
      sources: {
        ...sources,
        mechanics: { ...sources.mechanics, authoredVersionVector: [entry] },
        recordsByRoot: new Map([['EQUIPMENT:equipment-1', pinnedRecord]])
      }
    })
  })

  it('classifies removal of a required exact transitive dependency as structural loss', () => {
    const baseDependentSpell = createSpellRecord({ id: 'dependent-spell', userId: 'user-1' })
    const dependentSpell: AuthoredVersionRecord = {
      ...baseDependentSpell,
      compiled: { ...baseDependentSpell.compiled, authoredDependencies: [entry] }
    }
    const dependentEntry = toVectorEntry(dependentSpell)

    const result = removeCharacterCommittedSheetSourceLoss({
      roots: [{ subjectKind: entry.subjectKind, subjectId: entry.subjectId }],
      sources: {
        mechanics: { ...mechanics, authoredVersionVector: [entry, dependentEntry] },
        recordsByRoot: new Map([
          ['EQUIPMENT:equipment-1', pinnedRecord],
          ['SPELL:dependent-spell', dependentSpell]
        ]),
        vocabularySnapshot
      }
    })

    expect(result).toEqual({
      kind: 'TRANSITIVE_DEPENDENCY_LOST',
      dependency: entry,
      requiredBy: dependentEntry
    })
  })

  it('retains only authoritative output roots and their exact dependency closure', () => {
    const baseRetainedSpell = createSpellRecord({ id: 'retained-spell', userId: 'user-1' })
    const retainedSpell: AuthoredVersionRecord = {
      ...baseRetainedSpell,
      compiled: { ...baseRetainedSpell.compiled, authoredDependencies: [entry] }
    }
    const removedSpell = createSpellRecord({ id: 'available-only-spell', userId: 'user-1' })
    const policyFixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
      (candidate) => candidate.modelKey === 'character-policy'
    )
    if (!policyFixture) throw new Error('Character policy fixture is missing.')
    const rulePolicyOutput = characterRulePolicyOutputSchema.parse(policyFixture.expected)
    const retained = retainCharacterCommittedSheetRuleSources({
      character: createEmptyCharacterAuthored({
        id: 'character-1',
        systemId: 'system-1',
        primaryRulesCatalogueId: '00000000-0000-4000-8000-000000000301',
        userId: 'user-1'
      }),
      rulePolicyOutput: {
        ...rulePolicyOutput,
        spellAccess: [],
        classSpellStates: [],
        spellPreparation: {
          sources: [
            {
              classId: 'class-1',
              sourceIds: ['class-1'],
              preparedSpellLimit: null,
              maxPreparableSpellLevel: 0,
              availableSpellIds: [removedSpell.authored.subjectId],
              learnedSpellIds: [retainedSpell.authored.subjectId],
              preparedSpellIds: []
            }
          ],
          requestDecision: null
        }
      },
      ruleRegistry: { feats: {}, equipment: {} } as CharacterAssemblyRegistry,
      sources: {
        mechanics: {
          ...mechanics,
          authoredVersionVector: [entry, toVectorEntry(retainedSpell), toVectorEntry(removedSpell)]
        },
        recordsByRoot: new Map([
          ['EQUIPMENT:equipment-1', pinnedRecord],
          ['SPELL:retained-spell', retainedSpell],
          ['SPELL:available-only-spell', removedSpell]
        ]),
        vocabularySnapshot
      }
    })

    expect(retained.mechanics.authoredVersionVector).toEqual([entry, toVectorEntry(retainedSpell)])
    expect([...retained.recordsByRoot.keys()]).toEqual([
      'EQUIPMENT:equipment-1',
      'SPELL:retained-spell'
    ])
  })
})
