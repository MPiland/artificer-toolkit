import { useMemo } from 'react'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  FeatAuthoringInputDto,
  FeatAuthoredDto
} from '@artificer-toolkit/schema/subjects/feat'
import {
  AuthoringFormLayout,
  AuthoringFormProvider,
  clearResolvedNodeFormPaths,
  useAppForm,
  useAuthoringFormRegistration,
  type AuthoringFormActionHandlers,
  type AuthoringFormRegistration
} from '#forms'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { normalizeFeatForSubmit } from '../featAuthoring.utils'
import { FeatAuthoringRenderer } from '../components/FeatAuthoringRenderer'
import {
  masterFeatFixture,
  ownedFeatFixture
} from '../feat.fixtures'

function FeatAuthoringHarness({
  feat,
  readOnly = false
}: {
  feat: FeatAuthoringInputDto | FeatAuthoredDto
  readOnly?: boolean
}) {
  return (
    <AuthoringFormProvider>
      <FeatAuthoringHarnessContent feat={feat} readOnly={readOnly} />
    </AuthoringFormProvider>
  )
}

function FeatAuthoringHarnessContent({
  feat,
  readOnly
}: {
  feat: FeatAuthoringInputDto | FeatAuthoredDto
  readOnly: boolean
}) {
  const form = useAppForm({
    defaultValues: feat,
    onSubmit: async ({ value }) => {
      normalizeFeatForSubmit(value)
    }
  })
  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Feat',
    canCopy: readOnly,
    canSaveDraft: !readOnly,
    hasActiveDraft: false,
    mapId: 'feat',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Feat',
    subjectLabel: feat.label || 'Untitled Feat',
    systemId: feat.systemId
  }), [
    feat.label,
    feat.systemId,
    readOnly
  ])
  const actions = useMemo<AuthoringFormActionHandlers>(() => ({
    onActivate: () => form.handleSubmit(),
    onClearPaths: (paths) => clearResolvedNodeFormPaths(form, paths),
    onCopy: readOnly ? () => undefined : undefined,
    onSaveDraft: readOnly ? undefined : () => undefined
  }), [
    form,
    readOnly
  ])

  useAuthoringFormRegistration(registration, actions)

  return (
    <form.AppForm>
      <AuthoringFormLayout>
        <FeatAuthoringRenderer form={form} resolveModel={false} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

describe('Feat authoring renderer', () => {
  it('renders locked master view as read-only with duplicate affordance', () => {
    renderWithAppProviders(
      <FeatAuthoringHarness
        feat={masterFeatFixture}
        readOnly
      />
    )

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveAttribute('readonly')
  })

  it('adds and edits a feat-owned feature basics item', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <FeatAuthoringHarness
        feat={{
          ...ownedFeatFixture,
          features: []
        }}
      />
    )

    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /add feature/i }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByRole('heading', { name: /^features$/i }).length).toBeGreaterThan(0)
    await user.type(within(dialog).getByRole('textbox', { name: /name/i }), 'Opening Read')
    expect(within(dialog).getByLabelText(/description/i)).toHaveAttribute('contenteditable', 'true')
    await user.click(within(dialog).getByRole('button', { name: /^save$/i }))

    expect(screen.getByRole('button', { name: /edit features 1/i })).toBeInTheDocument()
  }, 10000)
})
