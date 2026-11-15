import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { shortswordPlus1 } from '@artificer-toolkit/source-data/srd/equipment/shortsword-plus-1.js'
import { useMatches } from '@tanstack/react-router'
import { expect, userEvent, waitFor, within } from 'storybook/test'
import { Shell } from '#app/shell'
import { buildPlatformNavigation, contentKindOrder } from '#app/shell/navigation'
import { Route } from '#routes/_authed/equipment/$equipmentPublicId/$equipmentSlug/edit'
import { buildEquipmentRouteParams } from '#app/routing/authoredRouteParams'
import { AuthoringLayout } from '#forms'
import {
  authoringDesktopViewport,
  expandAuthoringBranch,
  expectAuthoringTargetLabels,
  expectMasterLockedAuthoringRoute,
  expectOwnedActiveAuthoringRoute,
  expectOwnedDraftAuthoringRoute,
  findSeededAuthoringRecord,
  getStoryDocument,
  selectAuthoringTarget
} from '#domains/authoredRouteStory.play'
import {
  STORY_DRAFT_ONLY,
  STORY_RECORDS
} from '../../../../../apis/tests/developmentReviewDataScenarios'

const { ownedActive, ownedDraft } = STORY_RECORDS.equipment

/** The edit route opened at a subject id, which the loader redirects to its canonical handle. */
function editRouter(subjectId: string, label: string) {
  return {
    route: Route,
    path: '/equipment/$equipmentPublicId/$equipmentSlug/edit' as const,
    params: buildEquipmentRouteParams(subjectId, label)
  }
}

/** The viewports the layout stories prove the dense workspace at, beside the default desktop. */
const layoutViewports = {
  authoringDenseDesktop: {
    name: 'Authoring dense desktop',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop'
  },
  authoringTabletPortrait: {
    name: 'Authoring tablet portrait',
    styles: { width: '900px', height: '1200px' },
    type: 'tablet'
  },
  authoringMobile: {
    name: 'Authoring mobile',
    styles: { width: '390px', height: '844px' },
    type: 'mobile'
  }
} as const

// Reads the seeded equipment as the story account (D218, D221): the SRD Shortsword +1, the account's
// own copies of it that `seedStoryData` activates and drafts, and its never-activated Astral Tear
// draft. Writes are spies.
const meta = {
  title: 'Domains/Equipment/Routes/Edit',
  globals: authoringDesktopViewport.globals,
  parameters: {
    layout: 'fullscreen',
    viewport: { options: { ...authoringDesktopViewport.options, ...layoutViewports } },
    tanstack: { router: editRouter(shortswordPlus1.id, shortswordPlus1.label) }
  }
} satisfies Meta<typeof Route>

export default meta

// Typed by the route (the meta sets no `component`), so a story can retarget its params.
type Story = StoryObj<typeof Route>

/**
 * The edit route inside the app shell, as the signed-in author sees it. The shell reads the
 * current path the way `_authed` does, so it lays the route out as an authoring path.
 */
function EditRouteInShell() {
  const currentPath = useMatches({ select: (matches) => matches.at(-1)?.pathname ?? '/' })
  return (
    <Shell
      navigation={buildPlatformNavigation(contentKindOrder)}
      currentPath={currentPath}
      isAuthenticated
      userEmail='creator@example.test'
    >
      <AuthoringLayout />
    </Shell>
  )
}

const ownedDraftRouter = {
  tanstack: { router: editRouter(ownedDraft.subjectId, ownedDraft.label) }
}

/** One layout story: the owned draft in the shell at `viewport`. */
function ownedDraftLayout(viewport: keyof typeof layoutViewports) {
  return {
    globals: { viewport: { value: viewport, isRotated: false } },
    parameters: ownedDraftRouter,
    render: () => <EditRouteInShell />
  }
}

