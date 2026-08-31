import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Box } from '@mantine/core'
import { HttpResponse, delay, http } from 'msw'
import { expect, userEvent, within } from 'storybook/test'
import type { CharacterRestPreviewRequestDto, CharacterSheetPanelDto } from '#app/lib/api'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { CharacterPreparationOptionsResponseDto } from '@artificer-toolkit/schema/api/characterPreparationOptions'
import { createCharacterRestPreviewFixture } from './characterRest.fixtures'
import { characterSheetFixture } from './characterSheet.fixtures'
import { CharacterSheetView } from '../core/CharacterSheetView'
import { companionPanelFixture, vehiclePanelFixture } from '../inspector/inspector.fixtures'

export function panelHandler(panel: CharacterSheetPanelDto) {
  return http.get('*/api/trpc/characters.panel', () =>
    HttpResponse.json([{ result: { data: panel } }])
  )
}

export function spellsPanelHandler(panel: Extract<CharacterSheetPanelDto, { kind: 'SPELLS' }>) {
  const preparationOptions = {
    characterId: panel.characterId,
    streamVersion: characterSheetFixture.meta.streamVersion,
    classes: []
  } satisfies CharacterPreparationOptionsResponseDto

  return http.get('*/api/trpc/characters.panel,characters.preparationOptions', () =>
    HttpResponse.json([{ result: { data: panel } }, { result: { data: preparationOptions } }])
  )
}

export function extrasPanelHandler() {
  return http.get('*/api/trpc/characters.panel', ({ request }) => {
    const panel = request.url.includes('VEHICLE') ? vehiclePanelFixture : companionPanelFixture
    return HttpResponse.json([{ result: { data: panel } }])
  })
}

export function extrasOptionsHandler() {
  return http.get('*/api/trpc/characters.extraOptions', () =>
    HttpResponse.json([
      {
        result: {
          data: {
            items: [
              { id: companionPanelFixture.creatureId, label: 'Owl' },
              { id: '00000000-0000-4000-8000-000000000504', label: 'Sailing Ship' }
            ],
            nextCursor: null
          }
        }
      }
    ])
  )
}

export function hitDieRollHandler() {
  const roll = {
    id: '00000000-0000-4000-8000-000000000701',
    characterId: characterSheetFixture.meta.characterId,
    characterLabel: characterSheetFixture.identity.label,
    source: { kind: 'HIT_DIE', label: 'Short rest hit dice' },
    ruleset: { systemId: 'system-1', code: 'DND5E_2014', version: '1' },
    normalizedExpression: '1d10 + 1d8 + 4',
    evidence: {
      terms: [
        { count: 1, die: 10, rolls: [6], subtotal: 6 },
        { count: 1, die: 8, rolls: [5], subtotal: 5 }
      ],
      modifier: 4,
      mode: 'NORMAL',
      subtotal: 11,
      transform: { kind: 'NONE' },
      total: 15
    },
    createdAt: '2026-08-20T12:00:00.000Z'
  } satisfies RollRecordDto

  return http.post('*/api/trpc/rolls.execute', () =>
    HttpResponse.json([{ result: { data: roll } }])
  )
}

export function extrasCommandHandler() {
  return http.post('*/api/trpc/characters.command', () =>
    HttpResponse.json([
      {
        result: {
          data: {
            characterId: characterSheetFixture.meta.characterId,
            streamVersion: characterSheetFixture.meta.streamVersion + 1,
            sheet: {
              ...characterSheetFixture,
              meta: {
                ...characterSheetFixture.meta,
                streamVersion: characterSheetFixture.meta.streamVersion + 1
              },
              extras: {
                kindOptions: [{ code: 'COMPANION', label: 'Companion' }],
                originOptions: [{ code: 'SUMMONED', label: 'Summoned' }],
                items: [
                  {
                    id: companionPanelFixture.companionInstanceId,
                    kind: 'COMPANION',
                    kindLabel: 'Companion',
                    creatureId: companionPanelFixture.creatureId,
                    relationshipKind: 'COMPANION',
                    relationshipLabel: 'Companion',
                    originKind: 'SUMMONED',
                    originLabel: 'Summoned',
                    authoredName: 'Owl',
                    displayName: 'Ferdinand',
                    customName: 'Ferdinand',
                    isActive: true,
                    armorClass: 11,
                    speedLabel: 'Flying 60 feet',
                    hitPoints: { current: 1, temp: 0, maximum: 1 },
                    hitDice: [],
                    actions: [],
                    features: [],
                    equipmentItemIds: []
                  },
                  {
                    id: '00000000-0000-4000-8000-000000000503',
                    kind: 'VEHICLE',
                    kindLabel: 'Vehicle',
                    vehicleId: '00000000-0000-4000-8000-000000000504',
                    authoredName: 'Sailing Ship',
                    displayName: 'Sailing Ship',
                    categoryLabel: 'Water vehicle',
                    isActive: true,
                    speedLabel: '4 mph',
                    crewLabel: '20 crew',
                    passengerCapacity: 20,
                    cargoCapacityLabel: '100 tons',
                    hitPoints: { current: 300, maximum: 300 },
                    actions: [],
                    features: [],
                    equipmentItemIds: []
                  },
                  {
                    id: '00000000-0000-4000-8000-000000000509',
                    kind: 'COMPANION',
                    kindLabel: 'Companion',
                    creatureId: companionPanelFixture.creatureId,
                    relationshipKind: 'COMPANION',
                    relationshipLabel: 'Companion',
                    originKind: 'SUMMONED',
                    originLabel: 'Summoned',
                    authoredName: 'Owl',
                    displayName: 'Owl',
                    isActive: true,
                    armorClass: 11,
                    speedLabel: 'Flying 60 feet',
                    hitPoints: { current: 1, temp: 0, maximum: 1 },
                    hitDice: [],
                    actions: [],
                    features: [],
                    equipmentItemIds: []
                  }
                ]
              }
            }
          }
        }
      }
    ])
  )
}

