import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size, space } from '../../css/size.css'

export const divider = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      margin: `${space['space-2']} 0`,
      width: '100%',
    },
  },
})

export const divider_line = style({
  '@layer': {
    [app]: {
      display: 'flex',
      width: '100%',

      selectors: {
        '&:first-of-type &:not(only-child)': {
          marginRight: size['size-4'],
        },
        [`${divider}:has([data-location="left"]) > &:first-of-type `]: {
          flexGrow: 0,
          width: '10%',
        },
        '&:last-of-type &:not(only-child)': {
          marginLeft: size['size-4'],
        },
        [`${divider}:has([data-location="right"]) > &:last-of-type`]: {
          flexGrow: 0,
          width: '10%',
        },
      },
    },
  },
})

export const divider_label = style({
  '@layer': {
    [app]: {
      padding: '0 1rem', // Add padding around the label
      whiteSpace: 'nowrap', // Prevent the label from wrapping

      selectors: {
        '&:has([data-location="left"])': {
          textAlign: 'left',
        },
        '&:has([data-location="right"])': {
          textAlign: 'right',
        },
      },
    },
  },
})
