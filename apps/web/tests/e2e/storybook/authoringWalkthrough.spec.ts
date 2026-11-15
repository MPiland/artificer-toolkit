import { expect, test, type Locator, type Page } from '@playwright/test'

// Backgrounds, classes, creatures, feats, races, spells and vehicles read the seeded deployment, so
// their walkthrough steps are the play functions of their backend stories (`*.backend.stories.tsx`,
// the storybook-backend-browser proof), which this props-only run cannot load.
const domains = [{ id: 'equipment', label: 'Shortsword +1' }] as const

test.describe('route-backed authored domain workspace', () => {
  for (const domain of domains) {
    test(`${domain.id} exposes truthful create, owned, draft, and master states`, async ({
      page
    }) => {
      test.setTimeout(60_000)

      await openStory(page, `domains-${domain.id}-routes-create--create-empty`)
      await expect(page.getByRole('textbox', { name: /name/i })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Next' })).toBeVisible()
      await expect(page.getByLabel('Authoring preview')).toHaveCount(0)
      await expect(page.getByTestId('authoring-action-bar')).toHaveCount(0)
      await openStory(page, `domains-${domain.id}-routes-edit--owned-active`)
      await expect(page.getByRole('textbox', { name: /^name/i })).toHaveValue(domain.label)
      await expect(page.getByRole('textbox', { name: /^name/i })).toBeEditable()
      await expect(page.getByText(/locked for direct editing/i)).toHaveCount(0)

      await openStory(page, `domains-${domain.id}-routes-edit--owned-draft`)
      await expect(page.getByText(/all changes saved/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /save draft/i })).toBeVisible()

      await openStory(page, `domains-${domain.id}-routes-edit--master-locked`)
      await expect(page.getByRole('textbox', { name: /^name/i })).toHaveValue(domain.label)
      await expect(page.getByRole('textbox', { name: /^name/i })).toHaveAttribute('readonly', '')
      await expect(page.getByText(/locked for direct editing/i)).toBeVisible()
      await expect(page.getByRole('button', { name: /duplicate to edit/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /save draft/i })).toHaveCount(0)
    })
  }

  test('dense equipment authoring keeps the app shell and canvas stable beneath a leaf drawer', async ({
    page
  }) => {
    test.setTimeout(60_000)
    await page.setViewportSize({ width: 1440, height: 900 })
    await openStory(page, 'domains-equipment-routes-edit--shortsword-plus-one')

    await expect(page.getByTestId('app-shell')).toBeVisible()
    await expect(page.getByText('Artificer Toolkit', { exact: true })).toBeVisible()
    await expect(page.getByText('D&D 5e 2014', { exact: true })).toBeVisible()
    await expect(page.getByText('Equipment · Draft · Homebrew', { exact: true })).toBeVisible()
    const progressTrack = page.getByRole('progressbar', {
      name: /^\d+ of \d+ steps complete$/
    })
    const progressTrackBox = await progressTrack.boundingBox()
    const progressFillBox = await progressTrack.locator('span').boundingBox()
    if (!progressTrackBox || !progressFillBox) {
      throw new Error('Expected measurable authoring progress geometry.')
    }
    expect(Math.abs(progressTrackBox.width - progressFillBox.width)).toBeLessThanOrEqual(1)
    await expect(page.getByRole('button', { name: 'Library' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create' })).toBeVisible()
    await expect(page.getByRole('searchbox', { name: 'Search commands' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open account menu' })).toBeVisible()

    const saveDraft = page.getByRole('button', { name: /save draft/i })
    const activate = page.getByRole('button', { name: /^activate$/i })
    await expect(saveDraft).toBeVisible()
    await expect(activate).toBeVisible()
    await expectMinimumTargetSize(activate)

    const canvas = page.getByTestId('authoring-form-canvas')
    const canvasWidthBefore = (await canvas.boundingBox())?.width
    if (!canvasWidthBefore)
      throw new Error('Expected the authoring canvas to have measurable width.')

    const navigation = page.getByRole('navigation', { name: /authoring steps/i })
    await openRailTarget(navigation, /^grants/i)

    const modifierCard = page
      .getByRole('button', { name: 'Open +1 Damage Rolls' })
      .locator('xpath=../..')
    await expect(modifierCard).toHaveCSS('border-bottom-style', 'solid')
    await expect(modifierCard).toHaveCSS('border-bottom-width', '1px')
    await expect(modifierCard).not.toHaveAttribute('data-editing')

    const damageModifier = page.getByRole('button', { name: 'Edit +1 Damage Rolls' })
    await expect(damageModifier).toBeVisible()
    await expectMinimumTargetSize(damageModifier)
    await damageModifier.click()

    const editor = page.getByRole('dialog', { name: /edit \+1 damage rolls/i })
    const cancel = editor.getByRole('button', { name: /^cancel$/i })
    const save = editor.getByRole('button', { name: /^save$/i })
    await expect(editor).toBeVisible()
    await expect(modifierCard).toHaveAttribute('data-editing', 'true')
    await expect(page.locator('.mantine-Drawer-overlay')).toBeVisible()
    await expect(page.getByTestId('app-shell')).toBeVisible()
    expect((await canvas.boundingBox())?.width).toBe(canvasWidthBefore)
    await expectMinimumTargetSize(cancel)
    await expectMinimumTargetSize(save)
    await expectNoHorizontalOverflow(page)

    const addCondition = editor.getByRole('button', { name: 'Add condition' }).first()
    const addOption = editor.getByRole('button', { name: 'Add option' })
    const removeCondition = editor.getByRole('button', { name: 'Remove condition' }).first()
    const removeOption = editor.getByRole('button', { name: 'Remove option' }).first()
    const optionLabel = editor.getByText('Option 1', { exact: true })
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
    const optionCard = optionLabel.locator('xpath=../..')
    await expect(optionCard).toHaveCSS('border-bottom-style', 'solid')
    await expect(optionCard).toHaveCSS('border-bottom-width', '1px')

    await addCondition.click()
    await expect(editor.getByRole('separator', { name: 'AND condition' })).toBeVisible()
    await addOption.click()
    await expect(editor.getByRole('separator', { name: 'OR option' })).toBeVisible()
    await expect(editor.getByRole('button', { name: 'Remove option' })).toHaveCount(2)

    await cancel.click()

    await expect(editor).toBeHidden()
    await expect(modifierCard).not.toHaveAttribute('data-editing')
    await expect(damageModifier).toBeFocused()
    await expect(page.getByText(/all changes saved/i)).toBeVisible()
    await expectNoHorizontalOverflow(page)

    await damageModifier.click()
    await expect(editor).toBeVisible()
    await expect(modifierCard).toHaveAttribute('data-editing', 'true')
    await editor.getByRole('button', { name: /^cancel$/i }).click()
    await expect(editor).toBeHidden()
    await expect(modifierCard).not.toHaveAttribute('data-editing')
  })

  test('tablet portrait keeps structure navigation in an overlay without resizing the canvas', async ({
    page
  }) => {
    await page.setViewportSize({ width: 900, height: 1200 })
    await openStory(page, 'domains-equipment-routes-edit--shortsword-plus-one')

    const canvas = page.getByTestId('authoring-form-canvas')
    const canvasWidthBefore = (await canvas.boundingBox())?.width
    if (!canvasWidthBefore)
      throw new Error('Expected the authoring canvas to have measurable width.')

    const showSteps = page.getByRole('button', { name: 'Show steps' })
    await expect(showSteps).toBeVisible()
    await expectMinimumTargetSize(showSteps)
    await showSteps.click()

    const stepsDrawer = page.getByRole('dialog', { name: 'Authoring steps' })
    await expect(stepsDrawer).toBeVisible()
    expect((await canvas.boundingBox())?.width).toBe(canvasWidthBefore)
    await expectNoHorizontalOverflow(page)

    await stepsDrawer.getByRole('button', { name: 'Close steps' }).click()
    await expect(stepsDrawer).toBeHidden()
    await expectNoHorizontalOverflow(page)
  })

  test('mobile uses overlay navigation and a bottom leaf editor with reachable actions', async ({
    page
  }) => {
    test.setTimeout(60_000)
    const viewport = { width: 390, height: 844 }
    await page.setViewportSize(viewport)
    await openStory(page, 'domains-equipment-routes-edit--shortsword-plus-one')

    const canvas = page.getByTestId('authoring-form-canvas')
    const canvasWidthBefore = (await canvas.boundingBox())?.width
    if (!canvasWidthBefore)
      throw new Error('Expected the authoring canvas to have measurable width.')

    await page.getByRole('button', { name: 'Show steps' }).click()
    const stepsDrawer = page.getByRole('dialog', { name: 'Authoring steps' })
    const navigation = stepsDrawer.getByRole('navigation', { name: 'Authoring steps' })
    await openRailTarget(navigation, /^grants/i)
    await stepsDrawer.getByRole('button', { name: 'Close steps' }).click()
    await expect(stepsDrawer).toBeHidden()

    const canvasModifierOpener = page.getByRole('button', { name: 'Open +1 Damage Rolls' })
    await canvasModifierOpener.click()
    const editor = page.getByRole('dialog', { name: /edit \+1 damage rolls/i })
    const editorBox = await editor.boundingBox()
    if (!editorBox) throw new Error('Expected the leaf editor to have measurable geometry.')
    const appNavigationBox = await page
      .getByRole('contentinfo', { name: 'App navigation' })
      .boundingBox()
    if (!appNavigationBox) throw new Error('Expected app navigation to have measurable geometry.')

    expect(Math.abs(editorBox.y + editorBox.height - appNavigationBox.y)).toBeLessThanOrEqual(1)
    expect(editorBox.width).toBeGreaterThanOrEqual(viewport.width - 1)
    expect((await canvas.boundingBox())?.width).toBe(canvasWidthBefore)

    const cancel = editor.getByRole('button', { name: /^cancel$/i })
    const save = editor.getByRole('button', { name: /^save$/i })
    await expect(editor.getByRole('button', { name: 'Add condition' }).first()).toHaveAttribute(
      'data-variant',
      'default'
    )
    await expect(editor.getByRole('button', { name: 'Add option' })).toHaveAttribute(
      'data-variant',
      'default'
    )
    await expectMinimumTargetSize(cancel)
    await expectMinimumTargetSize(save)
    await expectNoHorizontalOverflow(page)

    await cancel.click()
    await expect(editor).toBeHidden()
    await expect(canvasModifierOpener).toBeFocused()
    await expect(page.locator('[data-dirty]')).toHaveAttribute('data-dirty', 'false')
    await expectNoHorizontalOverflow(page)
  })
})

async function openStory(page: Page, storyId: string) {
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`)
  await expect(page.getByTestId('authoring-form-canvas')).toBeVisible({ timeout: 30_000 })
  const closePreview = page.getByRole('button', { name: /close preview/i })
  if (await closePreview.isVisible()) {
    await closePreview.click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
  }
}

async function openRailTarget(navigation: Locator, name: RegExp) {
  const link = navigation.getByRole('link', { name }).first()
  const target = (await link.count()) > 0 ? link : navigation.getByRole('button', { name }).first()
  await expect(target).toBeVisible()
  const childGroupId = await target.getAttribute('aria-controls')

  if (childGroupId) {
    if ((await target.getAttribute('aria-expanded')) !== 'true') await target.click()
    const childGroup = navigation.page().locator(`[id="${childGroupId}"]`)
    const overview = childGroup.getByRole('button', { name: /^overview/i })
    if ((await overview.count()) > 0) {
      await expect(overview).toBeVisible()
      await overview.click()
    }
    return
  }

  await target.click()
}

async function expectMinimumTargetSize(locator: Locator) {
  const box = await locator.boundingBox()
  if (!box) throw new Error('Expected a measurable control.')
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.width).toBeGreaterThanOrEqual(44)
}

async function expectNotOverlapping(first: Locator, second: Locator) {
  const firstBox = await first.boundingBox()
  const secondBox = await second.boundingBox()
  if (!firstBox || !secondBox) throw new Error('Expected measurable controls.')

  const overlaps =
    firstBox.x < secondBox.x + secondBox.width &&
    firstBox.x + firstBox.width > secondBox.x &&
    firstBox.y < secondBox.y + secondBox.height &&
    firstBox.y + firstBox.height > secondBox.y

  expect(overlaps).toBe(false)
}

async function expectSameRow(first: Locator, second: Locator) {
  const firstBox = await first.boundingBox()
  const secondBox = await second.boundingBox()
  if (!firstBox || !secondBox) throw new Error('Expected measurable controls.')

  const firstCenter = firstBox.y + firstBox.height / 2
  const secondCenter = secondBox.y + secondBox.height / 2
  expect(Math.abs(firstCenter - secondCenter)).toBeLessThanOrEqual(1)
}

async function expectTransparentBackground(locator: Locator) {
  const background = await locator.evaluate((element) => getComputedStyle(element).backgroundColor)
  expect(['rgba(0, 0, 0, 0)', 'transparent']).toContain(background)
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    body: document.body.scrollWidth - document.body.clientWidth,
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth
  }))

  expect(overflow.body).toBeLessThanOrEqual(1)
  expect(overflow.document).toBeLessThanOrEqual(1)
}
