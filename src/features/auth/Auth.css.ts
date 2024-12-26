import { style } from '@vanilla-extract/css'
import { theme } from '../../css/theme.css'
import { space } from '../../css/size.css'

export const error_message = style({
  '@layer': {
    ['app']: {
      display: 'flex',
      backgroundColor: theme.vars.typography.backgroundColor.error,
      padding: space['space-2'],
      marginBottom: space['space-2'],
      alignItems: 'center',
      columnGap: space['space-1'],
    },
  },
})
