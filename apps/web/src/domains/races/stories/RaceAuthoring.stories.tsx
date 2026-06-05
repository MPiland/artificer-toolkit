import { Outlet } from '@tanstack/react-router'
import type { Meta, StoryObj } from '@storybook/tanstack-react'
import {
  expect,
  userEvent,
  waitFor,
  within
} from 'storybook/test'
import { routeTree } from '#app/routeTree.gen'
import { RaceEditPage } from '../pages/RaceEditPage'
import {
  activeLockedScenario,
  authenticatedDraftEditScenario,
  createRaceLoaderData,
  draftSaveFailureScenario,
  draftSaveSuccessScenario,
  invalidDraftRecoveryScenario,
  longEdgeContentScenario,
  raceStoryHandlers,
  raceStoryUser,
  type RaceRouteStoryScenario
} from './raceRouteStoryScenarios'

const routePath = '/races/$racePublicId/$raceSlug/edit' as const
const parentRouteId = '/_authed/races/$racePublicId/$raceSlug' as const

function StoryRootDocument() {
  return <Outlet />
}

const meta = {
  title: 'Domains/Races/Authoring Route',
  component: RaceEditPage,
  parameters: {
    docs: {
      description: {
        component: 'Route-backed race edit stories render the real TanStack route/page with mocked route loader data, query context, and MSW API behavior.'
      }
    }
  }
} satisfies Meta<typeof RaceEditPage>

export default meta

type Story = StoryObj<typeof meta>

function raceRouteParameters(scenario: RaceRouteStoryScenario): NonNullable<Story['parameters']> {
  return {
    layout: 'fullscreen',
    msw: {
      handlers: raceStoryHandlers(scenario)
    },
    tanstack: {
      router: {
        route: routeTree,
        path: routePath,
        params: scenario.params,
        routeOverrides: {
          __root__: {
            beforeLoad: () => ({ user: raceStoryUser }),
            component: StoryRootDocument
          },
          '/_authed': {
            beforeLoad: () => undefined
          },
          [parentRouteId]: {
            loader: () => createRaceLoaderData(scenario)
          }
        }
      }
    }
  } as unknown as NonNullable<Story['parameters']>
}

export const AuthenticatedDraftEdit: Story = {
  parameters: raceRouteParameters(authenticatedDraftEditScenario)
}

export const ActiveLockedReadonly: Story = {
  parameters: raceRouteParameters(activeLockedScenario)
}

export const DraftSaveSuccess: Story = {
  parameters: raceRouteParameters(draftSaveSuccessScenario),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nameInput = await canvas.findByLabelText(/name/i)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Dragonborn Copy Saved')
    await userEvent.click(canvas.getByRole('button', { name: /save draft/i }))

    await waitFor(() => {
      expect(canvas.getByText(/race draft saved/i)).toBeInTheDocument()
    })
  }
}

export const DraftSaveFailure: Story = {
  parameters: raceRouteParameters(draftSaveFailureScenario),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const nameInput = await canvas.findByLabelText(/name/i)
    await userEvent.clear(nameInput)
    await userEvent.type(nameInput, 'Dragonborn Copy Failed')
    await userEvent.click(canvas.getByRole('button', { name: /save draft/i }))

    await waitFor(() => {
      expect(canvas.getByText(/could not save that draft yet/i)).toBeInTheDocument()
    })
  }
}

export const InvalidDraftRecovery: Story = {
  parameters: raceRouteParameters(invalidDraftRecoveryScenario),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)

    await expect(await canvas.findByText(/saved draft no longer matches/i)).toBeInTheDocument()
  }
}

export const LongEdgeContentLayoutStress: Story = {
  parameters: raceRouteParameters(longEdgeContentScenario)
}

export const MobileOpenStructureRail: Story = {
  parameters: {
    ...raceRouteParameters(authenticatedDraftEditScenario),
    viewport: {
      defaultViewport: 'mobile2'
    }
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(await canvas.findByRole('button', { name: /structure/i }))

    await expect(await canvas.findByText(/dragonborn copy/i)).toBeInTheDocument()
  }
}
