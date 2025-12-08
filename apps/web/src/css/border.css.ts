export const borderSize = {
  'border-size-1': '1px',
  'border-size-2': '2px',
  'border-size-3': '5px',
  'border-size-4': '10px',
  'border-size-5': '25px',
}

export const borderRadius = {
  xs: '.125rem',
  sm: '.25rem',
  md: '.5rem',
  lg: '1rem',
  xl: '2rem',
}

export const shadows = {
  'shadow-1': '0 1px 2px -1px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 9%))',
  'shadow-2':
    '0 3px 5px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 3%)), 0 7px 14px -5px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 5%))',
  'shadow-3':
    '0 -1px 3px 0 hsl(var(--shadow-color) / calc(var(--shadow-strength) + 2%)), 0 1px 2px -5px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 2%)), 0 2px 5px -5px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 4%)), 0 4px 12px -5px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 5%)), 0 12px 15px -5px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 7%))',
  'shadow-4':
    '0 -2px 5px 0 hsl(var(--shadow-color) / calc(var(--shadow-strength) + 2%)), 0 1px 1px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 3%)), 0 2px 2px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 3%)), 0 5px 5px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 4%)), 0 9px 9px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 5%)), 0 16px 16px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 6%))',
  'shadow-5':
    '0 -1px 2px 0 hsl(var(--shadow-color) / calc(var(--shadow-strength) + 2%)), 0 2px 1px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 3%)), 0 5px 5px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 3%)), 0 10px 10px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 4%)), 0 20px 20px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 5%)), 0 40px 40px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 7%))',
  'shadow-6':
    '0 -1px 2px 0 hsl(var(--shadow-color) / calc(var(--shadow-strength) + 2%)), 0 3px 2px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 3%)), 0 7px 5px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 3%)), 0 12px 10px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 4%)), 0 22px 18px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 5%)), 0 41px 33px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 6%)), 0 100px 80px -2px hsl(var(--shadow-color) / calc(var(--shadow-strength) + 7%))',
}

export type BorderSize = keyof typeof borderSize
export type BorderRadius = keyof typeof borderRadius
export type Shadows = keyof typeof shadows