export const MasterLocked: Story = {
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, shortswordPlus1.label)
    await expectMasterLockedAuthoringRoute(canvasElement, shortswordPlus1.label)
  }
}

export const OwnedActive: Story = {
  parameters: { tanstack: { router: editRouter(ownedActive.subjectId, ownedActive.label) } },
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedActive.label)
    await expectOwnedActiveAuthoringRoute(canvasElement, ownedActive.label)
  }
}

export const OwnedDraft: Story = {
  parameters: ownedDraftRouter,
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedDraft.label)
    await expectOwnedDraftAuthoringRoute(canvasElement, ownedDraft.label)
  }
}

/**
 * The SRD Shortsword +1 is a variant: it authors only its magic bonuses, both restricted to the
 * equipped source, and inherits its attack from the Shortsword it varies.
 */
export const ShortswordPlusOneStructure: Story = {
  parameters: ownedDraftRouter,
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedDraft.label)
    await expectOwnedDraftAuthoringRoute(canvasElement, ownedDraft.label)
    await expandAuthoringBranch(canvasElement, /^grants\b/i)
    await expectAuthoringTargetLabels(canvasElement, [/\+1 attack rolls/i, /\+1 damage rolls/i])
    const story = getStoryDocument(canvasElement)
    const steps = story.getByRole('navigation', { name: /^authoring steps$/i })
    // The inherited attack is the parent's: the variant's own rail has no attack to edit.
    await expect(within(steps).queryByRole('link', { name: /melee weapon attack/i })).toBeNull()
    await expect(within(steps).queryByRole('button', { name: /melee weapon attack/i })).toBeNull()
    await expect((await story.findAllByText('+1 Attack Rolls')).length).toBeGreaterThan(0)
    await expect((await story.findAllByText('+1 Damage Rolls')).length).toBeGreaterThan(0)
    await expect(story.queryByText('MODIFIER_GRANT')).not.toBeInTheDocument()
  }
}

export const ShortswordPlusOneDamageModifierDrawer: Story = {
  parameters: ownedDraftRouter,
  play: async ({ canvasElement }) => {
    await findSeededAuthoringRecord(canvasElement, ownedDraft.label)
    await expectOwnedDraftAuthoringRoute(canvasElement, ownedDraft.label)
    await expandAuthoringBranch(canvasElement, /^grants\b/i)
    await selectAuthoringTarget(canvasElement, /\+1 damage rolls/i)

    const story = getStoryDocument(canvasElement)
    const drawer = await story.findByRole('dialog', { name: /edit \+1 damage rolls/i })
    const drawerCanvas = within(drawer)
    await expect(drawerCanvas.getByText('Restrictions')).toBeInTheDocument()
    await expect(
      await drawerCanvas.findByRole('button', { name: /remove option/i })
    ).toBeInTheDocument()
    await expect(
      await drawerCanvas.findByRole('button', { name: /remove condition/i })
    ).toBeInTheDocument()
    await expect(drawerCanvas.getByRole('button', { name: /^cancel$/i })).toBeInTheDocument()
    await expect(drawerCanvas.getByRole('button', { name: /^save$/i })).toBeInTheDocument()
    await expect(drawerCanvas.queryByText('DAMAGE')).not.toBeInTheDocument()
  }
}

