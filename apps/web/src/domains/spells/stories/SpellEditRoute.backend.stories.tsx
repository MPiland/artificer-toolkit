import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { fireball } from '@artificer-toolkit/source-data/srd/spells/fireball.js'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Route } from '#routes/_authed/spells/$spellPublicId/$spellSlug/edit'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import {
  authoringDesktopViewport,
  expandAuthoringBranch,
  expectAuthoringTargetLabels,
  expectMasterLockedAuthoringRoute,
  expectOwnedActiveAuthoringRoute,
  expectOwnedDraftAuthoringRoute,
  findSeededAuthoringRecord,
  getStoryDocument,
  selectAuthoringChildTarget
} from '#domains/authoredRouteStory.play'
import { STORY_RECORDS } from '../../../../../apis/tests/developmentReviewDataScenarios'

const { ownedActive, ownedDraft } = STORY_RECORDS.spell

// Reads the seeded spells as the story account (D218, D221): the SRD Fireball and the account's own
// copies of it that `seedStoryData` activates and drafts. The loader redirects each subject id to the
// record's canonical handle; writes are spies.
const meta = {
  title: 'Domains/Spells/Routes/Edit',
  globals: authoringDesktopViewport.globals,
  parameters: {
    layout: 'fullscreen',
    viewport: { options: authoringDesktopViewport.options },
    tanstack: {
      router: {
        route: Route,
        path: '/spells/$spellPublicId/$spellSlug/edit',
        params: buildSpellRouteParams(fireball.id, fireball.label)
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

const ownedDraftParameters = {
  tanstack: { router: { params: buildSpellRouteParams(ownedDraft.subjectId, ownedDraft.label) } }
}

export const MasterLocked: Story = {
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, fireball.label)
    await expectMasterLockedAuthoringRoute(canvasElement, fireball.label)
  }
}

export const OwnedActive: Story = {
  parameters: {
    tanstack: {
      router: { params: buildSpellRouteParams(ownedActive.subjectId, ownedActive.label) }
    }
  },
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedActive.label)
    await expectOwnedActiveAuthoringRoute(canvasElement, ownedActive.label)
  }
}

export const OwnedDraft: Story = {
  parameters: ownedDraftParameters,
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedDraft.label)
    await expectOwnedDraftAuthoringRoute(canvasElement, ownedDraft.label)
  }
}

export const FireballSavingThrowEffect: Story = {
  parameters: ownedDraftParameters,
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedDraft.label)
    await expectOwnedDraftAuthoringRoute(canvasElement, ownedDraft.label)
    await expandAuthoringBranch(canvasElement, /^effects\b/i)
    await expandAuthoringBranch(canvasElement, /^saving throw\b/i)
    await expandAuthoringBranch(canvasElement, /^details\b/i)
    await expandAuthoringBranch(canvasElement, /^outcome paths\b/i)
    await expectAuthoringTargetLabels(canvasElement, [
      /^saving throw\b/i,
      /^on save failure\b/i,
      /^on save success\b/i
    ])
    await selectAuthoringChildTarget(canvasElement, /^on save failure\b/i, /^details\b/i)

    const story = getStoryDocument(canvasElement)
    await expect(await story.findByRole('combobox', { name: /outcome path/i })).toHaveDisplayValue(
      'On Save Failure'
    )
    await expect(await story.findByRole('button', { name: /^damage$/i })).toBeInTheDocument()
    await expect(story.queryByText('ON_SAVE_FAIL')).not.toBeInTheDocument()
  }
}

// Focused effects use the rail, while a summary outcome opens a reversible overlay.
export const FocusedEffectsAndSummaryOverlay: Story = {
  parameters: ownedDraftParameters,
  play: async ({ canvasElement }) => {
    const story = getStoryDocument(canvasElement)
    await findSeededAuthoringRecord(canvasElement, ownedDraft.label)
    const closePreview = story.queryByRole('button', { name: /close preview/i })
    if (closePreview) {
      await userEvent.click(closePreview)
      await waitFor(() => expect(story.queryByRole('dialog')).not.toBeInTheDocument())
    }

    const formCanvas = within(canvasElement).getByTestId('authoring-form-canvas')
    const canvasWidthBefore = formCanvas.getBoundingClientRect().width
    const effects = await expandAuthoringBranch(canvasElement, /^effects/i)
    const navigation = story.getByRole('navigation', { name: /authoring steps/i })
    await userEvent.click(within(navigation).getByRole('link', { name: /^effects/i }))
    await userEvent.click(await story.findByRole('button', { name: /add effect/i }))

    await expect(await story.findByRole('combobox', { name: /trigger/i })).toBeVisible()
    await expect(story.queryByRole('dialog', { name: /add effect/i })).not.toBeInTheDocument()
    await expect(
      canvasElement.ownerDocument.querySelector('.mantine-Drawer-overlay')
    ).not.toBeInTheDocument()
    await expect(await within(effects).findByRole('button', { name: /^activated/i })).toBeVisible()

    const savingThrow = await expandAuthoringBranch(canvasElement, /^saving throw/i)
    const savingThrowDetails = await expandAuthoringBranch(canvasElement, /^details/i, savingThrow)
    const outcomePaths = await expandAuthoringBranch(
      canvasElement,
      /^outcome paths/i,
      savingThrowDetails
    )
    await expandAuthoringBranch(canvasElement, /^on save failure/i, outcomePaths)
    await selectAuthoringChildTarget(canvasElement, /^on save failure/i, /^details/i)

    const [damageOpener] = await story.findAllByRole('button', { name: /^damage/i })
    const saveStateBefore = story.getByText(/all changes saved|unsaved changes/i).textContent
    await userEvent.click(damageOpener)

    const editor = await story.findByRole('dialog', { name: /edit damage/i })
    await expect(editor).toBeVisible()
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('.mantine-Drawer-overlay')).toBeVisible()
    )
    const editorHeader = editor.querySelector('.mantine-Drawer-header')
    await waitFor(() => expect(editorHeader).toBeVisible())
    if (!editorHeader) throw new Error('Expected the drawer header to have measurable geometry.')
    await expect(editorHeader.getBoundingClientRect().y).toBeGreaterThanOrEqual(0)
    await expect(formCanvas.getBoundingClientRect().width).toBe(canvasWidthBefore)

    const [diceConfig] = within(editor).getAllByRole('textbox', { name: /damage dice/i })
    const originalDice = (diceConfig as HTMLInputElement).value
    await userEvent.clear(diceConfig)
    await userEvent.type(diceConfig, '99d99')

    await userEvent.click(within(editor).getByRole('button', { name: /cancel/i }))

    await waitFor(() =>
      expect(story.queryByRole('dialog', { name: /edit damage/i })).not.toBeInTheDocument()
    )
    await waitFor(() => expect(damageOpener).toHaveFocus())
    await expect(story.getByText(/all changes saved|unsaved changes/i).textContent).toBe(
      saveStateBefore
    )
    await userEvent.click(damageOpener)
    const restoredEditor = await story.findByRole('dialog', { name: /edit damage/i })
    await expect(
      within(restoredEditor).getAllByRole('textbox', { name: /damage dice/i })[0]
    ).toHaveValue(originalDice)
  }
}
