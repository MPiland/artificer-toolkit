import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { AuthoringLayoutContent } from './AuthoringLayout'
import type { AuthoringFormStoreContextValue } from './AuthoringFormContext'
import { useAuthoredFormInstance } from './useAuthoredFormInstance'

type TestSession = {
  initialValues: { label: string }
  key: string
}

const mocks = vi.hoisted(() => ({
  authoring: {} as Record<string, unknown>,
  formStore: undefined as AuthoringFormStoreContextValue | undefined,
  saveDraft: undefined as (() => Promise<void>) | undefined,
  saveDraftValues: vi.fn<(values: object) => Promise<boolean>>(),
  session: undefined as TestSession | undefined
}))

vi.mock('./AuthoringFormContext', () => ({
  useAuthoringActions: () => mocks.authoring,
  useAuthoringFormStore: () => mocks.formStore,
  useAuthoringNavigation: () => mocks.authoring,
  useAuthoringSession: () => mocks.authoring
}))
vi.mock('./useAuthoringExperience', () => ({
  useAuthoringExperience: () => ({
    experience: 'guided',
    isUpdating: false,
    setExperience: vi.fn()
  })
}))
vi.mock('./useAuthoringSaveShortcut', () => ({ useAuthoringSaveShortcut: () => undefined }))
vi.mock('#app/shell', () => ({ useShellHeaderSupplement: () => undefined }))
vi.mock('#domains/characters/builder/core/CharacterBuilderAuthoringRuntime', () => ({
  CharacterBuilderAuthoringRuntime: () => null
}))
vi.mock('./Steps/Steps', () => ({ Steps: () => null }))
vi.mock('./Previews/Previews', () => ({ Previews: () => null }))
vi.mock('./Actions/ResetFormConfirmation', () => ({ ResetFormConfirmation: () => null }))
vi.mock('./Editor/Editor', () => ({
  Editor: ({ children, showActivate }: { children?: ReactNode; showActivate: boolean }) => (
    <div data-show-activate={String(showActivate)} data-testid='editor'>
      {children}
    </div>
  )
}))
vi.mock('../guided/GuidedAuthoring', () => ({
  GuidedAuthoring: ({
    onStateChange
  }: {
    onStateChange: (state: { isReview: boolean; showPreview: boolean }) => void
  }) => (
    <button onClick={() => onStateChange({ isReview: true, showPreview: false })}>
      enter review
    </button>
  )
}))
vi.mock('../rendering/FormRenderer', () => ({
  FormRenderer:
    () =>
    ({
      canvasContent,
      form
    }: {
      canvasContent?: ReactNode
      form: {
        Field: (props: {
          children: (field: {
            handleChange: (value: string) => void
            state: { value: string; meta: { errors: readonly unknown[] } }
          }) => ReactNode
          name: string
        }) => ReactNode
      }
    }) => (
      <>
        {canvasContent}
        <form.Field name='label'>
          {(field) => (
            <>
              <input
                aria-label='Label'
                value={field.state.value}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <span role='alert'>{field.state.meta.errors.join(' ')}</span>
            </>
          )}
        </form.Field>
      </>
    )
}))

function session(key: string, label: string): TestSession {
  return { key, initialValues: { label } }
}

function setSession({ key, initialValues }: TestSession) {
  mocks.session = { key, initialValues }
  mocks.authoring = {
    authoredSession: {
      domain: 'spell',
      fallbackLabel: 'Untitled Item',
      hasActiveDraft: false,
      hasInvalidDraft: false,
      initialValues,
      invalidDraftOnly: false,
      isDraft: false,
      key,
      mapId: 'spell',
      mode: 'create',
      notFound: false,
      provenanceKind: null,
      readOnly: false,
      subjectKindLabel: 'Spell',
      system: { rulesetCode: 'dnd5e', rulesetVersion: '2014' },
      systemId: 'system-1',
      systemRequired: false,
      systems: []
    },
    hasActiveDraft: false,
    isDraft: false,
    mode: 'create',
    subjectKindLabel: 'Spell',
    subjectLabel: 'Spell',
    visibleSteps: []
  }
}

