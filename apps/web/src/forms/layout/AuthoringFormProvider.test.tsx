import { DND5E_SYSTEM_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { useEffect, useState, type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { useNavigate, useRouter, useRouterState } from '@tanstack/react-router'
import type { NodeRuntimeResolveResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { useAuthoringForm } from './AuthoringFormContext'
import { AuthoringFormProvider } from './AuthoringFormProvider'
import { characterBuilderPayloadFixture } from '#domains/characters/builder/fixtures/characterBuilder.fixtures'
import type { AuthoringNavigationTarget } from './authoringNavigation'
import { ShellReturnHrefContext } from '#app/shell/returnLocation'

const RACE_CREATE_REGISTRATION = {
  data: { system: { id: DND5E_SYSTEM_ID }, systems: [{ id: DND5E_SYSTEM_ID }] },
  domain: 'race',
  mode: 'create'
} as const

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
    const user = userEvent.setup()

    render(
      <ProviderHarness>
        <DomainDataRegistrationProbe />
      </ProviderHarness>
    )

    await waitFor(() => {
      expect(screen.getByTestId('session-key').textContent).toBe(`race:create:${DND5E_SYSTEM_ID}`)
    })
    expect(screen.getByTestId('system-id').textContent).toBe(DND5E_SYSTEM_ID)

    const sessionId = screen.getByTestId('session-id').textContent
    await user.click(screen.getByRole('button', { name: 'Register again' }))
    expect(screen.getByTestId('session-id').textContent).toBe(sessionId)
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

describe('AuthoringFormProvider unsaved navigation', () => {
  it('cancels a clean Character Builder session immediately', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/backgrounds'>
        <ShellReturnHrefContext value='/spells'>
          <AuthoringFormProvider data={{ systems: [] }} kind='character-builder' mode='create'>
            <CancelProbe hasChanges={false} />
          </AuthoringFormProvider>
        </ShellReturnHrefContext>
      </TestRouterProvider>
    )

    expect(screen.getByTestId('cancel-href').textContent).toBe('/spells')
    await user.click(screen.getByRole('button', { name: 'Cancel form' }))

    await waitFor(() => {
      expect(screen.getByTestId('history-pathname').textContent).toBe('/spells')
    })
    expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).not.toBeInTheDocument()
  })

  it('confirms a dirty authored-form cancellation without prompting twice', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/backgrounds'>
        <AuthoringFormProvider
          data={{ system: { id: DND5E_SYSTEM_ID }, systems: [{ id: DND5E_SYSTEM_ID }] }}
          domain='race'
          mode='create'
        >
          <CancelProbe hasChanges />
        </AuthoringFormProvider>
      </TestRouterProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-changes').textContent).toBe('true')
    })
    expect(screen.getByTestId('cancel-href').textContent).toBe('/races')

    await user.click(screen.getByRole('button', { name: 'Cancel form' }))
    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Stay' }))
    expect(screen.getByTestId('history-pathname').textContent).toBe('/backgrounds')
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Leave without saving?' })
      ).not.toBeInTheDocument()
    })

    await user.click(screen.getByRole('button', { name: 'Cancel form' }))
    await user.click(await screen.findByRole('button', { name: 'Leave without saving' }))

    await waitFor(() => {
      expect(screen.getByTestId('history-pathname').textContent).toBe('/races')
    })
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Leave without saving?' })
      ).not.toBeInTheDocument()
    })
  })

  it('confirms a dirty Character Builder cancellation', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/backgrounds'>
        <AuthoringFormProvider data={{ systems: [] }} kind='character-builder' mode='create'>
          <CancelProbe hasChanges />
        </AuthoringFormProvider>
      </TestRouterProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-changes').textContent).toBe('true')
    })

    await user.click(screen.getByRole('button', { name: 'Cancel form' }))
    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Leave without saving' }))

    await waitFor(() => {
      expect(screen.getByTestId('history-pathname').textContent).toBe('/characters')
    })
  })

  it('keeps a dirty authored form open when the user stays', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/backgrounds'>
        <AuthoringFormProvider
          data={{ system: { id: DND5E_SYSTEM_ID }, systems: [{ id: DND5E_SYSTEM_ID }] }}
          domain='race'
          mode='create'
        >
          <UnsavedNavigationProbe />
        </AuthoringFormProvider>
      </TestRouterProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-changes').textContent).toBe('true')
    })

    await user.click(screen.getByRole('button', { name: 'Navigate away' }))

    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()
    expect(screen.getByTestId('pathname').textContent).toBe('/backgrounds')

    await user.click(screen.getByRole('button', { name: 'Stay' }))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Leave without saving?' })
      ).not.toBeInTheDocument()
    })
    expect(screen.getByTestId('pathname').textContent).toBe('/backgrounds')
  })

  it('continues navigation when the user discards unsaved changes', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/backgrounds'>
        <AuthoringFormProvider
          data={{ system: { id: DND5E_SYSTEM_ID }, systems: [{ id: DND5E_SYSTEM_ID }] }}
          domain='race'
          mode='create'
        >
          <UnsavedNavigationProbe />
        </AuthoringFormProvider>
      </TestRouterProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-changes').textContent).toBe('true')
    })

    await user.click(screen.getByRole('button', { name: 'Navigate away' }))
    await screen.findByRole('dialog', { name: 'Leave without saving?' })
    await user.click(screen.getByRole('button', { name: 'Leave without saving' }))

    await waitFor(() => {
      expect(screen.getByTestId('history-pathname').textContent).toBe('/spells')
    })
  })

  it('does not apply the authored-form guard to Character Builder state', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/backgrounds'>
        <AuthoringFormProvider data={{ systems: [] }} kind='character-builder' mode='create'>
          <UnsavedNavigationProbe />
        </AuthoringFormProvider>
      </TestRouterProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('has-changes').textContent).toBe('true')
    })

    await user.click(screen.getByRole('button', { name: 'Navigate away' }))

    await waitFor(() => {
      expect(screen.getByTestId('pathname').textContent).toBe('/spells')
    })
    expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).not.toBeInTheDocument()
  })
})

