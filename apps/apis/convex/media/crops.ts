import type { NormalizedImageCrop } from '@artificer-toolkit/schema/api/media'

/** Keys a derived thumbnail: equal crops share one thumbnail however many references use them. */
export async function cropHash(crop: NormalizedImageCrop) {
  const canonical = [crop.x, crop.y, crop.width, crop.height].join(',')
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function sameCrop(left: NormalizedImageCrop | null, right: NormalizedImageCrop | null) {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.x === right.x &&
      left.y === right.y &&
      left.width === right.width &&
      left.height === right.height)
  )
}
