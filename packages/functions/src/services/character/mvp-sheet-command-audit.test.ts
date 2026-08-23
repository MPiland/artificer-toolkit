import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'

const mocks = vi.hoisted(() => ({
  appendEvent: vi.fn(),
  assembleSheetBundleForRuleContext: vi.fn(),
  assertCommandAuthority: vi.fn(),
  resolveCampaignContext: vi.fn(),
  compileMechanicsProjection: vi.fn(),
  createCommittedExtras: vi.fn(),
  createCommittedResolution: vi.fn(),
  createCommittedSpells: vi.fn(),
  findByCommandId: vi.fn(),
  findById: vi.fn(),
  findAuthoredById: vi.fn(),
  findMechanics: vi.fn(),
  getMovementPreference: vi.fn(),
  listAdjustments: vi.fn(),
  listResourceUsage: vi.fn(),
  listSpellCustomizations: vi.fn(),
  loadCommittedSources: vi.fn(),
  loadCharacterBuilderContext: vi.fn(),
  patchSheetState: vi.fn(),
  publishMechanics: vi.fn(),
  buildSheetBundle: vi.fn(),
  setResourceUsage: vi.fn(),
  setSpellCustomization: vi.fn(),
  resolveCharacterBuilder: vi.fn()
}))

class MockConcurrencyError extends Error {
  constructor(characterId: string, expected: number) {
    super(`Character "${characterId}" stream_version conflict: expected ${expected}.`)
    this.name = 'ConcurrencyError'
  }
}

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    ConcurrencyError: MockConcurrencyError,
    createCharacterEventRepository: () => ({
      append: mocks.appendEvent,
      findByCommandId: mocks.findByCommandId
    }),
    createCharacterRepository: () => ({
      findById: mocks.findById,
      findAuthoredById: mocks.findAuthoredById,
      patchSheetState: mocks.patchSheetState
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      publish: mocks.publishMechanics,
      requireCurrent: mocks.findMechanics
    }),
    createCampaignRepository: () => ({
      findCampaignByCharacter: async () => null
    }),
    createCharacterSheetAdjustmentRepository: () => ({
      getMovementPreference: mocks.getMovementPreference,
      listByCharacter: mocks.listAdjustments
    }),
    createCharacterSheetPlayStateRepository: () => ({
      listResourceUsage: mocks.listResourceUsage,
      listSpellCustomizations: mocks.listSpellCustomizations,
      setResourceUsage: mocks.setResourceUsage,
      setSpellCustomization: mocks.setSpellCustomization
    })
  }
})

vi.mock('./builderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./builderService.js')>()
  return {
    ...actual,
    loadCharacterBuilderContext: mocks.loadCharacterBuilderContext,
    resolveCharacterBuilder: mocks.resolveCharacterBuilder
  }
})

vi.mock('./sheetProjection.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sheetProjection.js')>()
  return { ...actual, buildCharacterSheetBundle: mocks.buildSheetBundle }
})

vi.mock('./characterCommittedSheetSources.js', () => ({
  createCharacterCommittedSheetExtras: mocks.createCommittedExtras,
  createCharacterCommittedSheetResolution: mocks.createCommittedResolution,
  createCharacterCommittedSheetSpells: mocks.createCommittedSpells,
  loadCharacterCommittedSheetSources: mocks.loadCommittedSources
}))

vi.mock('./characterMechanicsCompiler.js', () => ({
  compileCharacterMechanicsProjection: mocks.compileMechanicsProjection
}))

vi.mock('./characterSheetBundleAssembly.js', () => ({
  assembleCharacterSheetBundleForRuleContext: mocks.assembleSheetBundleForRuleContext
}))

vi.mock('../campaign/liveSessionCommandAuthority.js', () => ({
  assertCharacterLiveSessionCommandAuthority: mocks.assertCommandAuthority
}))

vi.mock('./campaignCharacterSheet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./campaignCharacterSheet.js')>()
  return {
    ...actual,
    resolveCharacterSheetCampaignContext: mocks.resolveCampaignContext
  }
})

const { applyCharacterSheetCommand } = await import('./sheetCommandReducer.js')
const { executeCharacterSheetCommand } = await import('./sheetService.js')

const db = {
  selectFrom: () => {
    const query = {
      orderBy: () => query,
      where: () => query,
      execute: async () => []
    }
    return { select: () => query }
  }
}