describe('AuthoringFormProvider URL navigation', () => {
  it('uses the requested Character Builder step on the first render and follows history', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/backgrounds?source=owned&step=RACE'>
        <AuthoringFormProvider
          data={{
            characterId: characterBuilderPayloadFixture.character.id,
            draft: null,
            activeCharacter: characterBuilderPayloadFixture.character
          }}
          kind='character-builder'
          mode='edit'
        >
          <CharacterUrlNavigationProbe />
        </AuthoringFormProvider>
      </TestRouterProvider>
    )

    expect(screen.getByTestId('active-step-id').textContent).toBe('RACE')
    expect(screen.getByTestId('active-step-visited').textContent).toBe('true')
    await waitFor(() => {
      expect(screen.getByTestId('history-state').textContent).toContain(
        '"__authoringStepNavigation":true'
      )
    })

    await user.click(screen.getByRole('button', { name: 'Go to classes' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-step-id').textContent).toBe('CLASSES')
      expect(screen.getByTestId('search').textContent).toContain('"source":"owned"')
      expect(screen.getByTestId('search').textContent).toContain('"step":"classes"')
      expect(screen.getByTestId('history-state').textContent).toContain(
        '"__authoringStepNavigation":true'
      )
    })

    await user.click(screen.getByRole('button', { name: 'Go back' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-step-id').textContent).toBe('RACE')
      expect(screen.getByTestId('active-step-visited').textContent).toBe('true')
    })
  })

  it('co-commits an authored target with visited status without blocking step-only navigation', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/backgrounds?source=owned&step=step%3Arace%3Aroot%3Abasics'>
        <AuthoringFormProvider
          data={{ system: { id: DND5E_SYSTEM_ID }, systems: [{ id: DND5E_SYSTEM_ID }] }}
          domain='race'
          mode='create'
        >
          <AuthoredUrlNavigationProbe />
        </AuthoringFormProvider>
      </TestRouterProvider>
    )

    await waitFor(() => {
      expect(screen.getByTestId('active-target-id').textContent).toBe('step:race:root:basics')
      expect(screen.getByTestId('active-target-visited').textContent).toBe('true')
    })

    await user.click(screen.getByRole('button', { name: 'Go to details' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-target-id').textContent).toBe('step:race:root:details')
      expect(screen.getByTestId('active-target-visited').textContent).toBe('true')
      expect(screen.getByTestId('search').textContent).toContain('"source":"owned"')
    })
    expect(screen.queryByRole('dialog', { name: 'Leave without saving?' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove details target' }))

    await waitFor(() => {
      expect(screen.getByTestId('active-target-id').textContent).toBe('step:race:root:basics')
      expect(screen.getByTestId('search').textContent).toContain('"step":"step:race:root:basics"')
    })
  })
})

const providerStepModel = {
  mapId: 'provider-steps',
  clearPaths: [],
  scopes: [],
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
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: { exposure: 'author' }
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
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: { exposure: 'author' }
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
              hiddenBehavior: 'KEEP',
              clearPaths: [],
              authoring: { exposure: 'author' }
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
  const initialValues = authoring.authoredSession?.initialValues
  const initialSessionId = initialValues && 'id' in initialValues ? initialValues.id : undefined
  const sessionId =
    typeof initialSessionId === 'string' || typeof initialSessionId === 'number'
      ? String(initialSessionId)
      : ''

  useEffect(() => {
    registerDomain(RACE_CREATE_REGISTRATION)
  }, [registerDomain])

  return (
    <>
      <div data-testid='session-key'>{authoring.authoredSession?.key}</div>
      <div data-testid='session-id'>{sessionId}</div>
      <div data-testid='system-id'>{authoring.authoredSession?.systemId}</div>
      <button type='button' onClick={() => registerDomain(RACE_CREATE_REGISTRATION)}>
        Register again
      </button>
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

function UnsavedNavigationProbe() {
  const authoring = useAuthoringForm()
  const navigate = useNavigate()
  const router = useRouter()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const { updateAuthoringFormState } = authoring

  useEffect(() => {
    updateAuthoringFormState({ hasChanges: true })
  }, [updateAuthoringFormState])

  return (
    <>
      <div data-testid='has-changes'>{String(authoring.hasChanges)}</div>
      <div data-testid='pathname'>{pathname}</div>
      <div data-testid='history-pathname'>{router.history.location.pathname}</div>
      <button type='button' onClick={() => void navigate({ to: '/spells' })}>
        Navigate away
      </button>
    </>
  )
}

function CancelProbe({ hasChanges }: { hasChanges: boolean }) {
  const authoring = useAuthoringForm()
  const router = useRouter()
  const { updateAuthoringFormState } = authoring

  useEffect(() => {
    updateAuthoringFormState({ hasChanges })
  }, [hasChanges, updateAuthoringFormState])

  return (
    <>
      <div data-testid='cancel-href'>{authoring.cancelHref}</div>
      <div data-testid='has-changes'>{String(authoring.hasChanges)}</div>
      <div data-testid='history-pathname'>{router.history.location.pathname}</div>
      <button type='button' onClick={() => void authoring.cancel()}>
        Cancel form
      </button>
    </>
  )
}

function CharacterUrlNavigationProbe() {
  const authoring = useAuthoringForm()
  const router = useRouter()
  const search = useRouterState({ select: (state) => state.location.search })
  const historyState = useRouterState({ select: (state) => state.location.state })

  return (
    <>
      <div data-testid='active-step-id'>{authoring.activeStepId}</div>
      <div data-testid='active-step-visited'>
        {String(
          Boolean(authoring.activeStepId && authoring.visitedStepIds.has(authoring.activeStepId))
        )}
      </div>
      <div data-testid='search'>{JSON.stringify(search)}</div>
      <div data-testid='history-state'>{JSON.stringify(historyState)}</div>
      <button type='button' onClick={() => authoring.goToStep('CLASSES')}>
        Go to classes
      </button>
      <button
        type='button'
        onClick={async () => {
          router.history.back()
          await router.load()
        }}
      >
        Go back
      </button>
    </>
  )
}

const authoredNavigationTargets = [
  createAuthoringTarget('basics'),
  createAuthoringTarget('details')
]

function AuthoredUrlNavigationProbe() {
  const authoring = useAuthoringForm()
  const search = useRouterState({ select: (state) => state.location.search })
  const [includeDetails, setIncludeDetails] = useState(true)

  useEffect(() => {
    authoring.updateAuthoringFormState({
      hasChanges: true,
      navigationTargets: includeDetails
        ? authoredNavigationTargets
        : authoredNavigationTargets.slice(0, 1)
    })
  }, [authoring.updateAuthoringFormState, includeDetails])

  return (
    <>
      <div data-testid='active-target-id'>{authoring.activeNavigationTargetId}</div>
      <div data-testid='active-target-visited'>
        {String(
          Boolean(
            authoring.activeNavigationTargetId &&
            authoring.visitedStepIds.has(authoring.activeNavigationTargetId)
          )
        )}
      </div>
      <div data-testid='search'>{JSON.stringify(search)}</div>
      <button
        type='button'
        onClick={() => authoring.goToNavigationTarget('step:race:root:details')}
      >
        Go to details
      </button>
      <button type='button' onClick={() => setIncludeDetails(false)}>
        Remove details target
      </button>
    </>
  )
}

function createAuthoringTarget(stepId: string): AuthoringNavigationTarget {
  return {
    id: `step:race:root:${stepId}`,
    kind: 'step',
    label: stepId,
    mapId: 'race',
    ownedFieldPaths: [],
    stepId
  }
}
