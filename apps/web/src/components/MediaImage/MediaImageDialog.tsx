import { Button, FileButton, Modal } from '@mantine/core'
import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import type { Crop } from 'react-image-crop'
import { useMediaImage, useMediaImageActions } from '#app/data/media'
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
  target,
  onClose
}: MediaImageDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [crop, setCrop] = useState<ImageCropSelection | null>(current?.crop ?? null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const sourceQuery = useMediaImage(target, 'SOURCE', opened && Boolean(current))
  const mediaActions = useMediaImageActions(target)
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
      if (!file && !editableCurrent?.assetId) {
        setError('Choose an image before saving.')
        return
      }
      await mediaActions.save.mutateAsync({
        assetId: editableCurrent?.assetId,
        crop: crop!,
        file
      })
      onClose()
    } catch {
      setError('Could not save the image. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function remove() {
    setPending(true)
    setError(null)
    try {
      await beforeChange?.()
      await mediaActions.remove.mutateAsync()
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
