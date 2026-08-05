import { Suspense } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useRouterState } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { RaceCataloguePage } from '#domains/races/pages/RaceCataloguePage'
import {
  authoredCreateRouteLoaderData,
  authoredRouteStorySystem,
  createEditLoaderData
} from '#domains/authoredRouteStory.fixtures'
import { ownedBaseRaceResponseFixture } from '#domains/races/race.fixtures'
import { RaceDetailPage } from '#domains/races/pages/RaceDetailPage'
import { TestRouterProvider } from '#test/TestRouterProvider'
import { AuthoringLayout } from '../layout/AuthoringLayout'

const ownedDraftLoaderData = createEditLoaderData('race', 'ownedDraft')
const ownedDraft = ownedDraftLoaderData.authoringData.draft

if (!ownedDraft) throw new Error('Expected the race journey fixture to include a draft.')

const copiedRaceAuthoringData = {
  ...ownedDraftLoaderData.authoringData,
  response: null,
  draft: {
    ...ownedDraft,
    baseActiveUpdatedAt: null,
    draftState: 'DRAFT_ONLY' as const
  }
}
const ownedRace = ownedBaseRaceResponseFixture.item!

function GuidedRaceDestination() {
  return <AuthoringLayout data={copiedRaceAuthoringData} domain='race' mode='edit' />
}

function CatalogueJourney() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (pathname === '/races/new') {
    return (
      <AuthoringLayout
        data={authoredCreateRouteLoaderData.authoringData}
        domain='race'
        mode='create'
      />
    )
  }

  if (pathname.endsWith('/edit')) return <GuidedRaceDestination />

  return (
    <Suspense fallback={<span>Loading races…</span>}>
      <RaceCataloguePage />
    </Suspense>
  )
}

function DetailJourney() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  if (pathname.endsWith('/edit')) return <GuidedRaceDestination />

  return (
    <RaceDetailPage
      draft={null}
      raceId={ownedRace.id}
      references={{
        speeds: authoredRouteStorySystem.speeds.map((speed) => ({
          label: speed.label,
          value: speed.id
        }))
      }}
      response={ownedBaseRaceResponseFixture}
      view='active'
    />
  )
}

describe('Guided authored entry journeys', () => {
  it('opens the starting-point choice from catalogue Create', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/races'>
        <CatalogueJourney />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('button', { name: 'Create Race' }))

    expect(await screen.findByRole('heading', { name: 'How do you want to begin?' })).toHaveFocus()
  })

  it('opens Guided Basics after copying from the catalogue', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/races'>
        <CatalogueJourney />
      </TestRouterProvider>
    )

    const [elfRow] = await screen.findAllByRole('row', { name: /Elf/ })
    if (!elfRow) throw new Error('Expected the race catalogue to include Elf.')
    await user.click(within(elfRow).getByRole('button', { name: /Duplicate/i }))

    expect(await screen.findByRole('heading', { name: 'Start with the basics' })).toHaveFocus()
    expect(
      screen.queryByRole('heading', { name: 'How do you want to begin?' })
    ).not.toBeInTheDocument()
  })

  it('opens Guided Basics after copying from an item detail page', async () => {
    const user = userEvent.setup()

    render(
      <TestRouterProvider initialPath='/races/dragonborn/dragonborn'>
        <DetailJourney />
      </TestRouterProvider>
    )

    await user.click(await screen.findByRole('button', { name: 'Duplicate' }))

    expect(await screen.findByRole('heading', { name: 'Start with the basics' })).toHaveFocus()
    expect(
      screen.queryByRole('heading', { name: 'How do you want to begin?' })
    ).not.toBeInTheDocument()
  })
})
