import { useMutation as useTanstackMutation, useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import type { FunctionReturnType } from 'convex/server'
import type {
  NormalizedImageCrop,
  SignedImageDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import type { MediaProfileClass } from '@artificer-toolkit/schema/api/mediaAssets'
import {
  useAction,
  useConvexAuth,
  useMutation as useConvexMutation,
  usePaginatedQuery,
  useQuery as useConvexQuery
} from 'convex/react'
import type { MediaImageTarget } from '#app/components/MediaImage/MediaImage.types'
import { queryKeys } from '#app/lib/queryKeys'
import { acceptedImageTypes } from '#app/components/MediaImage/mediaImageUtils'
import { findOption } from '#app/forms/utils/valueGuards'

type ImageVariant = 'SOURCE' | 'DISPLAY' | 'THUMBNAIL'

function isAccountAvatar(target: MediaImageTarget | undefined) {
  return target?.lookup.type === 'ACCOUNT_AVATAR'
}

function characterPortrait(target: MediaImageTarget | undefined) {
  return target?.lookup.type === 'CHARACTER_PORTRAIT' ? target.lookup : null
}

export function nativeArtwork(target: MediaImageTarget | undefined) {
  return target?.lookup.type === 'AUTHORED_IMAGE' &&
    (target.lookup.subjectKind === 'BACKGROUND' ||
      target.lookup.subjectKind === 'CLASS' ||
      target.lookup.subjectKind === 'FEAT' ||
      target.lookup.subjectKind === 'EQUIPMENT' ||
      target.lookup.subjectKind === 'RACE' ||
      target.lookup.subjectKind === 'CREATURE' ||
      target.lookup.subjectKind === 'SPELL' ||
      target.lookup.subjectKind === 'VEHICLE')
    ? target.lookup
    : null
}

export function useMediaImage(
  target: MediaImageTarget | undefined,
  variantKind: ImageVariant,
  enabled = true
) {
  const { isAuthenticated, isLoading } = useConvexAuth()
  const accountAvatar = isAccountAvatar(target)
  const portrait = characterPortrait(target)
  const artwork = nativeArtwork(target)
  const avatarQuery = useQuery(
    convexQuery(api.media.assets.avatar, accountAvatar && isAuthenticated ? {} : 'skip')
  )
  const artworkBinding = useConvexQuery(
    api.media.authoredAssets.binding,
    artwork && !isLoading ? artwork : 'skip'
  )
  const portraitBinding = useConvexQuery(
    api.media.characterPortraitAssets.bindingForCharacter,
    portrait && isAuthenticated ? portrait : 'skip'
  )
  // Revocation can reach this subscription before session convergence unmounts the shell.
  const bindingError = accountAvatar ? avatarQuery.error : null
  const binding = artwork
    ? artworkBinding
    : portrait
      ? portraitBinding
      : bindingError
        ? undefined
        : avatarQuery.data
  const native = accountAvatar || Boolean(portrait) || Boolean(artwork)
  const getAvatarImage = useAction(api.media.avatarActions.getAvatarImage)
  const getPortraitImage = useAction(api.media.characterPortraitActions.getImage)
  const getArtworkImage = useAction(api.media.authoredActions.getImage)
  const image = useQuery({
    queryKey: native
      ? [
          'media',
          artwork ?? portrait ?? 'avatar',
          binding?.assetId ?? null,
          binding?.revision ?? null,
          variantKind,
          isAuthenticated
        ]
      : ['media', target?.lookup, variantKind],
    queryFn: async (): Promise<SignedImageDeliveryDto | null> => {
      if (accountAvatar) return await getAvatarImage({ variantKind })
      if (portrait) return await getPortraitImage({ target: portrait, variantKind })
      if (artwork) return await getArtworkImage({ target: artwork, variantKind })
      return null
    },
    enabled: native
      ? enabled &&
        !isLoading &&
        (!(accountAvatar || portrait) || isAuthenticated) &&
        binding !== undefined &&
        binding.assetId !== null
      : false,
    ...(native ? { staleTime: 4 * 60_000, refetchOnWindowFocus: true } : {})
  })

  const unresolved =
    native &&
    (isLoading || ((accountAvatar || portrait) && !isAuthenticated) || binding === undefined)
  return {
    ...image,
    error: bindingError ?? image.error,
    isError: Boolean(bindingError) || image.isError,
    data: native && (unresolved || binding?.assetId === null) ? null : (image.data ?? null),
    isBindingLoading:
      native &&
      !isLoading &&
      !bindingError &&
      (!(accountAvatar || portrait) || isAuthenticated) &&
      binding === undefined
  }
}

/** Another account's avatar. The revision keys the cache, so a changed avatar refetches. */
export function useProfileAvatarImage(username: string, avatarRevision: number | null) {
  const getProfileAvatarImage = useAction(api.media.avatarActions.getProfileAvatarImage)
  return useQuery({
    queryKey: ['media', 'profile-avatar', username.toLowerCase(), avatarRevision],
    queryFn: () => getProfileAvatarImage({ username, variantKind: 'THUMBNAIL' }),
    enabled: avatarRevision !== null,
    staleTime: 4 * 60_000
  })
}

/** "My images": the viewer's own ready images of one class, newest first. */
export function useMediaLibrary(profileClass: MediaProfileClass, enabled = true) {
  return usePaginatedQuery(api.media.library.list, enabled ? { profileClass } : 'skip', {
    initialNumItems: 12
  })
}

/** An owner-only preview of one of the viewer's images, without any slot's framing. */
export function useMediaLibraryImage(assetId: string | null, variantKind: ImageVariant) {
  const getImage = useAction(api.media.libraryActions.getImage)
  return useQuery({
    queryKey: ['media-library', assetId, variantKind],
    queryFn: () => getImage({ assetId: assetId!, variantKind }),
    enabled: assetId !== null,
    staleTime: 4 * 60_000
  })
}

/**
 * The signed URL of one Scene map. It is fetched when the asset changes and refreshed only when the
 * artwork fails to load: nothing refetches on a timer, in the background, on focus or on reconnect,
 * because a loaded map never uses its URL again. Feed the renderer's load status to `onMapLoadStatus`:
 * the first failure per asset refreshes the URL once and hands it to `retryArtwork`. `refresh` is the
 * same refresh on demand, for a Retry button.
 */
export function useVttMapDelivery(
  assetId: string | null,
  retryArtwork: (delivery: FunctionReturnType<typeof api.media.vttMapActions.getDelivery>) => void
) {
  const getDelivery = useAction(api.media.vttMapActions.getDelivery)
  const query = useQuery({
    queryKey: queryKeys.media.vttMap(assetId ?? 'unavailable'),
    queryFn: () => getDelivery({ assetId: assetId! }),
    enabled: assetId !== null,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
    staleTime: 4 * 60_000
  })
  const { refetch } = query
  const retryArtworkRef = useRef(retryArtwork)
  useEffect(() => {
    retryArtworkRef.current = retryArtwork
  }, [retryArtwork])
  const refreshedRef = useRef(false)
  useEffect(() => {
    refreshedRef.current = false
  }, [assetId])
  const refresh = useCallback(() => {
    void refetch().then((result) => {
      if (result.isSuccess) retryArtworkRef.current(result.data)
    })
  }, [refetch])
  const onMapLoadStatus = useCallback(
    (status: 'ERROR' | 'LOADING' | 'READY') => {
      if (status === 'READY') refreshedRef.current = false
      else if (status === 'ERROR' && !refreshedRef.current) {
        refreshedRef.current = true
        refresh()
      }
    },
    [refresh]
  )
  return { ...query, onMapLoadStatus, refresh }
}

export function useMediaImageActions(target: MediaImageTarget) {
  const attachImage = useConvexMutation(api.media.library.attachImage)
  const createAvatarUpload = useConvexMutation(api.media.assets.createAvatarUpload)
  const removeAvatar = useConvexMutation(api.media.assets.removeAvatar)
  const saveAvatar = useAction(api.media.avatarActions.saveAvatar)
  const createPortraitUpload = useConvexMutation(api.media.characterPortraitAssets.createUpload)
  const removePortrait = useConvexMutation(api.media.characterPortraitAssets.remove)
  const savePortrait = useAction(api.media.characterPortraitActions.save)
  const createArtworkUpload = useConvexMutation(api.media.authoredAssets.createUpload)
  const removeArtwork = useConvexMutation(api.media.authoredAssets.remove)
  const saveArtwork = useAction(api.media.authoredActions.save)
  const accountAvatar = isAccountAvatar(target)
  const portrait = characterPortrait(target)
  const artwork = nativeArtwork(target)
  const artworkTarget = artwork && target.attach.type === 'AUTHORED_IMAGE' ? target.attach : null
  const portraitTarget =
    portrait && target.attach.type === 'CHARACTER_PORTRAIT' ? target.attach : null

  const save = useTanstackMutation({
    mutationFn: async ({
      assetId,
      crop,
      file
    }: {
      assetId?: string
      crop: NormalizedImageCrop
      file: File | null
    }) => {
      if (accountAvatar || portraitTarget || artworkTarget) {
        if (!file) {
          // Reframing the current image or choosing one from "My images" needs no processing.
          if (!assetId) throw new Error('missing asset')
          await attachImage({
            assetId,
            crop,
            target: portraitTarget ?? artworkTarget ?? { type: 'ACCOUNT_AVATAR' }
          })
          return
        }
        const declaredMimeType = findOption(acceptedImageTypes, file.type)
        if (!declaredMimeType) throw new Error('unsupported image type')
        const input = {
          originalFileName: file.name,
          declaredMimeType,
          declaredBytes: file.size,
          idempotencyKey: crypto.randomUUID()
        }
        const intent = portraitTarget
          ? await createPortraitUpload({ ...input, target: portraitTarget })
          : artworkTarget
            ? await createArtworkUpload({ ...input, target: artworkTarget })
            : await createAvatarUpload(input)
        const response = await fetch(intent.url, {
          method: intent.method,
          headers: { 'Content-Type': file.type },
          body: file
        })
        if (!response.ok) throw new Error('upload')
        if (portraitTarget)
          await savePortrait({ assetId: intent.assetId, crop, target: portraitTarget })
        else if (artworkTarget)
          await saveArtwork({ assetId: intent.assetId, crop, target: artworkTarget })
        else await saveAvatar({ assetId: intent.assetId, crop })
        return
      }

      throw new Error('Unsupported media target.')
    }
  })
  const remove = useTanstackMutation({
    mutationFn: async () => {
      if (accountAvatar) {
        await removeAvatar({})
        return
      }
      if (portraitTarget) {
        await removePortrait({ target: portraitTarget })
        return
      }
      if (artworkTarget) {
        await removeArtwork({ target: artworkTarget })
        return
      }
      throw new Error('Unsupported media target.')
    }
  })

  return { remove, save }
}
