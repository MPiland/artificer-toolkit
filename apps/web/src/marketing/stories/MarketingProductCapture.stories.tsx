import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { HttpResponse, http } from 'msw'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import type {
  CharacterRestPreviewRequestDto,
  CharacterSheetResponseDto
} from '@artificer-toolkit/schema/api/characters'
import {
  characterSheetFixture,
  characterSheetMulticlassFixture,
  createCharacterRestPreviewFixture
} from '#domains/characters/character.fixtures'
import { CharacterSheetView } from '#domains/characters/components/sheet/CharacterSheetView'
import type { CharacterSheetTabId } from '#domains/characters/components/sheet/CharacterSheet.types'
import { Shell, platformNavigation } from '#app/shell'

const meta = {
  title: 'Guest/Marketing/Product captures',
  parameters: {
    layout: 'fullscreen'
  }
} satisfies Meta

export default meta

type Story = StoryObj<typeof meta>

function CharacterSheetCapture({
  sheet = characterSheetFixture,
  initialTab = 'spells'
}: {
  sheet?: CharacterSheetResponseDto
  initialTab?: CharacterSheetTabId
}) {
  return (
    <Shell
      navigation={platformNavigation}
      currentPath={`/characters/${sheet.publicId ?? sheet.meta.characterId}`}
      isAuthenticated
      userEmail='player@example.test'
    >
      <CharacterSheetView
        characterPublicId={sheet.publicId ?? sheet.meta.characterId}
        hasDraft={false}
        initialTab={initialTab}
        sheet={sheet}
      />
    </Shell>
  )
}

function restPreviewHandler() {
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

async function openShortRest(canvasElement: HTMLElement) {
  const page = within(canvasElement.ownerDocument.body)
  await userEvent.click(page.getByRole('button', { name: 'Short Rest' }))
  const dialog = await page.findByRole('dialog', { name: 'Short Rest' })
  await expect(await within(dialog).findByText('No hit dice selected')).toBeInTheDocument()
  await expect(
    within(dialog).getByLabelText('Reset Maximum HP changes during this rest')
  ).toBeInTheDocument()
  await expect(within(dialog).getByRole('button', { name: 'Take Short Rest' })).toBeInTheDocument()
  return dialog
}

const restParameters = {
  msw: {
    handlers: [restPreviewHandler()]
  }
}

export const CharacterSheet: Story = {
  render: () => <CharacterSheetCapture />
}

export const CharacterSheetMulticlass: Story = {
  render: () => (
    <CharacterSheetCapture initialTab='actions' sheet={characterSheetMulticlassFixture} />
  )
}

export const CharacterSheetShortRest: Story = {
  parameters: restParameters,
  play: async ({ canvasElement }) => {
    const dialog = await openShortRest(canvasElement)
    const addD10 = within(dialog).getByRole('button', { name: 'Add one d10 hit die' })
    await userEvent.click(addD10)
    const addD8 = within(dialog).getByRole('button', { name: 'Add one d8 hit die' })
    await waitFor(() => expect(addD8).toBeEnabled())
    await userEvent.click(addD8)
    await expect(await within(dialog).findByText('1d10 + 1d8 + 4')).toBeVisible()
  },
  render: () => (
    <CharacterSheetCapture initialTab='actions' sheet={characterSheetMulticlassFixture} />
  )
}

export const CharacterSheetShortRestMobile: Story = {
  ...CharacterSheetShortRest,
  parameters: {
    ...restParameters,
    viewport: {
      defaultViewport: 'mobile1'
    }
  }
}

export const CharacterSheetShortRestRolled: Story = {
  ...CharacterSheetShortRest,
  play: async (context) => {
    await CharacterSheetShortRest.play?.(context)
    const dialog = await within(context.canvasElement.ownerDocument.body).findByRole('dialog', {
      name: 'Short Rest'
    })
    await userEvent.click(within(dialog).getByRole('button', { name: '1d10 + 1d8 + 4' }))
    const rolledLabels = await within(dialog).findAllByText('15 rolled')
    await expect(rolledLabels[0]).toBeVisible()
    await expect(within(dialog).getByText('6 HP staged')).toBeVisible()
  }
}