function createCharacter(overrides: Partial<CharacterAuthored> = {}): CharacterAuthored {
  return {
    id: 'character-1',
    label: 'Aria',
    status: 'ACTIVE',
    profile: {},
    systemId: 'dnd5e2014',
    userId: 'user-1',
    intent: {
      advancement: { method: 'MILESTONE' },
      race: { raceId: 'race-1' },
      background: { backgroundId: 'background-1' },
      classes: [{ classId: 'class-1', classLevel: 1 }],
      abilities: {
        method: 'STANDARD_ARRAY',
        assignments: [{ ability: 'DEXTERITY', option: '14' }]
      },
      hitpoints: {
        method: 'FIXED',
        levels: [{ level: 1, classId: 'class-1', classLevel: 1, value: 10 }]
      },
      featureAcquisitions: []
    },
    state: {
      equipment: { inventory: [], equipped: [], attuned: [] },
      currency: [],
      hitpoints: { current: 10, hitDice: [] }
    },
    ...overrides
  }
}

function createResolution(): CharacterBuilderResolution {
  return {
    mode: 'edit',
    catalog: {
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      spells: []
    },
    registry: {
      system: {
        id: 'dnd5e2014',
        label: 'D&D 5e 2014',
        rulesetCode: 'dnd5e',
        rulesetVersion: '2014',
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
        terrains: [],
        userId: 'user-1'
      },
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      features: []
    },
    sourceRegistry: {
      system: {
        id: 'dnd5e2014',
        label: 'D&D 5e 2014',
        rulesetCode: 'dnd5e',
        rulesetVersion: '2014',
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
        terrains: [],
        userId: 'user-1'
      },
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      features: []
    },
    summary: { totalLevel: 1, abilities: { DEXTERITY: 14 }, classes: [] },
    grants: { features: [], resources: [], spellcasting: [] },
    chosenGrantChoices: [],
    outstandingChoices: [],
    validations: [],
    readiness: { ready: true, blockingIssues: [], outstandingRequiredChoices: [] },
    recommendedSectionId: 'REVIEW'
  }
}

function createAuditSheet(character: CharacterAuthored, streamVersion: number) {
  return {
    meta: {
      characterId: character.id,
      viewer: 'CHARACTER_OWNER' as const,
      capabilities: {
        managePlayState: true,
        managePrivateNotes: true,
        manageInventory: true,
        openBuilder: true
      },
      systemId: character.systemId,
      status: 'ACTIVE' as const,
      streamVersion
    },
    overview: {
      abilities: [],
      savingThrows: [],
      skills: [],
      facts: [],
      armorClass: 10,
      initiative: 0,
      initiativeRollMode: 'NORMAL' as const,
      proficiencyBonus: 2,
      currentHitPoints: character.state.hitpoints.current,
      maxHitPoints: 10,
      tempHitPoints: 0,
      maxHitPointsOverride: null,
      maxHitPointsModifier: 0,
      maxHitPointsModifierAdjustmentId: null,
      exhaustion: {
        label: 'Exhaustion',
        description: 'Exhaustion measures cumulative physical and mental fatigue.',
        level: 0,
        minimumLevel: 0,
        maximumLevel: 6
      },
      conditions: [],
      hitDice: []
    },
    identity: { label: character.label, classSummary: 'Fighter 1', totalLevel: 1 },
    actions: { items: [] },
    extras: {
      kindOptions: [],
      originOptions: [],
      items: []
    },
    resources: { items: [], hitDice: [] },
    spells: { saveDc: null, attackBonus: null, spells: [], slots: [], activeGroups: [] },
    inventory: { items: [], currencies: [] },
    currency: { groups: [] },
    reference: {
      conditionOptions: [],
      equipmentOptions: [],
      currencyOptions: [],
      skillOptions: [],
      languageOptions: [],
      senseOptions: [],
      features: [],
      proficiencies: [],
      defenses: [],
      senses: []
    },
    notes: {
      description: character.description,
      personalityTraits: character.profile.personalityTraits,
      ideals: character.profile.ideals,
      bonds: character.profile.bonds,
      flaws: character.profile.flaws,
      organizations: character.profile.organizations,
      allies: character.profile.allies,
      enemies: character.profile.enemies,
      backstory: character.profile.backstory,
      profileNotes: character.profile.notes
    }
  }
}

