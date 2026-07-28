import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CharacterBuilderResolution } from './builderService.js'

const mocks = vi.hoisted(() => ({
  appendEvent: vi.fn(),
  findByCommandId: vi.fn(),
  findById: vi.fn(),
  findAuthoredById: vi.fn(),
  getMovementPreference: vi.fn(),
  listAdjustments: vi.fn(),
  listResourceUsage: vi.fn(),
  listSpellCustomizations: vi.fn(),
  patchSheetState: vi.fn(),
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
  return { ...actual, resolveCharacterBuilder: mocks.resolveCharacterBuilder }
})

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
    summary: { totalLevel: 1, abilities: { DEXTERITY: 14 }, classes: [] },
    grants: { features: [], resources: [], spellcasting: [] },
    chosenGrantChoices: [],
    outstandingChoices: [],
    validations: [],
    readiness: { ready: true, blockingIssues: [], outstandingRequiredChoices: [] },
    recommendedSectionId: 'REVIEW'
  }
}

describe('MVP character Sheet command audit', () => {
  beforeEach(() => {
    mocks.appendEvent.mockReset()
    mocks.findByCommandId.mockReset()
    mocks.findById.mockReset()
    mocks.findAuthoredById.mockReset()
    mocks.getMovementPreference.mockReset()
    mocks.getMovementPreference.mockResolvedValue({ mode: 'AUTO' })
    mocks.listAdjustments.mockReset()
    mocks.listAdjustments.mockResolvedValue([])
    mocks.listResourceUsage.mockReset()
    mocks.listResourceUsage.mockResolvedValue([])
    mocks.listSpellCustomizations.mockReset()
    mocks.listSpellCustomizations.mockResolvedValue([])
    mocks.resolveCharacterBuilder.mockReset()
    mocks.patchSheetState.mockReset()
    mocks.setResourceUsage.mockReset()
    mocks.setSpellCustomization.mockReset()
    mocks.findByCommandId.mockResolvedValue(null)
    mocks.resolveCharacterBuilder.mockResolvedValue(createResolution())
  })

  it('rejects one of two concurrent commands using the same stream version', async () => {
    let streamVersion = 1
    mocks.findById.mockImplementation(async () => ({
      id: 'character-1',
      stream_version: streamVersion
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

    const { executeCharacterSheetCommand } = await import('./sheetService.js')
    const command = {
      type: 'ADJUST_HIT_POINTS' as const,
      mode: 'DAMAGE' as const,
      amount: 1,
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
      stream_version: streamVersion
    }))
    mocks.findAuthoredById.mockImplementation(async () => persisted)
    mocks.patchSheetState.mockImplementation(async (_characterId, patches, options) => {
      if (options.expectedStreamVersion !== streamVersion) {
        throw new MockConcurrencyError('character-1', options.expectedStreamVersion)
      }
      const hitpointPatch = patches.find(
        (patch: { kind: string }) => patch.kind === 'HITPOINTS'
      ) as { kind: 'HITPOINTS'; value: CharacterAuthored['state']['hitpoints'] } | undefined
      if (hitpointPatch) {
        persisted = {
          ...persisted,
          state: { ...persisted.state, hitpoints: hitpointPatch.value }
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

    const { executeCharacterSheetCommand } = await import('./sheetService.js')
    const first = {
      type: 'ADJUST_HIT_POINTS' as const,
      mode: 'DAMAGE' as const,
      amount: 1,
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
    expect(persisted.state.hitpoints.current).toBe(9)
  })

  it('keeps Builder-owned profile notes out of Sheet play-state commands', async () => {
    const { applyCharacterSheetCommand } = await import('./sheetService.js')
    const character = createCharacter({
      description: 'Builder description',
      profile: { backstory: 'Builder backstory', notes: 'Builder notes' }
    })
    const sheet = {
      meta: {
        characterId: character.id,
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
        creatureOptions: [],
        vehicleOptions: [],
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
