import { useMemo } from 'react'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  RaceAuthoringInputDto,
  RaceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
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
  normalizeRaceForSubmit,
  toRaceFormValues
} from '../raceAuthoring.utils'
import { RaceAuthoringRenderer } from '../components/RaceAuthoringRenderer'
import {
  masterRaceFixture,
  ownedSubraceFixture,
  raceRuntimeFixture
} from '../race.fixtures'

function RaceAuthoringHarness({
  race,
  readOnly = false
}: {
  race: RaceAuthoringInputDto | RaceAuthoredDto
  readOnly?: boolean
}) {
  return (
    <AuthoringFormProvider>
      <RaceAuthoringHarnessContent race={race} readOnly={readOnly} />
    </AuthoringFormProvider>
  )
}

function RaceAuthoringHarnessContent({
  race,
  readOnly
}: {
  race: RaceAuthoringInputDto | RaceAuthoredDto
  readOnly: boolean
}) {
  const formValues = toRaceFormValues(race)
  const form = useAppForm({
    defaultValues: formValues,
    onSubmit: async ({ value }) => {
      normalizeRaceForSubmit(value)
    }
  })
  const registration = useMemo<AuthoringFormRegistration>(() => ({
    activateLabel: 'Activate Race',
    canCopy: readOnly,
    canSaveDraft: !readOnly,
    hasActiveDraft: false,
    mapId: 'race',
    mode: readOnly ? 'view' : 'edit',
    providedModel: raceRuntimeFixture,
    readOnly,
    resolveModel: false,
    saveDraftLabel: 'Save Draft',
    subjectKindLabel: 'Race',
    subjectLabel: formValues.label || 'Untitled Race',
    systemId: formValues.systemId
  }), [
    formValues.label,
    formValues.systemId,
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
        <RaceAuthoringRenderer form={form} resolveModel={false} />
      </AuthoringFormLayout>
    </form.AppForm>
  )
}

describe('Race authoring renderer', () => {
  it('renders locked master view as read-only with duplicate affordance', () => {
    renderWithAppProviders(
      <RaceAuthoringHarness
        race={masterRaceFixture}
        readOnly
      />
    )

    expect(screen.getByText(/locked for direct editing/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /duplicate to edit/i })).toBeEnabled()
    expect(screen.getByRole('textbox', { name: /category/i })).toHaveAttribute('readonly')
  })

  it('uses subrace content steps without the base ancestry step', async () => {
    const user = userEvent.setup()

    renderWithAppProviders(
      <RaceAuthoringHarness race={ownedSubraceFixture} />
    )

    expect(screen.queryByRole('button', { name: /ancestry/i })).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /parent race/i })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /next/i }))
    expect(screen.getByRole('heading', { level: 2, name: /traits/i })).toBeInTheDocument()
  })
})
