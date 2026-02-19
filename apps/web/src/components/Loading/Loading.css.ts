import { style } from '@vanilla-extract/css'
import { app } from '@css/layers.css'
import { space } from '@css/size.css'

export const loading_wrapper = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      textAlign: 'center',
      width: '100%',
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
