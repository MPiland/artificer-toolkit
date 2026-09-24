import { useMediaImage } from '#app/data/media'
import type { MediaImageTarget } from './MediaImage.types'
import * as styles from './MediaImage.css'

export function MediaImageView({
  target,
  variant = 'detail'
}: {
  target: MediaImageTarget
  variant?: 'detail' | 'inspector'
}) {
  const imageQuery = useMediaImage(target, 'DISPLAY')
  const image = imageQuery.data
  if (!image) return null
  return (
    <img
      alt={image.isDecorative ? '' : (image.altText ?? '')}
      className={variant === 'inspector' ? styles.inspectorImage : styles.detailImage}
      src={image.url}
    />
  )
}
