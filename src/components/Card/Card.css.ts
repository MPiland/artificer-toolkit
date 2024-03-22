import { style } from '@vanilla-extract/css'
import { theme } from '../../css/global.css'
import { size } from '../../css/size.css'
import { app } from '../../css/layers.css'

export const card = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'auto',
      borderRadius: theme['default-border-radius'],
      border: theme.vars['app-border-line-style'],
      marginBottom: size['size-2'],
      boxShadow: '-2px 2px 4px 0px rgba(0,0,0,0.2)',
      padding: '1rem 1rem',
    },
  },
})
