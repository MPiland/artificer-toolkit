import { expect, userEvent, waitFor, within } from 'storybook/test'

export async function expectCreateEmptyAuthoringRoute(canvasElement: HTMLElement) {
  const canvas = within(canvasElement)

  await waitFor(async () => {
    await expect(canvas.getByRole('textbox', { name: /name/i })).toBeInTheDocument()
  })
  await expect(canvas.getByTestId('authoring-form-canvas')).toBeInTheDocument()
  await expect(canvas.getByTestId('authoring-action-bar')).toBeInTheDocument()
  await expect(canvas.getByRole('button', { name: /^back$/i })).toBeDisabled()
  await expect(canvas.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument()
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
  const canvas = within(canvasElement)
  const steps = await canvas.findByRole('navigation', { name: /^authoring steps$/i })
  const target = await within(steps).findByRole('button', { name })

  await userEvent.click(target)
  await waitFor(() =>
    expect(within(steps).getByRole('button', { name })).toHaveAttribute('aria-current', 'step')
  )
}

export async function expandAuthoringBranch(canvasElement: HTMLElement, name: RegExp) {
  const canvas = within(canvasElement)
  const steps = await canvas.findByRole('navigation', { name: /^authoring steps$/i })
  const branch = await within(steps).findByRole('button', { name })

  if (branch.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(branch)
  }

  await waitFor(async () => {
    const expandedBranch = within(steps).getByRole('button', { name })
    await expect(expandedBranch).toHaveAttribute('aria-expanded', 'true')

    const controlledId = expandedBranch.getAttribute('aria-controls')
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

  const canvas = within(canvasElement)
  const steps = await canvas.findByRole('navigation', { name: /^authoring steps$/i })
  const parent = within(steps).getByRole('button', { name: parentName })
  const controlledId = parent.getAttribute('aria-controls')
  const controlledRegion = canvasElement.ownerDocument.getElementById(controlledId ?? '')

  await expect(controlledRegion).toBeInTheDocument()
  const target = await within(controlledRegion as HTMLElement).findByRole('button', {
    name: childName
  })
  await userEvent.click(target)
  await waitFor(() =>
    expect(
      within(controlledRegion as HTMLElement).getByRole('button', { name: childName })
    ).toHaveAttribute('aria-current', 'step')
  )
}

export async function expandAuthoringChildBranch(
  canvasElement: HTMLElement,
  parentName: RegExp,
  childName: RegExp
) {
  await expandAuthoringBranch(canvasElement, parentName)

  const canvas = within(canvasElement)
  const steps = await canvas.findByRole('navigation', { name: /^authoring steps$/i })
  const parent = within(steps).getByRole('button', { name: parentName })
  const controlledId = parent.getAttribute('aria-controls')
  const controlledRegion = canvasElement.ownerDocument.getElementById(controlledId ?? '')

  await expect(controlledRegion).toBeInTheDocument()
  const child = await within(controlledRegion as HTMLElement).findByRole('button', {
    name: childName
  })
  if (child.getAttribute('aria-expanded') !== 'true') {
    await userEvent.click(child)
  }

  await waitFor(async () => {
    const expandedChild = within(controlledRegion as HTMLElement).getByRole('button', {
      name: childName
    })
    await expect(expandedChild).toHaveAttribute('aria-expanded', 'true')

    const childControlledId = expandedChild.getAttribute('aria-controls')
    await expect(
      canvasElement.ownerDocument.getElementById(childControlledId ?? '')?.firstElementChild
    ).toHaveAttribute('aria-hidden', 'false')
  })
}

export async function expectAuthoringTargetLabels(
  canvasElement: HTMLElement,
  labels: readonly RegExp[]
) {
  const canvas = within(canvasElement)
  const steps = await canvas.findByRole('navigation', { name: /^authoring steps$/i })
  const stepsCanvas = within(steps)

  for (const label of labels) {
    await expect(await stepsCanvas.findByRole('button', { name: label })).toBeInTheDocument()
  }
}

export function getStoryDocument(canvasElement: HTMLElement) {
  return within(canvasElement.ownerDocument.body)
}
