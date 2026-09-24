import type { Meta, StoryObj } from '@storybook/tanstack-react'
import { expect, waitFor } from 'storybook/test'
import { RaceDetailPage } from '#domains/races/pages/RaceDetailPage'
import {
  activeRaceDetailLoaderData,
  draftRaceDetailLoaderData,
  raceRouteStoryUser
} from './raceRouteStoryData'

const meta = {
  title: 'Domains/Races/Pages/Detail',
  component: RaceDetailPage,
  args: {
    draft: activeRaceDetailLoaderData.draft,
    raceId: activeRaceDetailLoaderData.raceId,
    response: activeRaceDetailLoaderData.response,
    view: activeRaceDetailLoaderData.view
  },
  parameters: {
    layout: 'fullscreen',
    tanstack: {
      router: {
        context: {
          user: raceRouteStoryUser
        }
      }
    }
  }
} satisfies Meta<typeof RaceDetailPage>

export default meta

type Story = StoryObj<typeof meta>

export const Active: Story = {
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByRole('heading', { name: /^dragonborn$/i })).toBeInTheDocument()
    })
    await expect(canvas.getByText(/ability score increase/i)).toBeInTheDocument()
  }
}

export const Draft: Story = {
  args: {
    draft: draftRaceDetailLoaderData.draft,
    raceId: draftRaceDetailLoaderData.raceId,
    response: draftRaceDetailLoaderData.response,
    view: draftRaceDetailLoaderData.view
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByRole('heading', { name: /^dragonborn$/i })).toBeInTheDocument()
    })
    await expect(canvas.getByText(/^draft$/i)).toBeInTheDocument()
  }
}
