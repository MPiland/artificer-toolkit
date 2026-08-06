import { useQuery } from '@tanstack/react-query'
import { api } from '#app/lib/api'
import type { MediaImageTarget } from './MediaImage.types'
import * as styles from './MediaImage.css'

export function MediaImageView({
  target,
  variant = 'detail'
}: {
  target: MediaImageTarget
  variant?: 'detail' | 'inspector'
}) {
  const imageQuery = useQuery({
    queryKey: ['media', target.lookup, 'DISPLAY'],
    queryFn: () => api.media.getImage({ target: target.lookup, variantKind: 'DISPLAY' })
  })
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