export function extrasCommandErrorHandler() {
  return http.post('*/api/trpc/characters.command', async () => {
    await delay(1_500)
    return new HttpResponse(null, { status: 500 })
  })
}

export function restPreviewHandler() {
  return http.post('*/api/trpc/characters.restPreview', async ({ request }) => {
    const body: unknown = await request.json()
    if (typeof body !== 'object' || body === null || !('0' in body)) {
      return new HttpResponse(null, { status: 400 })
    }

    const input = (body as { 0: { id: string; input: CharacterRestPreviewRequestDto } })[0].input
    return HttpResponse.json([
      {
        result: {
          data: createCharacterRestPreviewFixture(input)
        }
      }
    ])
  })
}

export const characterSheetStoryMeta = {
  title: 'Domains/Characters/CharacterSheetView',
  component: CharacterSheetView,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Box bg='var(--mantine-color-body)' h='100dvh' p={{ base: 'md', md: 'xl' }}>
        <Story />
      </Box>
    )
  ],
  args: {
    characterPublicId: characterSheetFixture.publicId ?? characterSheetFixture.meta.characterId,
    hasDraft: false,
    sheet: characterSheetFixture
  }
} satisfies Meta<typeof CharacterSheetView>

export type CharacterSheetStory = StoryObj<typeof characterSheetStoryMeta>

export const characterSheetTabletViewports = {
  characterSheetTabletPortrait: {
    name: 'Character Sheet tablet portrait',
    styles: {
      width: '820px',
      height: '1180px'
    },
    type: 'tablet'
  },
  characterSheetTabletLandscape: {
    name: 'Character Sheet tablet landscape',
    styles: {
      width: '1180px',
      height: '820px'
    },
    type: 'tablet'
  }
} as const

export async function expectInspectorReady(
  canvasElement: HTMLElement,
  title: string,
  readyLabel: string
) {
  const inspector = await within(canvasElement.ownerDocument.body).findByRole(
    'dialog',
    { name: title },
    { timeout: 10_000 }
  )
  await expect(inspector).toBeVisible()
  await expect(
    within(inspector).queryByLabelText('Loading character details')
  ).not.toBeInTheDocument()
  await expect(await within(inspector).findByText(readyLabel, { exact: true })).toBeVisible()
}

export const openStrengthInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Inspect Strength ability' }))
  await expectInspectorReady(canvasElement, 'Strength', 'Effective score')
}

export const openStrengthSaveInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: /Inspect Strength saving throw/i }))
  await expectInspectorReady(canvasElement, 'Strength saving throw', 'Effective total')
}

export const openArcanaInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Arcana' }))
  await expectInspectorReady(canvasElement, 'Arcana', 'Effective total')
}

export const openSkillsInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Skills' }))
  await expectInspectorReady(canvasElement, 'Skills', 'Available skills')
}

export const openSensesInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Inspect Passive Perception' }))
  await expectInspectorReady(canvasElement, 'Senses', 'Available senses')
}

export const openMovementInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Speed 30 feet' }))
  await expectInspectorReady(canvasElement, 'Movement', 'Primary movement')
}

export const openDefensesInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Manage Resistances: None' }))
  await expectInspectorReady(canvasElement, 'Defenses', 'Active defenses')
}

export const openProficienciesInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Proficiencies' }))
  await expectInspectorReady(canvasElement, 'Proficiencies', 'Training entries')
}

export const openSpellInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: /^Open details for Magic Missile/ }))
  await expectInspectorReady(canvasElement, 'Magic Missile', 'Spell source')
}

export const openSpellsInspector: CharacterSheetStory['play'] = async ({
  canvas,
  canvasElement
}) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Manage Spells' }))
  await expectInspectorReady(canvasElement, 'Manage Spells', 'Spell slots')
}
