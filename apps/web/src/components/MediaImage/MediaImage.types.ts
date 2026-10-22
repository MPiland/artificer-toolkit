import type {
  ImageLookupInput,
  MediaImageProfile,
  MediaTarget,
  NormalizedImageCrop,
  SignedImageDeliveryDto
} from '@artificer-toolkit/schema/api/media'

type MediaImageMode = 'square' | 'decorative'

export interface MediaImageTarget {
  lookup: ImageLookupInput['target']
  attach: MediaTarget
}

export interface MediaImageControlProps {
  beforeChange?: () => Promise<void> | void
  disabled?: boolean
  label: string
  mode: MediaImageMode
  profile: MediaImageProfile
  target?: MediaImageTarget
  variant?: 'avatar' | 'portrait' | 'artwork'
}

export interface MediaImageDialogProps extends Omit<MediaImageControlProps, 'target'> {
  current: SignedImageDeliveryDto | null
  target: MediaImageTarget
  onClose: () => void
  opened: boolean
}

export type ImageCropSelection = NormalizedImageCrop
