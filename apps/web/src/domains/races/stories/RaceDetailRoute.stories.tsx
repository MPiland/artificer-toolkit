import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, waitFor } from 'storybook/test'
import { Route } from '#routes/_authed/races/$racePublicId/$raceSlug/index'
import {
  activeRaceDetailLoaderData,
  draftRaceDetailLoaderData,
  raceRouteStoryParams,
  raceRouteStoryUser
} from './raceRouteStoryData'

const activeRouteOverrides = {
  '/_authed/races/$racePublicId/$raceSlug/': {
    component: undefined,
    loader: async () => activeRaceDetailLoaderData
  }
}

const draftRouteOverrides = {
  '/_authed/races/$racePublicId/$raceSlug/': {
    component: undefined,
    loader: async () => draftRaceDetailLoaderData
  }
}

const meta = {
  title: 'Domains/Races/Routes/Detail',
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        route: Route,
        path: '/races/dragonborn/dragonborn/' as '/races/$racePublicId/$raceSlug/',
        params: raceRouteStoryParams,
        context: {
          user: raceRouteStoryUser
        },
        routeOverrides: activeRouteOverrides
      }
    }
  }
} satisfies Meta<typeof Route>

export default meta

type Story = StoryObj<typeof meta>

export const Active: Story = {
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole('heading', { name: /^dragonborn$/i })).toBeInTheDocument()
    })
    expect(canvas.getByText(/ability score increase/i)).toBeInTheDocument()
  }
}

export const Draft: Story = {
  parameters: {
    tanstack: {
      router: {
        query: { view: 'draft' },
        routeOverrides: draftRouteOverrides
      }
    }
  },
  play: async ({ canvas }) => {
    await waitFor(() => {
      expect(canvas.getByRole('heading', { name: /^dragonborn$/i })).toBeInTheDocument()
    })
    expect(canvas.getByText(/^draft$/i)).toBeInTheDocument()
  }
}
