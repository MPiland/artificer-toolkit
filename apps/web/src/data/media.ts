import { useMutation as useTanstackMutation, useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '@artificer-toolkit/apis/convex/api'
import type {
  NormalizedImageCrop,
  SignedImageDeliveryDto
} from '@artificer-toolkit/schema/api/media'
import {
  useAction,
  useConvexAuth,
  useMutation as useConvexMutation,
  useQuery as useConvexQuery
} from 'convex/react'
import type { MediaImageTarget } from '#app/components/MediaImage/MediaImage.types'

type ImageVariant = 'SOURCE' | 'DISPLAY' | 'THUMBNAIL'
type ImageMimeType = 'image/jpeg' | 'image/png' | 'image/webp'

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

export function useMediaImageActions(target: MediaImageTarget) {
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
        let nextAssetId = assetId
        if (file) {
          const input = {
            originalFileName: file.name,
            declaredMimeType: file.type as ImageMimeType,
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
          nextAssetId = intent.assetId
        }
        if (!nextAssetId) throw new Error('missing asset')
        if (portraitTarget)
          await savePortrait({ assetId: nextAssetId, crop, target: portraitTarget })
        else if (artworkTarget)
          await saveArtwork({
            assetId: nextAssetId,
            crop,
            target: artworkTarget
          })
        else await saveAvatar({ assetId: nextAssetId, crop })
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