/** A homebrew weapon saved but never activated, opened on its Features overview. */
export const AstralTearAwakenedStructure: Story = {
  parameters: {
    tanstack: {
      router: {
        ...editRouter(STORY_DRAFT_ONLY.subjectId, STORY_DRAFT_ONLY.label),
        query: { step: 'overview:feature:features:overview' }
      }
    }
  },
  render: () => <EditRouteInShell />,
  play: async ({ canvasElement }) => {
    const story = getStoryDocument(canvasElement)
    // The first read crosses the network to the seeded deployment.
    await expect(
      await story.findByRole(
        'heading',
        { level: 1, name: STORY_DRAFT_ONLY.label },
        { timeout: 15_000 }
      )
    ).toBeInTheDocument()
    // The heading renders before the draft's form settles into its saved state; a failure names
    // the state the header shows.
    await waitFor(
      () => {
        const state = canvasElement.ownerDocument
          .querySelector('[data-dirty]')
          ?.getAttribute('aria-label')
        if (!/all changes saved/i.test(state ?? ''))
          throw new Error(`The save state reads ${state}.`)
      },
      { timeout: 15_000 }
    )
    await expect(
      await story.findByText(/all changes saved/i, {}, { timeout: 15_000 })
    ).toBeInTheDocument()
    await expect(story.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
    await expandAuthoringBranch(canvasElement, /^effects\b/i)
    await expandAuthoringBranch(canvasElement, /^grants\b/i)
    await expandAuthoringBranch(canvasElement, /^features\b/i)
    await expectAuthoringTargetLabels(canvasElement, [
      /melee weapon attack/i,
      /\+1 attack rolls/i,
      /\+1 damage rolls/i,
      /warping strike/i,
      /spells/i
    ])
    const editor = within(story.getByTestId('authoring-form-content'))
    await expect(editor.getAllByText('Features')).toHaveLength(1)
    await expect(
      editor.getByText('Add and organize the abilities this item provides.')
    ).toBeInTheDocument()
    await expect(
      story.getByRole('heading', { level: 1, name: 'The Astral Tear Awakened' })
    ).toBeInTheDocument()
    const hideSteps = story.queryByRole('button', { name: /hide steps/i })
    if (hideSteps) await userEvent.click(hideSteps)
    const showPreview = story.queryByRole('button', { name: /show preview/i })
    if (showPreview) await userEvent.click(showPreview)
    await expect(
      await story.findByRole('heading', { level: 3, name: 'Warping Strike' })
    ).toBeInTheDocument()
    await expect(
      await story.findByRole('heading', { level: 3, name: 'Spells' })
    ).toBeInTheDocument()
  }
}

/** At 1440 x 900 the app shell and the canvas hold still beneath a leaf drawer. */
export const ShortswordPlusOneDenseDesktop: Story = {
  ...ownedDraftLayout('authoringDenseDesktop'),
  play: async ({ canvasElement }) => {
    const story = await openShortswordPlusOne(canvasElement, 1440)

    await expect(story.getByTestId('app-shell')).toBeVisible()
    await expect(story.getByText('Artificer Toolkit', { exact: true })).toBeVisible()
    await expect(story.getByText('D&D 5e 2014', { exact: true })).toBeVisible()
    await expect(story.getByText('Equipment · Draft · Homebrew', { exact: true })).toBeVisible()
    const progressTrack = story.getByRole('progressbar', { name: /^\d+ of \d+ steps complete$/ })
    const progressFill = progressTrack.querySelector('span')
    if (!progressFill) throw new Error('Expected measurable authoring progress geometry.')
    await expect(
      Math.abs(
        progressTrack.getBoundingClientRect().width - progressFill.getBoundingClientRect().width
      )
    ).toBeLessThanOrEqual(1)
    await expect(story.getByRole('button', { name: 'Library' })).toBeVisible()
    await expect(story.getByRole('button', { name: 'Create' })).toBeVisible()
    await expect(story.getByRole('searchbox', { name: 'Search commands' })).toBeVisible()
    await expect(story.getByRole('button', { name: 'Open account menu' })).toBeVisible()

    const saveDraft = story.getByRole('button', { name: /save draft/i })
    const activate = story.getByRole('button', { name: /^activate$/i })
    await expect(saveDraft).toBeVisible()
    await expect(activate).toBeVisible()
    await expectMinimumTargetSize(activate)

    const canvas = story.getByTestId('authoring-form-canvas')
    const canvasWidthBefore = canvas.getBoundingClientRect().width
    if (!canvasWidthBefore)
      throw new Error('Expected the authoring canvas to have measurable width.')

    await openRailTarget(story.getByRole('navigation', { name: /authoring steps/i }), /^grants/i)

    const modifierCard = grandparent(
      await story.findByRole('button', { name: 'Open +1 Damage Rolls' })
    )
    await expect(modifierCard).toHaveStyle({
      borderBottomStyle: 'solid',
      borderBottomWidth: '1px'
    })
    await expect(modifierCard).not.toHaveAttribute('data-editing')

    const damageModifier = story.getByRole('button', { name: 'Edit +1 Damage Rolls' })
    await expect(damageModifier).toBeVisible()
    await expectMinimumTargetSize(damageModifier)
    await userEvent.click(damageModifier)

    const editor = await story.findByRole('dialog', { name: /edit \+1 damage rolls/i })
    const inEditor = within(editor)
    const cancel = inEditor.getByRole('button', { name: /^cancel$/i })
    const save = inEditor.getByRole('button', { name: /^save$/i })
    await waitFor(() => expect(editor).toBeVisible())
    await waitFor(() => expect(modifierCard).toHaveAttribute('data-editing', 'true'))
    await waitFor(() =>
      expect(canvasElement.ownerDocument.querySelector('.mantine-Drawer-overlay')).toBeVisible()
    )
    await expect(story.getByTestId('app-shell')).toBeVisible()
    await expect(canvas.getBoundingClientRect().width).toBe(canvasWidthBefore)
    await expectMinimumTargetSize(cancel)
    await expectMinimumTargetSize(save)
    await expectNoHorizontalOverflow(canvasElement.ownerDocument)

    const [addCondition] = await inEditor.findAllByRole('button', { name: 'Add condition' })
    const addOption = inEditor.getByRole('button', { name: 'Add option' })
    const [removeCondition] = inEditor.getAllByRole('button', { name: 'Remove condition' })
    const [removeOption] = inEditor.getAllByRole('button', { name: 'Remove option' })
    const optionLabel = inEditor.getByText('Option 1', { exact: true })
    await expect(addCondition).toBeVisible()
    await expect(addOption).toBeVisible()
    await expect(removeCondition).toBeVisible()
    await expect(removeOption).toBeVisible()
    await expect(optionLabel).toBeVisible()
    await expectMinimumTargetSize(removeOption)
    await expectSameRow(addCondition, removeCondition)
    await expectNotOverlapping(addCondition, addOption)
    await expectTransparentBackground(addCondition)
    await expectTransparentBackground(addOption)
    await expectTransparentBackground(removeCondition)
    await expect(grandparent(optionLabel)).toHaveStyle({
      borderBottomStyle: 'solid',
      borderBottomWidth: '1px'
    })

    await userEvent.click(addCondition)
    await expect(await inEditor.findByRole('separator', { name: 'AND condition' })).toBeVisible()
    await userEvent.click(addOption)
    await expect(await inEditor.findByRole('separator', { name: 'OR option' })).toBeVisible()
    await expect(inEditor.getAllByRole('button', { name: 'Remove option' })).toHaveLength(2)

    await userEvent.click(cancel)

    await waitFor(() => expect(editor).not.toBeVisible())
    await waitFor(() => expect(modifierCard).not.toHaveAttribute('data-editing'))
    await waitFor(() => expect(damageModifier).toHaveFocus())
    await expect(story.getByText(/all changes saved/i)).toBeVisible()
    await expectNoHorizontalOverflow(canvasElement.ownerDocument)

    await userEvent.click(damageModifier)
    const reopened = await story.findByRole('dialog', { name: /edit \+1 damage rolls/i })
    await waitFor(() => expect(reopened).toBeVisible())
    await waitFor(() => expect(modifierCard).toHaveAttribute('data-editing', 'true'))
    await userEvent.click(within(reopened).getByRole('button', { name: /^cancel$/i }))
    await waitFor(() => expect(reopened).not.toBeVisible())
    await waitFor(() => expect(modifierCard).not.toHaveAttribute('data-editing'))
  }
}

/** At 900 x 1200 the steps open in an overlay without resizing the canvas. */
export const ShortswordPlusOneTabletPortrait: Story = {
  ...ownedDraftLayout('authoringTabletPortrait'),
  play: async ({ canvasElement }) => {
    const story = await openShortswordPlusOne(canvasElement, 900)

    const canvas = story.getByTestId('authoring-form-canvas')
    const canvasWidthBefore = canvas.getBoundingClientRect().width
    if (!canvasWidthBefore)
      throw new Error('Expected the authoring canvas to have measurable width.')

    const showSteps = story.getByRole('button', { name: 'Show steps' })
    await expect(showSteps).toBeVisible()
    await expectMinimumTargetSize(showSteps)
    await userEvent.click(showSteps)

    const stepsDrawer = await story.findByRole('dialog', { name: 'Authoring steps' })
    await waitFor(() => expect(stepsDrawer).toBeVisible())
    await expect(canvas.getBoundingClientRect().width).toBe(canvasWidthBefore)
    await expectNoHorizontalOverflow(canvasElement.ownerDocument)

    await userEvent.click(within(stepsDrawer).getByRole('button', { name: 'Close steps' }))
    await waitFor(() => expect(stepsDrawer).not.toBeVisible())
    await expectNoHorizontalOverflow(canvasElement.ownerDocument)
  }
}

/** At 390 x 844 the steps open in an overlay and the leaf editor sits above the app navigation. */
export const ShortswordPlusOneMobile: Story = {
  ...ownedDraftLayout('authoringMobile'),
  play: async ({ canvasElement }) => {
    const viewportWidth = 390
    const story = await openShortswordPlusOne(canvasElement, viewportWidth)

    const canvas = story.getByTestId('authoring-form-canvas')
    const canvasWidthBefore = canvas.getBoundingClientRect().width
    if (!canvasWidthBefore)
      throw new Error('Expected the authoring canvas to have measurable width.')

    await userEvent.click(story.getByRole('button', { name: 'Show steps' }))
    const stepsDrawer = await story.findByRole('dialog', { name: 'Authoring steps' })
    await openRailTarget(
      within(stepsDrawer).getByRole('navigation', { name: 'Authoring steps' }),
      /^grants/i
    )
    await userEvent.click(within(stepsDrawer).getByRole('button', { name: 'Close steps' }))
    await waitFor(() => expect(stepsDrawer).not.toBeVisible())

    const canvasModifierOpener = await story.findByRole('button', { name: 'Open +1 Damage Rolls' })
    await userEvent.click(canvasModifierOpener)
    const editor = await story.findByRole('dialog', { name: /edit \+1 damage rolls/i })
    await waitFor(() => expect(editor).toBeVisible())
    const appNavigation = story.getByRole('contentinfo', { name: 'App navigation' })
    // The editor slides up from below, so its geometry is read once the slide settles.
    await waitFor(() => {
      const bottom = editor.getBoundingClientRect().bottom
      const top = appNavigation.getBoundingClientRect().top
      expect(
        Math.abs(bottom - top),
        `editor bottom ${bottom}, app navigation top ${top}`
      ).toBeLessThanOrEqual(1)
    })
    const editorBox = editor.getBoundingClientRect()
    await expect(editorBox.width).toBeGreaterThanOrEqual(viewportWidth - 1)
    await expect(canvas.getBoundingClientRect().width).toBe(canvasWidthBefore)

    const inEditor = within(editor)
    const cancel = inEditor.getByRole('button', { name: /^cancel$/i })
    const save = inEditor.getByRole('button', { name: /^save$/i })
    const [addCondition] = inEditor.getAllByRole('button', { name: 'Add condition' })
    await expect(addCondition).toHaveAttribute('data-variant', 'default')
    await expect(inEditor.getByRole('button', { name: 'Add option' })).toHaveAttribute(
      'data-variant',
      'default'
    )
    await expectMinimumTargetSize(cancel)
    await expectMinimumTargetSize(save)
    await expectNoHorizontalOverflow(canvasElement.ownerDocument)

    await userEvent.click(cancel)
    await waitFor(() => expect(editor).not.toBeVisible())
    await waitFor(() => expect(canvasModifierOpener).toHaveFocus())
    await expect(canvasElement.ownerDocument.querySelector('[data-dirty]')).toHaveAttribute(
      'data-dirty',
      'false'
    )
    await expectNoHorizontalOverflow(canvasElement.ownerDocument)
  }
}

/**
 * Waits for the seeded owned draft, checks the story runs at the layout's width and closes the
 * preview a wide layout opens beside the canvas.
 */
async function openShortswordPlusOne(canvasElement: HTMLElement, viewportWidth: number) {
  await findSeededAuthoringRecord(canvasElement, ownedDraft.label)
  await expect(canvasElement.ownerDocument.defaultView?.innerWidth).toBe(viewportWidth)
  const story = getStoryDocument(canvasElement)
  await expect(story.getByTestId('authoring-form-canvas')).toBeVisible()
  const closePreview = story.queryByRole('button', { name: /close preview/i })
  if (closePreview?.checkVisibility()) {
    await userEvent.click(closePreview)
    await waitFor(() => expect(story.queryAllByRole('dialog')).toHaveLength(0))
  }
  return story
}

/** Opens a rail target; a branch opens its overview when it has one. */
async function openRailTarget(navigation: HTMLElement, name: RegExp) {
  const scope = within(navigation)
  const [target] = [
    ...scope.queryAllByRole('link', { name }),
    ...scope.queryAllByRole('button', { name })
  ]
  if (!target) throw new Error(`Unable to find rail target ${name}.`)
  // The steps drawer may still be sliding in.
  await waitFor(() => expect(target).toBeVisible())
  const childGroupId = target.getAttribute('aria-controls')
  if (!childGroupId) {
    await userEvent.click(target)
    return
  }
  if (target.getAttribute('aria-expanded') !== 'true') await userEvent.click(target)
  const childGroup = navigation.ownerDocument.getElementById(childGroupId)
  const overview = childGroup && within(childGroup).queryByRole('button', { name: /^overview/i })
  if (!overview) return
  await waitFor(() => expect(overview).toBeVisible())
  await userEvent.click(overview)
}

function grandparent(element: HTMLElement) {
  const card = element.parentElement?.parentElement
  if (!card) throw new Error('Expected the control to sit inside a card.')
  return card
}

async function expectMinimumTargetSize(element: HTMLElement) {
  const box = element.getBoundingClientRect()
  await expect(box.height).toBeGreaterThanOrEqual(44)
  await expect(box.width).toBeGreaterThanOrEqual(44)
}

async function expectNotOverlapping(first: HTMLElement, second: HTMLElement) {
  const a = first.getBoundingClientRect()
  const b = second.getBoundingClientRect()
  const overlaps = a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
  await expect(overlaps).toBe(false)
}

async function expectSameRow(first: HTMLElement, second: HTMLElement) {
  const a = first.getBoundingClientRect()
  const b = second.getBoundingClientRect()
  await expect(Math.abs(a.top + a.height / 2 - (b.top + b.height / 2))).toBeLessThanOrEqual(1)
}

async function expectTransparentBackground(element: HTMLElement) {
  await expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(
    getComputedStyle(element).backgroundColor
  )
}

async function expectNoHorizontalOverflow(document: Document) {
  await expect(
    document.body.scrollWidth - document.body.clientWidth,
    'body horizontal overflow'
  ).toBeLessThanOrEqual(1)
  await expect(
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
    'document horizontal overflow'
  ).toBeLessThanOrEqual(1)
}
