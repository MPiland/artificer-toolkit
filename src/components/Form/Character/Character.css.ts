import { style } from '@vanilla-extract/css'
import { app } from '../../../css/layers.css'
import { size } from '../../../css/size.css'
import { theme } from '../../../css/global.css'
import palette from '../../../css/colors.css'

export const option_dropdown = style({
  '@layer': {
    [app]: {
      'width': 'auto',
      'margin': `0 ${size['size-15']}`,

      '@media': {
        'screen and (min-width: 568px) and (max-width: 1023px)': {
          margin: `0 ${size['size-10']}`,
        },
        'screen and (max-width: 567px)': {
          margin: `0 ${size['size-3']}`,
        },
      },
    },
  },
})

export const card_group = style({
  '@layer': {
    [app]: {
      'padding': `0 ${size['size-13']}`,
      'marginBottom': size['size-3'],

      '@media': {
        'screen and (min-Width: 568px) and (max-width: 1023px)': {
          padding: `0 ${size['size-12']}`,
        },
        'screen and (max-width: 567px)': {
          padding: `0 ${size['size-10']}`,
        },
      },
    },
  },
})

export const main_card = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      height: '3.5rem',
      border: theme.vars['app-border-line-style'],
      borderRadius: theme['default-border-radius'],

      selectors: {
        '&.clickable:hover': {
          cursor: 'pointer',
          backgroundColor: 'lightgrey',
        },
      },
    },
  },
})

export const card_header_title = style({
  '@layer': {
    [app]: {
      marginLeft: size['size-3'],
    },
  },
})

export const subrace_card = style({
  '@layer': {
    [app]: {
      marginLeft: `${size['size-3']}`,
      marginRight: `${size['size-10']}`,
      borderRadius: '0px',
      borderTop: 'none',

      selectors: {
        '&:last-of-type': {
          borderBottomLeftRadius: theme['default-border-radius'],
          borderBottomRightRadius: theme['default-border-radius'],
        },
      },
    },
  },
})

export const feature_card = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      width: 'auto',
      height: 'auto',
      borderRadius: theme['default-border-radius'],
      border: theme.vars['app-border-line-style'],
      boxShadow: '-2px 2px 4px 0px rgba(0,0,0,0.2)',
      marginBottom: size['size-3'],
    },
  },
})

export const feature_card_header = style({
  '@layer': {
    [app]: {
      padding: `0 ${size['size-3']}`,
      borderBottom: theme.vars['app-border-line-style'],
      height: '3rem',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      backgroundColor: palette['gray-3'],
      borderTopRightRadius: theme['default-border-radius'],
      borderTopLeftRadius: theme['default-border-radius'],
    },
  },
})

export const feature_card_body = style({
  '@layer': {
    [app]: {
      padding: size['size-3'],
      marginBottom: size['size-1'],
    },
  },
})
