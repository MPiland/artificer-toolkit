import { style } from '@vanilla-extract/css'
import { theme, vars } from '@/css/theme'
import { space } from '@/css/size.css'
import { app } from '@/css/layers.css'

export const base = style({
  '@layer': {
    [app]: {
      border: `${theme.other?.border.width.thin} ${theme.other?.border.style} ${vars.colors.gray[5]}`,
      borderRadius: vars.radiusDefault,
      marginBottom: space['space-4'],
      outline: 'none',
      padding: `0 ${space['space-4']}`,

      selectors: {
        [vars.darkSelector]: {
          borderColor: vars.colors.dark[3],
        },
      },
      vars: {
        '--grid-margin': '0',
      }
    },
  },
})