describe('MVP character Sheet command audit', () => {
  beforeEach(() => {
    mocks.appendEvent.mockReset()
    mocks.assembleSheetBundleForRuleContext.mockReset()
    mocks.assertCommandAuthority.mockReset()
    mocks.assertCommandAuthority.mockResolvedValue(undefined)
    mocks.resolveCampaignContext.mockReset()
    mocks.resolveCampaignContext.mockResolvedValue({
      viewer: 'CHARACTER_OWNER',
      campaignId: null,
      campaignStatus: null,
      contentMaturity: null,
      attunementSlotOverride: null,
      adjustments: [],
      secretAdjustmentIds: new Set(),
      conditions: []
    })
    mocks.compileMechanicsProjection.mockReset()
    mocks.createCommittedExtras.mockReset()
    mocks.createCommittedResolution.mockReset()
    mocks.createCommittedSpells.mockReset()
    mocks.findByCommandId.mockReset()
    mocks.findById.mockReset()
    mocks.findAuthoredById.mockReset()
    mocks.findMechanics.mockReset()
    mocks.getMovementPreference.mockReset()
    mocks.getMovementPreference.mockResolvedValue({ mode: 'AUTO' })
    mocks.listAdjustments.mockReset()
    mocks.listAdjustments.mockResolvedValue([])
    mocks.listResourceUsage.mockReset()
    mocks.listResourceUsage.mockResolvedValue([])
    mocks.listSpellCustomizations.mockReset()
    mocks.listSpellCustomizations.mockResolvedValue([])
    mocks.loadCharacterBuilderContext.mockReset()
    mocks.resolveCharacterBuilder.mockReset()
    mocks.buildSheetBundle.mockReset()
    mocks.patchSheetState.mockReset()
    mocks.publishMechanics.mockReset()
    mocks.setResourceUsage.mockReset()
    mocks.setSpellCustomization.mockReset()
    mocks.findByCommandId.mockResolvedValue(null)
    const resolution = createResolution()
    const mechanics = {
      characterId: 'character-1',
      authoredVersionVector: [],
      ruleRevisionId: 'revision-1',
      ruleRevisionChecksum: 'a'.repeat(64),
      evaluatorVersion: '0.54.0',
      modelContractVersion: 5,
      rulePolicyInput: {},
      rulePolicyOutput: {},
      ruleRegistry: {},
      ruleSnapshot: { characterId: 'character-1' }
    }
    mocks.findMechanics.mockResolvedValue(mechanics)
    mocks.loadCommittedSources.mockResolvedValue({
      mechanics,
      recordsByRoot: new Map(),
      vocabularySnapshot: { snapshotId: 'snapshot-1' }
    })
    mocks.createCommittedResolution.mockReturnValue(resolution)
    mocks.createCommittedExtras.mockReturnValue({
      creaturesById: new Map(),
      vehiclesById: new Map()
    })
    mocks.createCommittedSpells.mockReturnValue(new Map())
    mocks.compileMechanicsProjection.mockReturnValue({})
    mocks.publishMechanics.mockResolvedValue(undefined)
    mocks.loadCharacterBuilderContext.mockResolvedValue({
      catalog: resolution.catalog,
      registry: resolution.sourceRegistry
    })
    mocks.resolveCharacterBuilder.mockResolvedValue(resolution)
    mocks.buildSheetBundle.mockImplementation(
      async ({
        character,
        streamVersion
      }: {
        character: CharacterAuthored
        streamVersion: number
      }) => ({
        sheet: createAuditSheet(character, streamVersion),
        ruleProjection: {
          derivedStats: {
            maxHitPoints: { base: 10, effective: 10, contributions: [], override: null }
          }
        },
        ruleEvaluation: { output: { rest: { attunementSlotLimit: 3 } } }
      })
    )
    mocks.assembleSheetBundleForRuleContext.mockImplementation(
      async (params: { character: CharacterAuthored; row: { stream_version: number } }) => ({
        bundle: {
          sheet: createAuditSheet(params.character, params.row.stream_version),
          ruleEvaluation: { output: { rest: { attunementSlotLimit: 3 } } }
        },
        mechanics: {
          projectionChecksum: 'mechanics-checksum',
          commandLaneChecksum: 'mechanics-lane-checksum',
          ruleSnapshot: { characterId: params.character.id },
          rulePolicyInput: {},
          rulePolicyOutput: {},
          ruleRegistry: {}
        },
        resolution,
        characterAdjustments: [],
        movementDisplayPreference: { mode: 'AUTO' }
      })
    )
  })

  it('rejects one of two concurrent commands using the same stream version', async () => {
    let streamVersion = 1
    mocks.findById.mockImplementation(async () => ({
      id: 'character-1',
      status: 'ACTIVE',
      stream_version: streamVersion,
      rule_pack_revision_id: 'revision-1'
    }))
    mocks.findAuthoredById.mockResolvedValue(createCharacter())
    mocks.patchSheetState.mockImplementation(async (_characterId, _patches, options) => {
      if (options.expectedStreamVersion !== streamVersion) {
        throw new MockConcurrencyError('character-1', options.expectedStreamVersion)
      }
      streamVersion += 1
      await options.afterPersist?.(db, streamVersion)
      return streamVersion
    })

    const command = {
      type: 'SET_INSPIRATION' as const,
      inspired: true,
      expectedVersion: 1,
      commandId: '00000000-0000-4000-8000-000000000002'
    }
    const results = await Promise.allSettled([
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command
      }),
      executeCharacterSheetCommand({
        db: db as unknown as DBLike,
        characterId: 'character-1',
        userId: 'user-1',
        command
      })
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(mocks.appendEvent).toHaveBeenCalledTimes(1)
  }, 15000)

  it('does not apply the same command twice when a client retries the exact input', async () => {
    let streamVersion = 1
    let persisted = createCharacter()
    let appliedEvent: object | null = null
    mocks.findById.mockImplementation(async () => ({
      id: 'character-1',
      status: 'ACTIVE',
      stream_version: streamVersion,
      rule_pack_revision_id: 'revision-1'
    }))
    mocks.findAuthoredById.mockImplementation(async () => persisted)
    mocks.patchSheetState.mockImplementation(async (_characterId, patches, options) => {
      if (options.expectedStreamVersion !== streamVersion) {
        throw new MockConcurrencyError('character-1', options.expectedStreamVersion)
      }
      const inspirationPatch = patches.find(
        (patch: { kind: string }) => patch.kind === 'INSPIRATION'
      ) as { kind: 'INSPIRATION'; value: boolean } | undefined
      if (inspirationPatch) {
        persisted = {
          ...persisted,
          state: { ...persisted.state, inspiration: inspirationPatch.value }
        }
      }
      streamVersion += 1
      await options.afterPersist?.(db, streamVersion)
      return streamVersion
    })
    mocks.appendEvent.mockImplementation(async (event) => {
      appliedEvent = event
    })
    mocks.findByCommandId.mockImplementation(async () => appliedEvent)

    const first = {
      type: 'SET_INSPIRATION' as const,
      inspired: true,
      expectedVersion: 1,
      commandId: '00000000-0000-4000-8000-000000000003'
    }
    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: first
    })
    await executeCharacterSheetCommand({
      db: db as unknown as DBLike,
      characterId: 'character-1',
      userId: 'user-1',
      command: first
    })

    expect(mocks.appendEvent).toHaveBeenCalledTimes(1)
    expect(persisted.state.inspiration).toBe(true)
  })

  it('keeps Builder-owned profile notes out of Sheet play-state commands', async () => {
    const character = createCharacter({
      description: 'Builder description',
      profile: { backstory: 'Builder backstory', notes: 'Builder notes' }
    })
    const sheet = {
      meta: {
        characterId: character.id,
        viewer: 'CHARACTER_OWNER' as const,
        capabilities: {
          managePlayState: true,
          managePrivateNotes: true,
          manageInventory: true,
          openBuilder: true
        },
        systemId: character.systemId,
        status: 'ACTIVE' as const,
        streamVersion: 1
      },
      overview: {
        abilities: [],
        savingThrows: [],
        skills: [],
        facts: [],
        armorClass: 10,
        initiative: 0,
        initiativeRollMode: 'NORMAL' as const,
        proficiencyBonus: 2,
        currentHitPoints: 10,
        maxHitPoints: 10,
        tempHitPoints: 0,
        maxHitPointsOverride: null,
        maxHitPointsModifier: 0,
        maxHitPointsModifierAdjustmentId: null,
        exhaustion: {
          label: 'Exhaustion',
          description: 'Exhaustion measures cumulative physical and mental fatigue.',
          level: 0,
          minimumLevel: 0,
          maximumLevel: 6
        },
        conditions: [],
        hitDice: []
      },
      identity: { label: character.label, classSummary: 'Fighter 1', totalLevel: 1 },
      actions: { items: [] },
      extras: {
        kindOptions: [],
        originOptions: [],
        items: []
      },
      resources: { items: [], hitDice: [] },
      spells: { saveDc: null, attackBonus: null, spells: [], slots: [], activeGroups: [] },
      inventory: { items: [], currencies: [] },
      currency: { groups: [] },
      reference: {
        conditionOptions: [],
        equipmentOptions: [],
        currencyOptions: [],
        skillOptions: [],
        languageOptions: [],
        senseOptions: [],
        features: [],
        proficiencies: [],
        defenses: [],
        senses: []
      },
      notes: {
        description: character.description,
        personalityTraits: character.profile.personalityTraits,
        ideals: character.profile.ideals,
        bonds: character.profile.bonds,
        flaws: character.profile.flaws,
        organizations: character.profile.organizations,
        allies: character.profile.allies,
        enemies: character.profile.enemies,
        backstory: character.profile.backstory,
        profileNotes: character.profile.notes
      }
    }
    const next = applyCharacterSheetCommand(
      character,
      {
        type: 'CREATE_NOTE',
        title: 'Sheet note',
        body: 'Changed from Sheet',
        groupId: 'session-notes',
        expectedVersion: 1
      },
      sheet
    )

    expect(next.description).toBe('Builder description')
    expect(next.profile.backstory).toBe('Builder backstory')
    expect(next.profile.notes).toBe('Builder notes')
    expect(next.state.notes).toEqual([
      expect.objectContaining({ title: 'Sheet note', body: 'Changed from Sheet' })
    ])
  })
})
