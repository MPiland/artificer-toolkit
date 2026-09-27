import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import type {
  CharacterRestPreviewRequestDto,
  CharacterRestPreviewResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import type { CharacterSheetResponseDto } from '@artificer-toolkit/schema/api/characterSheetData'

export function createSheet(): CharacterSheetResponseDto {
  return {
    publicId: 'character-1',
    meta: {
      characterId: 'character-1',
      viewer: 'CHARACTER_OWNER',
      capabilities: {
        managePlayState: true,
        managePrivateNotes: true,
        manageInventory: true,
        openBuilder: true
      },
      systemId: 'system-1',
      status: 'ACTIVE',
      streamVersion: 4
    },
    identity: {
      label: 'Aria',
      classSummary: 'Fighter 1',
      totalLevel: 1
    },
    overview: {
      abilities: [
        { ability: 'STRENGTH', score: 10, modifier: 0, rollMode: 'NORMAL' },
        { ability: 'DEXTERITY', score: 14, modifier: 2, rollMode: 'NORMAL' },
        { ability: 'CONSTITUTION', score: 12, modifier: 1, rollMode: 'NORMAL' },
        { ability: 'INTELLIGENCE', score: 8, modifier: -1, rollMode: 'NORMAL' },
        { ability: 'WISDOM', score: 13, modifier: 1, rollMode: 'NORMAL' },
        { ability: 'CHARISMA', score: 11, modifier: 0, rollMode: 'NORMAL' }
      ],
      facts: [
        { label: 'Speed', value: '30 feet' },
        { label: 'Passive Perception', value: '11' },
        { label: 'Passive Investigation', value: '9' },
        { label: 'Passive Insight', value: '11' }
      ],
      armorClass: 12,
      initiative: 2,
      initiativeRollMode: 'NORMAL',
      proficiencyBonus: 2,
      currentHitPoints: 10,
      maxHitPoints: 12,
      tempHitPoints: 3,
      maxHitPointsOverride: null,
      maxHitPointsModifier: 0,
      maxHitPointsModifierAdjustmentId: null,
      maxHitPointsReductions: [],
      exhaustion: {
        label: 'Exhaustion',
        description: 'Exhaustion measures cumulative fatigue.',
        level: 0,
        minimumLevel: 0,
        maximumLevel: 6
      },
      conditions: [],
      hitDice: [{ die: 8, total: 1, used: 0, remaining: 1 }],
      savingThrows: [
        {
          ability: 'STRENGTH',
          label: 'Strength',
          total: 2,
          rollMode: 'NORMAL',
          proficiency: 'FULL'
        },
        {
          ability: 'DEXTERITY',
          label: 'Dexterity',
          total: 2,
          rollMode: 'NORMAL',
          proficiency: 'NONE'
        },
        {
          ability: 'CONSTITUTION',
          label: 'Constitution',
          total: 3,
          rollMode: 'NORMAL',
          proficiency: 'FULL'
        },
        {
          ability: 'INTELLIGENCE',
          label: 'Intelligence',
          total: -1,
          rollMode: 'NORMAL',
          proficiency: 'NONE'
        },
        {
          ability: 'WISDOM',
          label: 'Wisdom',
          total: 1,
          rollMode: 'NORMAL',
          proficiency: 'NONE'
        },
        {
          ability: 'CHARISMA',
          label: 'Charisma',
          total: 0,
          rollMode: 'NORMAL',
          proficiency: 'NONE'
        }
      ],
      skills: [
        {
          skillId: 'athletics',
          code: 'ATHLETICS',
          label: 'Athletics',
          ability: 'STRENGTH',
          total: 2,
          rollMode: 'NORMAL',
          proficiency: 'FULL'
        },
        {
          skillId: 'perception',
          code: 'PERCEPTION',
          label: 'Perception',
          ability: 'WISDOM',
          total: 1,
          rollMode: 'NORMAL',
          proficiency: 'NONE'
        },
        {
          skillId: 'investigation',
          code: 'INVESTIGATION',
          label: 'Investigation',
          ability: 'INTELLIGENCE',
          total: -1,
          rollMode: 'NORMAL',
          proficiency: 'NONE'
        },
        {
          skillId: 'insight',
          code: 'INSIGHT',
          label: 'Insight',
          ability: 'WISDOM',
          total: 1,
          rollMode: 'NORMAL',
          proficiency: 'NONE'
        },
        {
          skillId: 'stealth',
          code: 'STEALTH',
          label: 'Stealth',
          ability: 'DEXTERITY',
          total: 2,
          rollMode: 'NORMAL',
          proficiency: 'NONE'
        }
      ]
    },
    actions: { items: [] },
    resources: {
      items: [
        {
          id: 'resource-1',
          label: 'Second Wind',
          sourceLabel: 'Fighter',
          used: 0,
          max: 1,
          remaining: 1,
          owner: {
            kind: 'AUTHORED_GRANT',
            resourceGrantId: 'resource-1',
            source: {
              kind: 'SYSTEM',
              systemId: '11111111-1111-1111-1111-111111111111'
            }
          },
          recoveries: [{ trigger: 'SHORT_REST', amount: { kind: 'ALL' } }]
        }
      ],
      hitDice: [{ die: 8, total: 1, used: 0, remaining: 1 }]
    },
    spells: {
      saveDc: null,
      attackBonus: null,
      slots: [],
      activeGroups: [],
      spells: []
    },
    inventory: {
      items: [
        {
          id: 'item-1',
          equipmentId: 'equipment-1',
          label: 'Longsword',
          quantity: 1,
          equipped: false,
          attuned: false,
          requiresAttunement: true
        }
      ],
      currencies: []
    },
    reference: {
      features: [],
      proficiencies: [],
      defenses: [],
      senses: [],
      conditionOptions: [
        {
          id: 'condition-1',
          code: 'POISONED',
          label: 'Poisoned',
          description: 'A poisoned creature suffers from toxins affecting its body.'
        }
      ],
      equipmentOptions: [
        {
          id: 'equipment-1',
          label: 'Longsword',
          isContainer: false,
          requiresAttunement: true
        }
      ],
      currencyOptions: [{ id: 'currency-1', label: 'Gold' }]
    },
    notes: {},
    extras: {
      kindOptions: [],
      originOptions: [],
      items: []
    }
  }
}

export function createRestPreview(
  request: CharacterRestPreviewRequestDto
): CharacterRestPreviewResponseDto {
  const selected = request.selectedHitDice.find((selection) => selection.die === 8)?.count ?? 0
  const rollEvidence =
    request.requestRoll || request.rollEvidence
      ? {
          expression: '1d8 + 1',
          terms: [{ die: 8, count: 1, modifierPerDie: 1, rolls: [5] }],
          total: 6
        }
      : undefined
  const manualReady = request.healingMode === 'AUTOMATIC' || request.manualHealingAccepted

  return {
    restKind: request.restKind,
    streamVersion: request.expectedVersion,
    previewFingerprint: `rest-preview-${request.restKind.toLowerCase()}`,
    hitPoints: {
      current: 10,
      maximum: 12,
      temporary: 3,
      missing: 2,
      maximumHitPointModifier: -2,
      canResetMaximumHitPointModifier: true
    },
    hitDice: [
      {
        die: 8,
        classLabels: ['Fighter'],
        total: 1,
        used: 0,
        remaining: 1,
        selected,
        constitutionModifier: 1
      }
    ],
    healingMode: request.healingMode,
    manualHealingAccepted: request.manualHealingAccepted,
    ...(selected > 0 ? { canonicalExpression: '1d8 + 1' } : {}),
    ...(rollEvidence ? { rollEvidence } : {}),
    stagedHealing: rollEvidence ? 2 : request.restKind === 'LONG' ? 2 : 0,
    automaticRecoveries: {
      resources: [{ id: 'resource-1', label: 'Second Wind', recovered: 1 }],
      spellSlots: []
    },
    eligibleCompanions: [
      {
        companionInstanceId: '11111111-1111-4111-8111-111111111111',
        label: 'Clockwork Hound',
        selected: request.selectedCompanionInstanceIds.includes(
          '11111111-1111-4111-8111-111111111111'
        ),
        hitDice: [{ die: 8, total: 2, used: 1, remaining: 1, recovered: 1 }],
        resources: [{ id: 'companion-resource-1', label: 'Pounce', recovered: 1 }]
      }
    ],
    canApply:
      request.restKind === 'LONG' || selected === 0 || (rollEvidence !== undefined && manualReady)
  }
}

export async function openHpControls(user: ReturnType<typeof userEvent.setup>) {
  const manageButton = screen.getByRole('button', { name: /manage (?:hp|hit points)/i })
  if (manageButton.getAttribute('aria-expanded') !== 'true') {
    await user.click(manageButton)
  }
  await screen.findByRole('dialog', { name: /manage hit points/i })
  await screen.findByLabelText(/hit point amount/i)
}

export async function openEquipmentManager(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /manage equipment/i }))
  await screen.findByRole('dialog', { name: /manage equipment/i })
}

export async function showCarriedEquipment(user: ReturnType<typeof userEvent.setup>) {
  const carried = screen.getByRole('button', { name: /^carried$/i })
  if (carried.getAttribute('aria-expanded') !== 'true') {
    await user.click(carried)
  }
}

export function mockMobileSheetViewport() {
  const originalMatchMedia = window.matchMedia

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('max-width: 760px') || query.includes('max-width: 48rem'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })

  return () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    })
  }
}

export function mockTabletLandscapeViewport() {
  const originalMatchMedia = window.matchMedia

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('orientation: landscape'),
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })

  return () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia
    })
  }
}