/** Owns the session's real authored form, as `AuthoringFormProvider` does, around the layout. */
function LayoutHarness() {
  const { form, saveDraft } = useAuthoredFormInstance({
    activateValues: async () => undefined,
    clearValidationIssues: () => undefined,
    saveDraftValues: mocks.saveDraftValues,
    session: mocks.session
  })
  mocks.formStore = { form, isMutating: false }
  mocks.saveDraft = saveDraft
  return <AuthoringLayoutContent />
}

function renderLayout(initial: TestSession) {
  setSession(initial)
  const view = renderWithAppProviders(<LayoutHarness />)
  return {
    switchSession(next: TestSession) {
      setSession(next)
      view.rerender(<LayoutHarness />)
    }
  }
}

function labelInput() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Label' })
}

function saveDraft() {
  if (!mocks.saveDraft) throw new Error('Expected the authored form to be mounted.')
  return mocks.saveDraft()
}

describe('AuthoringLayout session defaults', () => {
  beforeEach(() => {
    mocks.saveDraftValues.mockReset().mockResolvedValue(true)
  })

  it('shows the first session values and keeps an in-progress edit when the same session re-renders with fresh props', () => {
    const view = renderLayout(session('spell-a', 'Fireball'))
    expect(labelInput()).toHaveValue('Fireball')

    fireEvent.change(labelInput(), { target: { value: 'Fireball, edited' } })
    view.switchSession(session('spell-a', 'Server refreshed label'))

    expect(labelInput()).toHaveValue('Fireball, edited')
  })

  it('loads the new initial values and drops edits when the session key changes', () => {
    const view = renderLayout(session('spell-a', 'Fireball'))
    fireEvent.change(labelInput(), { target: { value: 'Fireball, edited' } })

    view.switchSession(session('spell-b', 'Magic Missile'))

    expect(labelInput()).toHaveValue('Magic Missile')
  })

  it('keeps the saved values as the form baseline after a draft save', async () => {
    const view = renderLayout(session('spell-a', 'Fireball'))
    fireEvent.change(labelInput(), { target: { value: 'Saved label' } })

    await act(async () => {
      await saveDraft()
    })
    expect(mocks.saveDraftValues).toHaveBeenCalledWith({ label: 'Saved label' })
    expect(labelInput()).toHaveValue('Saved label')

    view.switchSession(session('spell-a', 'Fireball'))
    expect(labelInput()).toHaveValue('Saved label')
  })
})

describe('AuthoringLayout guided state', () => {
  it('forgets the guided review step when the session key changes but not on other re-renders', () => {
    const view = renderLayout(session('spell-a', 'Fireball'))
    expect(screen.getByTestId('editor')).toHaveAttribute('data-show-activate', 'false')

    fireEvent.click(screen.getByRole('button', { name: 'enter review' }))
    expect(screen.getByTestId('editor')).toHaveAttribute('data-show-activate', 'true')

    view.switchSession(session('spell-a', 'Fireball'))
    expect(screen.getByTestId('editor')).toHaveAttribute('data-show-activate', 'true')

    view.switchSession(session('spell-b', 'Magic Missile'))
    expect(screen.getByTestId('editor')).toHaveAttribute('data-show-activate', 'false')
  })

  it('refuses to save a draft with a blank label and marks the label field', async () => {
    mocks.saveDraftValues.mockReset().mockResolvedValue(true)
    renderLayout(session('spell-a', 'Fireball'))
    fireEvent.change(labelInput(), { target: { value: '   ' } })

    await act(async () => {
      await saveDraft()
    })

    expect(mocks.saveDraftValues).not.toHaveBeenCalled()
    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required.')
  })
})
