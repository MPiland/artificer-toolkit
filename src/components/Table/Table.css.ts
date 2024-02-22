import { style } from '@vanilla-extract/css'
import { theme } from '../../css/global.css'
import { app } from '../../css/layers.css'

export const table = style({
  '@layer': {
    [app]: {
      position: 'relative',
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      borderTop: '0 solid transparent',
      zIndex: 1,
      selectors: {
        '&.scrollable': {
          overflowX: 'auto',
          width: '100%',
        },
      },
    },
  },
})

export const table_body = style({
  '@layer': {
    [app]: {
      position: 'relative',
      backgroundColor: theme.vars['app-background-color'],
      zIndex: 0,
      backgroundClip: 'border-box',
      borderTop: '0 solid transparent',
    },
  },
})

export const table_header_row = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      top: '0',
      minWidth: '100%',
      textAlign: 'start',
      borderTop: '0px solid transparent',
      borderBottom: theme.vars['app-border-line-style'],
      backgroundColor: theme.vars['app-background-color'],
      zIndex: 2,

      selectors: {
        '&.borderless': {
          borderBottom: 'none',
        },
      },
    },
  },
})

export const table_row = style({
  '@layer': {
    [app]: {
      minWidth: '100%',
      textAlign: 'start',
      borderTop: theme.vars['app-border-line-style'],
      borderLeft: theme.vars['app-border-line-style'],
      borderRight: theme.vars['app-border-line-style'],
      borderTopLeftRadius: theme['default-border-radius'],
      borderTopRightRadius: theme['default-border-radius'],
      zIndex: 0,

      selectors: {
        '&.collapsed': {
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
          borderBottom: theme.vars['app-border-line-style'],
        },
        '&:hover': {
          backgroundImage: 'linear-gradient(rgb(0 0 0/5%) 0 0)',
        },
        '&.borderless': {
          borderBottom: 'none',
        },
      },
    },
  },
})

export const table_subrow = style({
  '@layer': {
    [app]: {
      minWidth: '100%',
      textAlign: 'start',
      borderLeft: theme.vars['app-border-line-style'],
      borderBottom: theme.vars['app-border-line-style'],
      borderRight: theme.vars['app-border-line-style'],
      borderBottomLeftRadius: theme['default-border-radius'],
      borderBottomRightRadius: theme['default-border-radius'],
      maxHeight: '5rem',
      transform: 'scaleY(1)',
      transition:
        'max-height .3s ease-in-out, transform .3s ease-in-out, padding .3s ease-in-out',

      selectors: {
        '&.collapsed': {
          border: 'none',
          maxHeight: '0',
          transform: 'scaleY(0)',
        },
      },
    },
  },
})

export const table_header = style({
  '@layer': {
    [app]: {
      fontWeight: 'bold',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: '.25rem',
      paddingBottom: '.25rem',

      selectors: {
        '&.sortable': {
          cursor: 'pointer',
        },
        '&.ascending::after': {
          content: '  \\2191',
        },
        '&.descending::after': {
          content: '  \\2193',
        },
      },
    },
  },
})

export const table_cell = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      paddingTop: '.25rem',
      paddingBottom: '.25rem',
    },
  },
})

export const table_collapse_button = style({
  '@layer': {
    [app]: {
      border: 'none',
      backgroundColor: 'inherit',
      transition: 'transform .3s ease-in-out',
      maxWidth: '4rem',
      maxHeight: '2rem',
      width: '1.25rem',
      height: 'fit-content',
      justifyContent: 'center',

      selectors: {
        '&.collapsed': {
          transform: 'rotate(180deg)',
          transition: 'transform .3s ease-in-out',
        },
        '&:active': {
          backgroundImage: 'none',
        },
      },
    },
  },
})

export const table_dynamic_button = style({
  '@layer': {
    [app]: {
      border: 'none',
      backgroundColor: 'inherit',
      padding: '0 .5rem',
      height: '100%',
      width: '2.25rem',
      alignItems: 'center',
      display: 'flex',

      selectors: {
        '&:active': {
          backgroundImage: 'none',
        },
      },
    },
  },
})

export const table_small_columns = style({
  '@layer': {
    [app]: {
      maxWidth: '4rem',
    },
  },
})

export const table_button_cell = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: theme['default-border-radius'],

      selectors: {
        '&:active': {
          backgroundImage: 'linear-gradient(rgb(0 0 0/40%) 0 0)',
        },
      },
    },
  },
})
