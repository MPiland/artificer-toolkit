import { Button, FileButton, Modal } from '@mantine/core'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Crop } from 'react-image-crop'
import { api } from '#app/lib/api'
import { getSupabaseBrowserClient } from '#supabase/client'
import type { ImageCropSelection, MediaImageDialogProps } from './MediaImage.types'
import { createCenteredSquareCrop, toNormalizedCrop, validateImageFile } from './mediaImageUtils'
import * as styles from './MediaImage.css'

const ReactCrop = lazy(async () => {
  const module = await import('react-image-crop')
  await import('react-image-crop/dist/ReactCrop.css')
  return { default: module.default }
})

export function MediaImageDialog({
  beforeChange,
  current,
  disabled = false,
  label,
  mode,
  opened,
  profile,
  target,
  onClose
}: MediaImageDialogProps) {
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<ImageCropSelection | null>(current?.crop ?? null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const sourceQuery = useQuery({
    queryKey: ['media', target.lookup, 'SOURCE'],
    queryFn: () => api.media.getImage({ target: target.lookup, variantKind: 'SOURCE' }),
    enabled: opened && Boolean(current)
  })
  const sourceLoading = Boolean(current) && sourceQuery.isFetching
  const editableCurrent = sourceQuery.data ?? current
  const requiresCrop = mode === 'square' || mode === 'decorative'

  const imageUrl = previewUrl ?? (sourceLoading ? null : (editableCurrent?.url ?? null))
  const squareCrop = useMemo<Crop | undefined>(
    () =>
      crop
        ? {
            unit: '%',
            x: crop.x * 100,
            y: crop.y * 100,
            width: crop.width * 100,
            height: crop.height * 100
          }
        : undefined,
    [crop]
  )

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl]
  )

  useEffect(() => {
    if (!opened || sourceLoading) return
    setFile(null)
    setPreviewUrl(null)
    setCrop(editableCurrent?.crop ?? null)
    setError(null)
  }, [editableCurrent, opened, sourceLoading])

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['media', target.lookup] })
  }

  function handleFile(nextFile: File | null) {
    if (!nextFile) return
    const fileError = validateImageFile(nextFile)
    if (fileError) {
      setError(fileError)
      return
    }
    setError(null)
    setFile(nextFile)
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return URL.createObjectURL(nextFile)
    })
    setCrop(null)
  }

  async function save() {
    if (disabled) return
    if (current && sourceQuery.isError && !file) {
      setError('Could not load the source image. Choose a replacement or try again.')
      return
    }
    if (requiresCrop && !crop) {
      setError(
        mode === 'decorative'
          ? 'Choose the thumbnail framing before saving.'
          : 'Choose a square crop before saving.'
      )
      return
    }
    setPending(true)
    setError(null)
    try {
      await beforeChange?.()
      let assetId = editableCurrent?.assetId
      if (file) {
        const intent = await api.media.createImageUpload({
          profile,
          target: target.attach,
          originalFileName: file.name,
          declaredMimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp',
          declaredBytes: file.size,
          idempotencyKey: crypto.randomUUID()
        })
        const { error: uploadError } = await getSupabaseBrowserClient()
          .storage.from(intent.bucket)
          .uploadToSignedUrl(intent.objectKey, intent.token, file)
        if (uploadError) throw new Error('Upload did not finish. Try again.')
        const finalized = await api.media.finalizeImageUpload({ assetId: intent.assetId })
        if (finalized.status === 'REJECTED') {
          throw new Error('That image could not be processed. Choose another image and try again.')
        }
        if (finalized.status !== 'READY')
          throw new Error('Image processing is still running. Try again shortly.')
        assetId = intent.assetId
      }
      if (!assetId) {
        setError('Choose an image before saving.')
        return
      }
      await api.media.attachImage({
        assetId,
        target: target.attach,
        ...(requiresCrop && crop ? { crop } : {}),
        ...(mode === 'decorative' ? { isDecorative: true } : {})
      })
      invalidate()
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the image. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    setPending(true)
    setError(null)
    try {
      await beforeChange?.()
      await api.media.removeImage({ target: target.attach })
      invalidate()
      onClose()
    } catch {
      setError('Could not remove the image. Try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal opened={opened} size='lg' title={label} onClose={onClose}>
      <div className={styles.dialogBody} aria-busy={pending || undefined}>
        {imageUrl ? (
          <>
            {requiresCrop ? (
              <div>
                <p className={styles.cropLabel}>Thumbnail framing</p>
                <p className={styles.liveMessage}>
                  Drag or resize the square to choose the thumbnail framing used throughout the app.
                </p>
              </div>
            ) : null}
            <div className={styles.preview}>
              {requiresCrop ? (
                <Suspense fallback={<img alt='' className={styles.previewImage} src={imageUrl} />}>
                  <ReactCrop
                    aspect={1}
                    crop={squareCrop}
                    onChange={(_pixelCrop, percentCrop) => setCrop(toNormalizedCrop(percentCrop))}
                  >
                    <img
                      alt=''
                      className={styles.previewImage}
                      src={imageUrl}
                      onLoad={(event) => {
                        if (!crop)
                          setCrop(
                            createCenteredSquareCrop(
                              event.currentTarget.naturalWidth,
                              event.currentTarget.naturalHeight
                            )
                          )
                      }}
                    />
                  </ReactCrop>
                </Suspense>
              ) : (
                <img alt='' className={styles.previewImage} src={imageUrl} />
              )}
            </div>
          </>
        ) : sourceLoading ? (
          <div className={styles.preview}>Loading source image&hellip;</div>
        ) : null}
        <FileButton
          accept='image/jpeg,image/png,image/webp'
          disabled={pending || disabled || sourceLoading}
          onChange={handleFile}
        >
          {(props) => (
            <Button {...props} type='button' variant='light'>
              Choose image
            </Button>
          )}
        </FileButton>
        <p aria-live='polite' className={styles.liveMessage} role={error ? 'alert' : undefined}>
          {error ?? (pending ? 'Saving image…' : 'JPEG, PNG, or WebP up to 6 MB.')}
        </p>
        <div className={styles.actions}>
          {current ? (
            <Button
              color='red'
              disabled={pending || disabled}
              type='button'
              variant='subtle'
              onClick={remove}
            >
              Remove
            </Button>
          ) : (
            <span />
          )}
          <Button
            disabled={disabled || sourceLoading || (!current && !file)}
            loading={pending}
            type='button'
            onClick={save}
          >
            Save image
          </Button>
        </div>
      </div>
    </Modal>
  )
}
