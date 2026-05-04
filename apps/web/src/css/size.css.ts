export const size = {
  'size-x': '0',
  'size-000': '-.5rem',
  'size-00': '-.25rem',
  'size-0': '.125rem',
  'size-1': '.25rem',
  'size-2': '.5rem',
  'size-3': '.75rem',
  'size-4': '1rem',
  'size-5': '1.125rem',
  'size-6': '1.25rem',
  'size-7': '1.5rem',
  'size-8': '1.75rem',
  'size-9': '2rem',
  'size-10': '3rem',
  'size-11': '4rem',
  'size-12': '5rem',
  'size-13': '7.5rem',
  'size-14': '10rem',
  'size-15': '15rem',
  'size-16': '20rem',
  'size-17': '30rem',
  'size-auto': 'auto',
  'size-full': '100%',
  'size-content-1': '20ch',
  'size-content-2': '45ch',
  'size-content-3': '60ch',
  'size-header-1': '20ch',
  'size-header-2': '25ch',
  'size-header-3': '35ch'
} as const

export const space = {
  'space-x': '0',
  'space-000': '-.5rem',
  'space-00': '-.25rem',
  'space-0': '.125rem',
  'space-1': '.25rem',
  'space-2': '.5rem',
  'space-3': '.75rem',
  'space-4': '1rem',
  'space-5': '1.125rem',
  'space-6': '1.25rem',
  'space-7': '1.5rem',
  'space-8': '1.75rem',
  'space-9': '2rem',
  'space-10': '3rem',
  'space-11': '4rem',
  'space-12': '5rem',
  'space-13': '7.5rem',
  'space-14': '10rem',
  'space-15': '15rem',
  'space-16': '20rem',
  'space-17': '30rem',
  'space-auto': 'auto',
  'space-full': 'full'
} as const

export const position = {
  'position-0': '0',
  'position-25': '25%',
  'position-50': '50%',
  'position-75': '75%',
  'position-100': '100%'
} as const

export const mediaSize = {
  'mediaSize-xxs': '240px',
  'mediaSize-xs': '360px',
  'mediaSize-sm': '480px',
  'mediaSize-md': '768px',
  'mediaSize-lg': '1024px',
  'mediaSize-xl': '1440px',
  'mediaSize-xxl': '1920px'
} as const

export const height = {
  xxs: '1.25rem',
  xs: '1.875rem',
  sm: '2.25rem',
  md: '2.5rem',
  lg: '3.125rem',
  xl: '3.75rem',
  auto: 'auto',
  full: '100%'
} as const

export type Height = keyof typeof height
export type Size = keyof typeof size
export type Space = keyof typeof space
export type Position = keyof typeof position
export type MediaSize = keyof typeof mediaSize
