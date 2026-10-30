import { act, fireEvent, render, screen } from '@testing-library/react'
import { AuthoringLayoutProvider } from './AuthoringLayoutProvider'
import { useAuthoringLayout } from './AuthoringLayoutContext'

vi.mock('./AuthoringFormContext', () => ({
  useAuthoringSession: () => ({
    subjectKindLabel: 'Spell',
    subjectLabel: 'Fireball',
    hasActiveDraft: false,
    characterSession: undefined,
    mode: 'create',
    isDraft: false
  }),
  useAuthoringNavigation: () => ({
    activeNavigationTarget: undefined,
    activeStep: undefined,
    activeStepId: undefined,
    activeStepLabel: undefined,
    visibleSteps: []
  })
}))

const originalMatchMedia = window.matchMedia
let compactViewport = false
const changeListeners = new Set<(event: { matches: boolean }) => void>()

function setCompactViewport(compact: boolean) {
  compactViewport = compact
  act(() => changeListeners.forEach((listener) => listener({ matches: compactViewport })))
}

function LayoutProbe() {
  const layout = useAuthoringLayout()
  return (
    <>
      <output data-testid='steps'>{String(layout.stepsNavigationOpen)}</output>
      <output data-testid='preview'>{String(layout.previewOpen)}</output>
      <button onClick={layout.toggleStepsNavigation}>toggle steps</button>
      <button onClick={layout.togglePreview}>toggle preview</button>
    </>
  )
}

function renderProvider() {
  return render(
    <AuthoringLayoutProvider>
      <LayoutProbe />
    </AuthoringLayoutProvider>
  )
}

describe('AuthoringLayoutProvider viewport sync', () => {
  beforeEach(() => {
    changeListeners.clear()
    window.matchMedia = ((query: string) => ({
      get matches() {
        return compactViewport
      },
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type: string, listener: (event: { matches: boolean }) => void) =>
        changeListeners.add(listener),
      removeEventListener: (_type: string, listener: (event: { matches: boolean }) => void) =>
        changeListeners.delete(listener),
      dispatchEvent: () => false
    })) as unknown as typeof window.matchMedia
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    compactViewport = false
  })

  it('opens the steps navigation and the preview on a wide desktop', () => {
    compactViewport = false
    renderProvider()

    expect(screen.getByTestId('steps')).toHaveTextContent('true')
    expect(screen.getByTestId('preview')).toHaveTextContent('true')
  })

  it('starts with both panels closed on a compact viewport', () => {
    compactViewport = true
    renderProvider()

    expect(screen.getByTestId('steps')).toHaveTextContent('false')
    expect(screen.getByTestId('preview')).toHaveTextContent('false')
  })

  it('closes both panels when the viewport becomes compact and reopens them when wide again', () => {
    renderProvider()

    setCompactViewport(true)
    expect(screen.getByTestId('steps')).toHaveTextContent('false')
    expect(screen.getByTestId('preview')).toHaveTextContent('false')

    setCompactViewport(false)
    expect(screen.getByTestId('steps')).toHaveTextContent('true')
    expect(screen.getByTestId('preview')).toHaveTextContent('true')
  })

  it('keeps a manual toggle across unrelated re-renders and only re-syncs when the viewport changes', () => {
    renderProvider()

    fireEvent.click(screen.getByRole('button', { name: 'toggle steps' }))
    fireEvent.click(screen.getByRole('button', { name: 'toggle preview' }))
    expect(screen.getByTestId('steps')).toHaveTextContent('false')
    expect(screen.getByTestId('preview')).toHaveTextContent('false')

    act(() => changeListeners.forEach((listener) => listener({ matches: compactViewport })))
    expect(screen.getByTestId('steps')).toHaveTextContent('false')
    expect(screen.getByTestId('preview')).toHaveTextContent('false')

    setCompactViewport(true)
    setCompactViewport(false)
    expect(screen.getByTestId('steps')).toHaveTextContent('true')
    expect(screen.getByTestId('preview')).toHaveTextContent('true')
  })
})
