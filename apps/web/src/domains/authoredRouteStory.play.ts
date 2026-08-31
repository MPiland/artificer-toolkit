import { expect, userEvent, waitFor, within } from 'storybook/test'

async function findAuthoringRailItem(container: HTMLElement, name: RegExp) {
  const scope = within(container)

  return await waitFor(() => {
    const target =
      scope.queryByRole('link', { name }) ??
      scope
        .queryAllByRole('button', { name })
        .find((button) => !button.hasAttribute('aria-expanded'))
    if (!target) throw new Error(`Unable to find authoring rail item matching ${name}.`)
    return target
  })
}

async function getAuthoringStepsNavigation(canvasElement: HTMLElement) {
  const page = within(canvasElement.ownerDocument.body)
  const existing = page.queryByRole('navigation', { name: /^authoring steps$/i })
  if (existing) return existing

  const showSteps = page.queryByRole('button', { name: /^show steps$/i })
  if (!showSteps)
    throw new Error('Unable to find the Authoring steps navigation or its reveal control.')

  await userEvent.click(showSteps)
  return await page.findByRole('navigation', { name: /^authoring steps$/i })
}

function getAuthoringRailExpander(target: HTMLElement) {
  const expander = target.parentElement?.querySelector<HTMLButtonElement>('button[aria-expanded]')
  if (!expander) {
    throw new Error(`Unable to find the authoring rail expander for "${target.textContent}".`)
  }
  return expander
}

export async function expectCreateEmptyAuthoringRoute(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)

  await expect(
    await canvas.findByRole('heading', { name: 'How do you want to begin?' })
  ).toBeVisible()
  await expect(canvas.getByTestId('authoring-form-canvas')).toBeInTheDocument()
  await expect(canvas.queryByTestId('authoring-action-bar')).not.toBeInTheDocument()
  await expect(canvas.queryByLabelText('Authoring preview')).not.toBeInTheDocument()

  await userEvent.click(canvas.getByRole('button', { name: /start from scratch/i }))
  await waitFor(async () => {
    const visibleName = canvas
      .getAllByRole('textbox', { name: /name/i })
      .find((element) => element.getClientRects().length > 0)
    if (!visibleName) throw new Error('Expected a visible Guided name field.')
    await expect(visibleName).toBeVisible()
  })
}

export async function expectCreateGuidedSpellRoute(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)

  await expectCreateEmptyAuthoringRoute(canvasElement)
  await expect(canvas.getByRole('heading', { name: 'Start with the basics' })).toBeVisible()
  await expect(canvas.getByRole('textbox', { name: 'Spell name' })).toBeVisible()
  await expect(canvas.getByRole('combobox', { name: 'Level' })).toHaveValue('Cantrip')
  await expect(canvas.getByRole('button', { name: /switch to advanced/i })).toBeVisible()
  await expect(canvas.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
  await expect(canvas.queryByRole('button', { name: /activate/i })).not.toBeInTheDocument()
  await expect(canvas.queryByTestId('authoring-action-bar')).not.toBeInTheDocument()
  await expect(canvas.queryByLabelText('Authoring preview')).not.toBeInTheDocument()
}

export async function expectOwnedActiveAuthoringRoute(canvasElement: HTMLElement, label: string) {
  const canvas = within(canvasElement)

  await waitFor(async () => {
    await expect(canvas.getByDisplayValue(label)).toBeInTheDocument()
  })
  await expect(canvas.getByDisplayValue(label)).not.toHaveAttribute('readonly')
  await expect(canvas.getByTestId('authoring-form-canvas')).toBeInTheDocument()
  await expect(canvas.getByTestId('authoring-action-bar')).toBeInTheDocument()
  await expect(canvas.queryByText(/locked for direct editing/i)).not.toBeInTheDocument()
}

export async function expectOwnedDraftAuthoringRoute(canvasElement: HTMLElement, label: string) {
  const canvas = within(canvasElement)

  await waitFor(async () => {
    await expect(canvas.getByDisplayValue(label)).toBeInTheDocument()
  })
  await expect(canvas.getByText(/all changes saved/i)).toBeInTheDocument()
  await expect(canvas.getByRole('button', { name: /save draft/i })).toBeInTheDocument()
  await expect(canvas.getByDisplayValue(label)).not.toHaveAttribute('readonly')
}

