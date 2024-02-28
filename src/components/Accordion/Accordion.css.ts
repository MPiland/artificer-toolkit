import { createVar, globalStyle, style } from '@vanilla-extract/css'
import { theme } from '../../css/global.css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'
import palette from '../../css/colors.css'

export const height = createVar('height')

export const accordion = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      height: 'auto',
    },
  },
})

export const accordion_container = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: 'auto',
      borderRadius: theme['default-border-radius'],
      border: theme.vars['app-border-line-style'],
      marginBottom: size['size-2'],
      boxShadow: '-2px 2px 4px 0px rgba(0,0,0,0.2)',
      backgroundColor: theme.vars['app-background-color'],
      zIndex: 0,
    },
  },
})

export const accordion_header = style({
  display: 'flex',
  flexDirection: 'row',
  cursor: 'pointer',
  padding: `${size['size-1']} ${size['size-2']}`,
})

export const accordion_header_button = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: '1.25rem',
      alignItems: 'center',
      display: 'flex',
    },
  },
})

export const accordion_remove_button = style({
  '@layer': {
    [app]: {
      width: '1.5rem',
      height: '1.5rem',
      border: theme.vars['app-border-line-style'],
      borderRadius: '.5rem',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: size['size-1'],

      selectors: {
        '&:hover': {
          backgroundColor: palette['gray-3'],
        },
      },
    },
  },
})

export const accordion_body = style({
  '@layer': {
    [app]: {
      display: 'grid',
      borderSpacing: 0,
      gridTemplateRows: '1fr',
      transition:
        'grid-template-rows 0.3s ease-in-out, margin 0.3s ease-in-out, padding .3s ease-in-out',
      padding: `${size['size-2']} 0`,

      selectors: {
        '&.collapsed': {
          gridTemplateRows: '0fr',
          padding: '0',
        },
      },
    },
  },
})

export const accordion_content = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: 'auto',
      overflow: 'hidden',
      padding: `0 ${size['size-2']}`,
    },
  },
})

export const accordion_footer = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      padding: `${size['size-1']} ${size['size-2']}`,
    },
  },
})

globalStyle(`${accordion_header_button} > svg`, {
  width: '100%',
  height: 'auto',
})
