import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'
import { theme } from '../../css/global.css'

export const form_wrapper = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'flexDirection': 'column',
      'position': 'relative',
      'height': '100%',
      'width': 'inherit',
      'overflowY': 'auto',
      'borderLeft': theme.vars['app-border-line-style'],
      'borderRight': theme.vars['app-border-line-style'],

      '@media': {
        'screen and (max-width: 567px)': {
          border: 'none',
        },
      },
    },
  },
})

export const form_header = style({
  '@layer': {
    [app]: {
      paddingTop: size['size-1'],
      marginBottom: size['size-1'],
      paddingLeft: '1rem',
      paddingRight: '1rem',
      borderTop: theme.vars['app-border-line-style'],
    },
  },
})

export const form_content = style({
  '@layer': {
    [app]: {
      flexGrow: 1,
      position: 'relative',
      overflowY: 'auto',
      width: 'inherit',
      paddingLeft: '1rem',
      paddingRight: '1rem',
    },
  },
})

export const form_footer = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingLeft: '.75rem',
      paddingRight: '.75rem',
      left: 0,
      bottom: 0,
      height: '4rem',
      width: '100%',
      borderTop: theme.vars['app-border-line-style'],
      backgroundColor: theme.vars['app-background-color'],
    },
  },
})
