import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'

export const scene_overlay = style({
    '@layer': {
      [app]: {
        position: 'absolute',
        flex: 1,
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1
      },
    },
  })