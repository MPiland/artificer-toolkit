import { globalStyle, style } from '@vanilla-extract/css'
import { theme, vars } from '~/css/theme'
import { size } from '~/css/size.css'
import { app } from '~/css/layers.css'
import { fontSize } from '~/css/typography.css'

export const base = style({
  '@layer': {
    [app]: {
      padding: `${size['size-3']} ${size['size-4']}`,
      borderTop: `${theme.other?.border.width.thin} ${theme.other?.border.style} ${vars.colors.gray[5]}`,

      selectors: {
        [vars.darkSelector]: {
          borderColor: vars.colors.dark[3],
        },
      },
    },
  },
})

globalStyle(`${base} *`, {
  '@layer': {
    [app]: {
      fontSize: fontSize['font-size-00'],
    },
  },
})
