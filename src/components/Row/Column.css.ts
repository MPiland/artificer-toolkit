import { createVar, style, styleVariants } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'

export const column_align = createVar('column_align')
export const column_width = createVar('column_width')
export const column_justify = createVar('column_justify')

export const column = style({
  '@layer': {
    [app]: {
      alignItems: column_align,
      justifyItems: column_justify,
      width: column_width,
    },
  },
})

export const column_width_variant = styleVariants({
  full: { '@layer': { [app]: { width: size['size-full'] } } },
  auto: { '@layer': { [app]: { width: size['size-auto'] } } },
})
