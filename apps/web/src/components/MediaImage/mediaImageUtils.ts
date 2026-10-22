import { findOption } from '#app/forms/utils/valueGuards'
import type { ImageCropSelection } from './MediaImage.types'

export const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp'] as const
export const maxImageBytes = 6 * 1024 * 1024

export function validateImageFile(file: File): string | null {
  if (!findOption(acceptedImageTypes, file.type)) {
    return 'Choose a JPEG, PNG, or WebP image.'
  }
  if (file.size > maxImageBytes) return 'Choose an image smaller than 6 MB.'
  return null
}

export function createCenteredSquareCrop(width: number, height: number): ImageCropSelection {
  const side = Math.min(width, height)
  return {
    x: (width - side) / (2 * width),
    y: (height - side) / (2 * height),
    width: side / width,
    height: side / height
  }
}

export function toNormalizedCrop(crop: {
  height: number
  unit?: string
  width: number
  x: number
  y: number
}): ImageCropSelection {
  return {
    x: crop.x / 100,
    y: crop.y / 100,
    width: crop.width / 100,
    height: crop.height / 100
  }
}
