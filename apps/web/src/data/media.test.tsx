import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { ConvexQueryClient } from '@convex-dev/react-query'
import { ConvexProvider, ConvexReactClient } from 'convex/react'
import type { ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { signedImageDeliveryDtoSchema } from '@artificer-toolkit/schema/api/media'
import { createAppQueryClient } from '#app/query/createAppQueryClient'
import { nativeArtwork, useMediaImage } from './media'

vi.mock('convex/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('convex/react')>()),
  // Session convergence happens after the private subscription reports revocation.
  useConvexAuth: () => ({ isAuthenticated: true, isLoading: false })
}))

it.each([
  'BACKGROUND',
  'CLASS',
  'FEAT',
  'EQUIPMENT',
  'RACE',
  'CREATURE',
  'SPELL',
  'VEHICLE'
] as const)('uses native artwork bindings for %s', (subjectKind) => {
  const target = {
    lookup: {
      type: 'AUTHORED_IMAGE' as const,
      subjectKind,
      subjectId: 'subject-id',
      scope: 'DRAFT' as const
    },
    attach: {
      type: 'AUTHORED_IMAGE' as const,
      subjectKind,
      subjectId: 'subject-id'
    }
  }
  expect(nativeArtwork(target)).toEqual(target.lookup)
})

it('hides a cached avatar and reports a revoked subscription without throwing during render', async () => {
  const client = new ConvexReactClient('https://example.convex.cloud')
  const binding = {
    assetId: 'a2c914ed-8628-4a69-831c-766d7df1ef63',
    revision: 1
  }
  const callbacks = new Set<() => void>()
  const denied = new Error('Unauthenticated')
  let revoked = false
  vi.spyOn(client, 'watchQuery').mockReturnValue({
    localQueryResult: () => {
      if (revoked) throw denied
      return binding
    },
    journal: () => undefined,
    onUpdate: (callback) => {
      callbacks.add(callback)
      return () => callbacks.delete(callback)
    }
  })
  vi.spyOn(client, 'query').mockResolvedValue(binding)
  const image = vi.spyOn(client, 'action').mockResolvedValue(
    signedImageDeliveryDtoSchema.parse({
      assetId: binding.assetId,
      variantKind: 'THUMBNAIL',
      url: 'https://example.com/avatar.webp',
      expiresAt: '2026-09-05T18:00:00.000Z',
      width: 320,
      height: 320,
      mimeType: 'image/webp',
      crop: null,
      altText: null,
      isDecorative: true
    })
  )
  const convex = new ConvexQueryClient(client)
  const queryClient = createAppQueryClient(convex)
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ConvexProvider client={client}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ConvexProvider>
  )
  const hook = renderHook(
    () =>
      useMediaImage(
        {
          lookup: { type: 'ACCOUNT_AVATAR' },
          attach: { type: 'ACCOUNT_AVATAR' }
        },
        'THUMBNAIL'
      ),
    { wrapper }
  )
  try {
    await waitFor(() =>
      expect(hook.result.current.data?.url).toBe('https://example.com/avatar.webp')
    )
    await act(async () => {
      revoked = true
      for (const callback of callbacks) callback()
    })
    await waitFor(() => expect(hook.result.current.isError).toBe(true))
    expect(hook.result.current.error).toBe(denied)
    expect(hook.result.current.data).toBeNull()
    expect(hook.result.current.isBindingLoading).toBe(false)
    expect(image).toHaveBeenCalledTimes(1)
  } finally {
    hook.unmount()
    queryClient.clear()
    convex.unsubscribe?.()
    await client.close()
    vi.restoreAllMocks()
  }
})
