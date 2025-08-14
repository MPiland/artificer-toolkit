import { style, globalStyle } from '@vanilla-extract/css'
import { app } from '~/css/layers.css'
import { size, space } from '~/css/size.css'
import { vars } from '~/css/theme'

export const form = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'flexDirection': 'column',
      'position': 'relative',
      'width': '100%',

      '@media': {
        'screen and (max-width: 567px)': {
          border: 'none',
        },
      },
    },
  },
})

export const content = style({
  '@layer': {
    [app]: {
      width: '100%',
      padding: `0 ${vars.spacing.md}`,
    },
  },
})

export const row_button = style({
  '@layer': {
    [app]: {
      width: '1.5rem',
      height: 'auto',
      borderRadius: '.5rem',
      alignItems: 'center',
      justifyContent: 'center',
    },
  },
})

export const detail_main = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    },
  },
})

export const detail_body = style({
  '@layer': {
    [app]: {
      position: 'relative',
      zIndex: 1,
      padding: `0 ${size['size-3']}`,
      flex: '1 1 0',
      overflowY: 'auto',
    },
  },
})

export const collapse_grid = style({
  '@layer': {
    [app]: {
      vars: {
        '--grid-margin': '0',
      },
      marginBottom: space['space-3'],
    },
  },
})

globalStyle(`${detail_body} td`, {
  '@layer': {
    [app]: {
      verticalAlign: 'top',
      padding: '0 .125rem',
    },
  },
})

globalStyle(`${detail_body} th`, {
  '@layer': {
    [app]: {
      textAlign: 'start',
      padding: '0 .125rem',
    },
  },
})

globalStyle(`${detail_body} blockquote`, {
  '@layer': {
    [app]: {
      marginLeft: size['size-3'],
      marginTop: size['size-2'],
      padding: size['size-1'],
    },
  },
})
