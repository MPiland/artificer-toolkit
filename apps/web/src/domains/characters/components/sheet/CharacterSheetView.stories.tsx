import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { Box } from '@mantine/core'
import { HttpResponse, http } from 'msw'
import { expect, userEvent, within } from 'storybook/test'
import type { CharacterSheetPanelDto } from '#app/lib/api'
import { characterSheetFixture } from '../../character.fixtures'
import { CharacterSheetView } from './CharacterSheetView'
import {
  abilityPanelFixture,
  adjustedAbilityPanelFixture,
  defensesPanelFixture,
  movementPanelFixture,
  overriddenAbilityPanelFixture,
  proficienciesPanelFixture,
  savingThrowPanelFixture,
  sensesPanelFixture,
  skillPanelFixture,
  skillsPanelFixture
} from './panels/characterSheetPanel.fixtures'

function panelHandler(panel: CharacterSheetPanelDto) {
  return http.get('*/api/trpc/characters.panel', () =>
    HttpResponse.json([{ result: { data: panel } }]))
}

const meta = {
  title: 'Domains/Characters/CharacterSheetView',
  component: CharacterSheetView,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <Box bg='var(--mantine-color-body)' mih='100dvh' p={{ base: 'md', md: 'xl' }}>
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

export default meta

type Story = StoryObj<typeof meta>

async function expectInspectorReady(canvasElement: HTMLElement, title: string) {
  const inspector = await within(canvasElement.ownerDocument.body).findByRole(
    'dialog',
    { name: title }
  )
  await expect(inspector).toBeVisible()
}

const openStrengthInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Inspect STR ability' }))
  await expectInspectorReady(canvasElement, 'Strength')
}

const openStrengthSaveInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'None Strength -1' }))
  await expectInspectorReady(canvasElement, 'Strength saving throw')
}

const openArcanaInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: /Arcana/ }))
  await expectInspectorReady(canvasElement, 'Arcana')
}

const openSkillsInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Skills' }))
  await expectInspectorReady(canvasElement, 'Skills')
}

const openSensesInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Senses' }))
  await expectInspectorReady(canvasElement, 'Senses')
}

const openMovementInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Speed 30 feet' }))
  await expectInspectorReady(canvasElement, 'Movement')
}

const openDefensesInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Defenses' }))
  await expectInspectorReady(canvasElement, 'Defenses')
}

const openProficienciesInspector: Story['play'] = async ({ canvas, canvasElement }) => {
  await userEvent.click(canvas.getByRole('button', { name: 'Proficiencies' }))
  await expectInspectorReady(canvasElement, 'Proficiencies')
}

export const Desktop: Story = {}

export const Mobile: Story = {
  parameters: {
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

export const DraftPending: Story = {
  args: {
    hasDraft: true
  }
}

export const AbilityInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(abilityPanelFixture)] }
  },
  play: openStrengthInspector
}

export const AbilityInspectorLight: Story = {
  globals: {
    theme: 'light'
  },
  parameters: {
    msw: { handlers: [panelHandler(abilityPanelFixture)] }
  },
  play: openStrengthInspector
}

export const AbilityInspectorAdjusted: Story = {
  parameters: {
    msw: { handlers: [panelHandler(adjustedAbilityPanelFixture)] }
  },
  play: openStrengthInspector
}

export const AbilityInspectorOverridden: Story = {
  parameters: {
    msw: { handlers: [panelHandler(overriddenAbilityPanelFixture)] }
  },
  play: openStrengthInspector
}

export const AbilityInspectorMobile: Story = {
  parameters: {
    msw: { handlers: [panelHandler(abilityPanelFixture)] },
    viewport: {
      defaultViewport: 'mobile1'
    }
  },
  play: openStrengthInspector
}

export const SavingThrowInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(savingThrowPanelFixture)] }
  },
  play: openStrengthSaveInspector
}

export const SkillInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(skillPanelFixture)] }
  },
  play: openArcanaInspector
}

export const SkillsInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(skillsPanelFixture)] }
  },
  play: openSkillsInspector
}

export const SensesInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(sensesPanelFixture)] }
  },
  play: openSensesInspector
}

export const MovementInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(movementPanelFixture)] }
  },
  play: openMovementInspector
}

export const DefensesInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(defensesPanelFixture)] }
  },
  play: openDefensesInspector
}

export const ProficienciesInspector: Story = {
  parameters: {
    msw: { handlers: [panelHandler(proficienciesPanelFixture)] }
  },
  play: openProficienciesInspector
}
