import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import {
  prepareFixtureBuilder,
  prepareFixtureSheet,
  previewFixtureRest,
  readyFighterFixture
} from '@artificer-toolkit/rules-runtime/testing/characterContextFixtures'
import { buildCharacterSheetPanel } from '@artificer-toolkit/rules-runtime/character/sheetPanel'
import type { CharacterSheetPanelDto } from '@artificer-toolkit/schema/api/characterSheetPanel'
import {
  characterRestPreviewResponseDtoSchema,
  type CharacterRestPreviewRequestDto,
  type CharacterRestPreviewResponseDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'
import {
  characterSheetResponseDtoSchema,
  type CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characterSheetData'
import { toCharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'
import { srdCreatures } from '@artificer-toolkit/source-data/srd/creatures/index.js'
import { backpack } from '@artificer-toolkit/source-data/srd/equipment/backpack.js'
import { longsword } from '@artificer-toolkit/source-data/srd/equipment/longsword.js'

const fixture = readyFighterFixture({ resourceLabel: 'Second Wind' })
const wolf = srdCreatures.find((creature) => creature.label === 'Wolf')
if (!wolf) throw new Error('Expected the SRD Wolf.')
const { character: built } = await prepareFixtureBuilder(fixture)
const playedInput = {
  streamVersion: 4,
  character: {
    ...built,
    state: {
      ...built.state,
      equipment: {
        ...built.state.equipment,
        inventory: [
          { id: crypto.randomUUID(), equipmentId: longsword.id, quantity: 1 },
          { id: crypto.randomUUID(), equipmentId: backpack.id, quantity: 1 }
        ]
      },
      hitpoints: { ...built.state.hitpoints, current: 10, temp: 3 },
      creatures: [
        {
          id: crypto.randomUUID(),
          creatureId: wolf.id,
          relationshipKind: 'COMPANION' as const,
          originKind: 'WORLD' as const,
          hitDice: [{ die: 8, total: 2, used: 1 }]
        }
      ]
    }
  },
  documents: { ...fixture.documents, EQUIPMENT: [longsword, backpack], CREATURE: [wolf] }
}
const secondWind = (await prepareFixtureSheet(playedInput)).sheet.resources.items[0]
if (!secondWind) throw new Error('Expected the Second Wind Resource on the Sheet.')
const played = await prepareFixtureSheet({
  ...playedInput,
  resourceUsage: [{ owner: toCharacterResourceOwnerKey(secondWind.owner), used: 1 }]
})
const sheet = characterSheetResponseDtoSchema.parse(played.sheet)

/**
 * The real projected Character Sheet of a played level 1 Fighter: a carried Longsword and Backpack,
 * a companion Wolf, 10 of 11 hit points, 3 temporary hit points and a spent Second Wind.
 */
export function createSheet(): CharacterSheetResponseDto {
  return structuredClone(sheet)
}

/** The real Movement panel of the same Fighter, built from the same rule evaluation as the Sheet. */
export function createMovementPanel(): CharacterSheetPanelDto {
  return buildCharacterSheetPanel({
    character: played.prepared.character,
    resolution: played.prepared.resolution,
    sheet,
    ruleProjection: played.ruleProjection,
    knownSpellEligibleIdsByClass: new Map(),
    adjustments: played.adjustments,
    movementDisplayPreference: played.sheetState.movementDisplayPreference,
    target: { kind: 'MOVEMENT' },
    editable: true
  })
}

/** The real rest preview for the same Fighter, parsed through the transport schema. */
export async function createRestPreview(
  request: CharacterRestPreviewRequestDto
): Promise<CharacterRestPreviewResponseDto> {
  return characterRestPreviewResponseDtoSchema.parse(await previewFixtureRest(played, request))
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
