import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { space } from '../../css/size.css'
import { theme } from '../../css/theme.css'

export const loading_wrapper = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      textAlign: 'center',
      width: '100%',
      backgroundColor: theme.vars.component.content.backgroundColor.main,
    },
  },
})

export const loading_message = style({
  '@layer': {
    [app]: {
      marginTop: space['space-4'],
    },
  },
})