export async function expectMasterLockedAuthoringRoute(canvasElement: HTMLElement, label: string) {
  const canvas = within(canvasElement)

  await waitFor(async () => {
    await expect(canvas.getByDisplayValue(label)).toBeInTheDocument()
  })
  await expect(canvas.getByDisplayValue(label)).toHaveAttribute('readonly')
  await expect(canvas.getByText(/locked for direct editing/i)).toBeInTheDocument()
  await expect(canvas.getByRole('button', { name: /duplicate to edit/i })).toBeInTheDocument()
  await expect(canvas.queryByRole('button', { name: /save draft/i })).not.toBeInTheDocument()
  await expect(canvas.queryByRole('button', { name: /^delete$/i })).not.toBeInTheDocument()
}

export async function selectAuthoringTarget(canvasElement: HTMLElement, name: RegExp) {
  const steps = await getAuthoringStepsNavigation(canvasElement)
  const target = await findAuthoringRailItem(steps, name)

  await userEvent.click(target)
  await waitFor(() => expect(target).toHaveAttribute('aria-current', 'step'))
}

export async function expandAuthoringBranch(canvasElement: HTMLElement, name: RegExp) {
  const steps = await getAuthoringStepsNavigation(canvasElement)
  const target = await findAuthoringRailItem(steps, name)
  const expander = getAuthoringRailExpander(target)

  if (expander.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(expander)
  }

  await waitFor(async () => {
    await expect(expander).toHaveAttribute('aria-expanded', 'true')

    const controlledId = expander.getAttribute('aria-controls')
    await expect(controlledId).toBeTruthy()
    await expect(
      canvasElement.ownerDocument.getElementById(controlledId ?? '')?.firstElementChild
    ).toHaveAttribute('aria-hidden', 'false')
  })
}

export async function selectAuthoringChildTarget(
  canvasElement: HTMLElement,
  parentName: RegExp,
  childName: RegExp
) {
  await expandAuthoringBranch(canvasElement, parentName)

  const steps = await getAuthoringStepsNavigation(canvasElement)
  const parent = await findAuthoringRailItem(steps, parentName)
  const controlledId = getAuthoringRailExpander(parent).getAttribute('aria-controls')
  const controlledRegion = canvasElement.ownerDocument.getElementById(controlledId ?? '')

  await expect(controlledRegion).toBeInTheDocument()
  const target = await findAuthoringRailItem(controlledRegion as HTMLElement, childName)
  await userEvent.click(target)
  await waitFor(() => expect(target).toHaveAttribute('aria-current', 'step'))
}

export async function expandAuthoringChildBranch(
  canvasElement: HTMLElement,
  parentName: RegExp,
  childName: RegExp
) {
  await expandAuthoringBranch(canvasElement, parentName)

  const steps = await getAuthoringStepsNavigation(canvasElement)
  const parent = await findAuthoringRailItem(steps, parentName)
  const controlledId = getAuthoringRailExpander(parent).getAttribute('aria-controls')
  const controlledRegion = canvasElement.ownerDocument.getElementById(controlledId ?? '')

  await expect(controlledRegion).toBeInTheDocument()
  const child = await findAuthoringRailItem(controlledRegion as HTMLElement, childName)
  const childExpander = getAuthoringRailExpander(child)
  if (childExpander.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(childExpander)
  }

  await waitFor(async () => {
    await expect(childExpander).toHaveAttribute('aria-expanded', 'true')

    const childControlledId = childExpander.getAttribute('aria-controls')
    await expect(
      canvasElement.ownerDocument.getElementById(childControlledId ?? '')?.firstElementChild
    ).toHaveAttribute('aria-hidden', 'false')
  })
}

export async function expectAuthoringTargetLabels(
  canvasElement: HTMLElement,
  labels: readonly RegExp[]
) {
  const steps = await getAuthoringStepsNavigation(canvasElement)

  for (const label of labels) {
    await expect(await findAuthoringRailItem(steps, label)).toBeInTheDocument()
  }
}

export function getStoryDocument(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body)
}
