import { useEffect, type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { useAuthoringForm } from './AuthoringFormContext'
import { AuthoringFormProvider } from './AuthoringFormProvider'

describe('AuthoringFormProvider domain registration', () => {
  it('registers authored form domain metadata from registerDomain', async () => {
    render(
      <ProviderHarness>
        <DomainRegistrationProbe />
      </ProviderHarness>
    )

    await waitFor(() => {
      expect(screen.getByTestId('domain').textContent).toBe('race')
    })
    expect(screen.getByTestId('map-id').textContent).toBe('race')
    expect(screen.getByTestId('subject-kind').textContent).toBe('Race')
    expect(screen.getByTestId('fallback-label').textContent).toBe('Untitled Race')
  })

  it('hydrates factory metadata after the domain is registered', async () => {
    render(
      <ProviderHarness>
        <RegistrationProbe />
      </ProviderHarness>
    )

    await waitFor(() => {
      expect(screen.getByTestId('domain').textContent).toBe('spell')
    })
    expect(screen.getByTestId('map-id').textContent).toBe('spell')
    expect(screen.getByTestId('subject-kind').textContent).toBe('Spell')
  })

  it('resolves an authored form session from domain loader data', async () => {
    render(
      <ProviderHarness>
        <DomainDataRegistrationProbe />
      </ProviderHarness>
    )

    await waitFor(() => {
      expect(screen.getByTestId('session-key').textContent).toBe('race:create:system-1')
    })
    expect(screen.getByTestId('system-id').textContent).toBe('system-1')
  })

  it('derives visible step state and navigation from the resolved model', async () => {
    const user = userEvent.setup()

    render(
      <ProviderHarness>
        <StepStateProbe />
      </ProviderHarness>
    )

    await waitFor(() => {
      expect(screen.getByTestId('active-step').textContent).toBe('Basics')
    })
    expect(screen.getByTestId('step-count').textContent).toBe('2')
    expect(screen.getByTestId('first-step').textContent).toBe('true')
    expect(screen.getByTestId('last-step').textContent).toBe('false')

    await user.click(screen.getByRole('button', { name: /next/i }))

    await waitFor(() => {
      expect(screen.getByTestId('active-step').textContent).toBe('Details')
    })
    expect(screen.getByTestId('first-step').textContent).toBe('false')
    expect(screen.getByTestId('last-step').textContent).toBe('true')

    await user.click(screen.getByRole('button', { name: /previous/i }))

    await waitFor(() => {
      expect(screen.getByTestId('active-step').textContent).toBe('Basics')
    })
  })
})

const providerStepModel = {
  mapId: 'provider-steps',
  clearPaths: [],
  steps: [
    {
      id: 'basics',
      label: 'Basics',
      order: 1,
      sections: [
        {
          id: 'basics-section',
          label: 'Basics',
          order: 1,
          nodes: [
            {
              id: 'name',
              path: ['name'],
              label: 'Name',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: true,
              clearPaths: []
            }
          ]
        }
      ]
    },
    {
      id: 'hidden',
      label: 'Hidden',
      order: 2,
      sections: [
        {
          id: 'hidden-section',
          label: 'Hidden',
          order: 1,
          nodes: [
            {
              id: 'hidden-name',
              path: ['hiddenName'],
              label: 'Hidden Name',
              kind: 'INPUT',
              type: 'TEXT',
              visible: false,
              required: false,
              clearPaths: []
            }
          ]
        }
      ]
    },
    {
      id: 'details',
      label: 'Details',
      order: 3,
      sections: [
        {
          id: 'details-section',
          label: 'Details',
          order: 1,
          nodes: [
            {
              id: 'notes',
              path: ['notes'],
              label: 'Notes',
              kind: 'INPUT',
              type: 'TEXT',
              visible: true,
              required: false,
              clearPaths: []
            }
          ]
        }
      ]
    }
  ]
} satisfies NodeRuntimeResolveResponseDto

function ProviderHarness({ children }: { children: ReactNode }) {
  return (
    <TestRouterProvider>
      <AuthoringFormProvider>{children}</AuthoringFormProvider>
    </TestRouterProvider>
  )
}

function DomainRegistrationProbe() {
  const authoring = useAuthoringForm()
  const { registerDomain } = authoring

  useEffect(() => {
    registerDomain('race')
  }, [registerDomain])

  return (
    <>
      <div data-testid='domain'>{authoring.domain}</div>
      <div data-testid='map-id'>{authoring.mapId}</div>
      <div data-testid='subject-kind'>{authoring.subjectKindLabel}</div>
      <div data-testid='fallback-label'>{authoring.fallbackLabel}</div>
    </>
  )
}

function RegistrationProbe() {
  const authoring = useAuthoringForm()
  const { registerDomain } = authoring

  useEffect(() => {
    registerDomain('spell')
  }, [registerDomain])

  return (
    <>
      <div data-testid='domain'>{authoring.domain}</div>
      <div data-testid='map-id'>{authoring.mapId}</div>
      <div data-testid='subject-kind'>{authoring.subjectKindLabel}</div>
    </>
  )
}

function DomainDataRegistrationProbe() {
  const authoring = useAuthoringForm()
  const { registerDomain } = authoring

  useEffect(() => {
    registerDomain({
      data: { systems: [{ id: 'system-1' }] },
      domain: 'race',
      mode: 'create'
    })
  }, [registerDomain])

  return (
    <>
      <div data-testid='session-key'>{authoring.authoredSession?.key}</div>
      <div data-testid='system-id'>{authoring.authoredSession?.systemId}</div>
    </>
  )
}

function StepStateProbe() {
  const authoring = useAuthoringForm()
  const { goToNextStep, goToPreviousStep, updateAuthoringFormState } = authoring

  useEffect(() => {
    updateAuthoringFormState({
      resolvedModel: providerStepModel
    })
  }, [updateAuthoringFormState])

  return (
    <>
      <div data-testid='active-step'>{authoring.activeStepLabel}</div>
      <div data-testid='step-count'>{authoring.visibleSteps.length}</div>
      <div data-testid='first-step'>{String(authoring.isFirstStep)}</div>
      <div data-testid='last-step'>{String(authoring.isLastStep)}</div>
      <button type='button' onClick={() => void goToNextStep()}>
        Next
      </button>
      <button type='button' onClick={() => void goToPreviousStep()}>
        Previous
      </button>
    </>
  )
}
