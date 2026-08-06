import { Button, Tooltip, UnstyledButton } from '@mantine/core'
import { Image as ImageIcon, Pencil, Plus, Shield } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { api } from '#app/lib/api'
import type { MediaImageControlProps } from './MediaImage.types'
import { MediaImageDialog } from './MediaImageDialog'
import * as styles from './MediaImage.css'

export function MediaImageControl({
  beforeChange,
  disabled = false,
  label,
  mode,
  profile,
  target,
  variant = 'artwork'
}: MediaImageControlProps) {
  const [opened, setOpened] = useState(false)
  const imageQuery = useQuery({
    queryKey: ['media', target?.lookup, 'THUMBNAIL'],
    queryFn: async () => {
      if (!target) return null
      return await api.media.getImage({
        target: target.lookup,
        variantKind: 'THUMBNAIL'
      })
    },
    enabled: Boolean(target)
  })
  const image = imageQuery.data ?? null
  const actionLabel = image && variant === 'artwork' ? 'Change image' : label

  return (
    <div className={styles.control}>
      {variant === 'portrait' ? (
        <Tooltip label={label}>
          <span className={styles.portraitTriggerWrapper}>
            <UnstyledButton
              aria-label={label}
              className={styles.portraitTrigger}
              disabled={disabled}
              type='button'
              onClick={() => setOpened(true)}
            >
              <span className={styles.portrait}>
                {image ? (
                  <img alt='' className={styles.image} src={image.url} />
                ) : (
                  <Shield aria-hidden='true' size={24} />
                )}
              </span>
            </UnstyledButton>
          </span>
        </Tooltip>
      ) : variant === 'artwork' ? (
        <Tooltip
          label={
            disabled ? (target ? `${label} is read-only.` : 'Save the draft first.') : actionLabel
          }
        >
          <span>
            <UnstyledButton
              aria-label={actionLabel}
              className={`${styles.artworkTrigger}${image ? ` ${styles.artworkTriggerFilled}` : ''}`}
              disabled={disabled}
              type='button'
              onClick={() => setOpened(true)}
            >
              {image ? (
                <>
                  <img alt='' className={styles.image} src={image.url} />
                  <span aria-hidden='true' className={styles.artworkEditBadge}>
                    <Pencil size={14} />
                  </span>
                </>
              ) : (
                <Plus aria-hidden='true' size={28} />
              )}
            </UnstyledButton>
          </span>
        </Tooltip>
      ) : (
        <Tooltip
          label={disabled ? (target ? `${label} is read-only.` : 'Save the draft first.') : label}
        >
          <span>
            <Button
              disabled={disabled}
              leftSection={
                <span className={styles.avatar}>
                  {image ? (
                    <img alt='' className={styles.image} src={image.url} />
                  ) : (
                    <ImageIcon aria-hidden='true' size={17} />
                  )}
                </span>
              }
              type='button'
              variant='subtle'
              onClick={() => setOpened(true)}
            >
              {label}
            </Button>
          </span>
        </Tooltip>
      )}
      {target ? (
        <MediaImageDialog
          beforeChange={beforeChange}
          current={image}
          disabled={disabled}
          label={label}
          mode={mode}
          opened={opened}
          profile={profile}
          target={target}
          onClose={() => setOpened(false)}
        />
      ) : null}
    </div>
  )
}
