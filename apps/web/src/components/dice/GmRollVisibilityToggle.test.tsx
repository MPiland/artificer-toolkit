import { convexQuery } from '@convex-dev/react-query'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getFunctionName } from 'convex/server'
import { describe, expect, it, vi } from 'vitest'
import type { RollVisibilityDto } from '@artificer-toolkit/schema/api/rolls'
import { GmRollVisibilityToggle } from './GmRollVisibilityToggle'

const setGmRollVisibility = vi.hoisted(() => vi.fn().mockResolvedValue(null))

vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) => {
    if (getFunctionName(reference) !== 'account:setGmRollVisibility')
      throw new Error('Unexpected mutation')
    return setGmRollVisibility
  }
}))

function renderToggle(stored?: RollVisibilityDto) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } }
  })
  const key = convexQuery(convexApi.account.rollPreferences, {}).queryKey
  if (stored) client.setQueryData(key, { autoRollDice: true, gmRollVisibility: stored })
  else client.setQueryDefaults(key, { queryFn: () => new Promise(() => undefined) })
  render(
    <MantineProvider>
      <QueryClientProvider client={client}>
        <GmRollVisibilityToggle />
      </QueryClientProvider>
    </MantineProvider>
  )
  return { client, key }
}

describe('GmRollVisibilityToggle', () => {
  it('starts on Public before the preference loads', () => {
    renderToggle()
    expect(screen.getByRole('radio', { name: 'Public' })).toBeChecked()
  })

  it('shows the stored choice and saves a change on the profile', async () => {
    const user = userEvent.setup()
    const { client, key } = renderToggle('PUBLIC')
    await user.click(screen.getByRole('radio', { name: 'Private' }))

    expect(setGmRollVisibility).toHaveBeenCalledWith({ gmRollVisibility: 'PRIVATE' })
    expect(screen.getByRole('radio', { name: 'Private' })).toBeChecked()
    await waitFor(() =>
      expect(client.getQueryData(key)).toEqual({ autoRollDice: true, gmRollVisibility: 'PRIVATE' })
    )
  })

  it('reflects a stored Private choice', () => {
    renderToggle('PRIVATE')
    expect(screen.getByRole('radio', { name: 'Private' })).toBeChecked()
  })
})
