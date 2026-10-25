import { act, fireEvent, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { renderWithAppProviders } from '#test/renderWithAppProviders'
import { AuthoringLayoutContent } from './AuthoringLayout'
import type { AuthoringFormActionHandlers } from './AuthoringFormContext'

type TestSession = {
  initialValues: { label: string }
  key: string
}

const mocks = vi.hoisted(() => ({
  authoring: {} as Record<string, unknown>,
  updateAuthoringFormActions: vi.fn<(actions: AuthoringFormActionHandlers) => void>(),
  saveDraftValues: vi.fn<(values: object) => Promise<boolean>>()
}))

vi.mock('./AuthoringFormContext', () => ({
  useAuthoringForm: () => mocks.authoring
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
            state: { value: string }
          }) => ReactNode
          name: string
        }) => ReactNode
      }
    }) => (
      <>
        {canvasContent}
        <form.Field name='label'>
          {(field) => (
            <input
              aria-label='Label'
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
          )}
        </form.Field>
      </>
    )
}))

function session(key: string, label: string): TestSession {
  return { key, initialValues: { label } }
}

function setSession({ key, initialValues }: TestSession) {
  mocks.authoring = {
    activateValues: vi.fn(),
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
    clearValidationIssues: vi.fn(),
    hasActiveDraft: false,
    isDraft: false,
    mode: 'create',
    saveDraftValues: mocks.saveDraftValues,
    subjectKindLabel: 'Spell',
    subjectLabel: 'Spell',
    updateAuthoringFormActions: mocks.updateAuthoringFormActions,
    visibleSteps: []
  }
}

function renderLayout(initial: TestSession) {
  setSession(initial)
  const view = renderWithAppProviders(<AuthoringLayoutContent />)
  return {
    switchSession(next: TestSession) {
      setSession(next)
      view.rerender(<AuthoringLayoutContent />)
    }
  }
}

function labelInput() {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Label' })
}

function lastActions() {
  const actions = mocks.updateAuthoringFormActions.mock.lastCall?.[0]
  if (!actions) throw new Error('Expected the layout to register form actions.')
  return actions
}

describe('AuthoringLayout session defaults', () => {
  beforeEach(() => {
    mocks.updateAuthoringFormActions.mockClear()
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
      await lastActions().onSaveDraft?.()
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
})
