import { useMemo } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  BackgroundAuthoringInputDto,
  BackgroundAuthoredDto
} from '@artificer-toolkit/schema/subjects/background'
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
import {
  normalizeBackgroundForSubmit
} from '../backgroundAuthoring.utils'
import { BackgroundAuthoringRenderer } from '../components/BackgroundAuthoringRenderer'
import {
  masterBackgroundFixture,
  ownedBackgroundFixture
} from '../background.fixtures'

function BackgroundAuthoringHarness({
  background,
  readOnly = false
}: {
  background: BackgroundAuthoringInputDto | BackgroundAuthoredDto
  readOnly?: boolean
}) {
  return (
    <AuthoringFormProvider>
      <BackgroundAuthoringHarnessContent background={background} readOnly={readOnly} />
    </AuthoringFormProvider>
  )
}

function BackgroundAuthoringHarnessContent({
  background,
  readOnly
}: {
  background: BackgroundAuthoringInputDto | BackgroundAuthoredDto
  readOnly: boolean
}) {
  const form = useAppForm({
    defaultValues: background,
    onSubmit: async ({ value }) => {
      normalizeBackgroundForSubmit(value)
    }
  })
  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Background',
    canCopy: readOnly,
    canSaveDraft: !readOnly,
    hasActiveDraft: false,
    mapId: 'background',
    mode: readOnly ? 'view' : 'edit',
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Background',
    subjectLabel: background.label || 'Untitled Background',
    systemId: background.systemId
  }), [
    background.label,
    background.systemId,
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
        <BackgroundAuthoringRenderer form={form} resolveModel={false} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

describe('Background authoring renderer', () => {
  it('renders locked master view as read-only with duplicate affordance', () => {
    renderWithAppProviders(
      <BackgroundAuthoringHarness
        background={masterBackgroundFixture}
        readOnly
      />
    )

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveAttribute('readonly')
  })

  it('adds and edits a resolved detail group item', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <BackgroundAuthoringHarness
        background={{
          ...ownedBackgroundFixture,
          details: []
        }}
      />
    )

    await user.click(screen.getByRole('button', { name: /next/i }))
    await user.click(screen.getByRole('button', { name: /add detail/i }))

    const detailNameFields = screen.getAllByRole('textbox', { name: /name/i })
    await user.type(detailNameFields[detailNameFields.length - 1], 'Local Friend')

    expect(detailNameFields[detailNameFields.length - 1]).toHaveValue('Local Friend')
  }, 10000)
})
