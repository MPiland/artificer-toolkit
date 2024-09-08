import { style } from '@vanilla-extract/css'
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
      width: '100%',
    },
  },
})

export const table_body = style({
  '@layer': {
    [app]: {
      position: 'relative',
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
      textAlign: 'start',
      zIndex: 0,

      selectors: {
        '&.collapsed': {
          borderTop: 'none',
          borderLeft: 'none',
          borderRight: 'none',
        },
        '&:hover': {
          backgroundImage: 'linear-gradient(rgb(0 0 0/5%) 0 0)',
        },
        '&.borderless': {
          borderBottom: 'none',
        },
        '&.clickable': {
          cursor: 'pointer',
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
      maxHeight: '5rem',
      transform: 'scaleY(1)',
      transition: 'border .3s ease-in, transform .3s ease-in, max-height .3s ease-in',

      selectors: {
        '&.collapsed': {
          borderLeft: '1px solid transparent',
          borderBottom: '1px solid transparent',
          borderRight: '1px solid transparent',
          maxHeight: '0',
          transform: 'scaleY(0)',
          transition: 'border .3s ease-out, transform .3s ease-out, max-height .3s ease-out',
        },
        '&:hover': {
          backgroundImage: 'linear-gradient(rgb(0 0 0/5%) 0 0)',
        },
        '&.clickable': {
          cursor: 'pointer',
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
      justifyContent: 'center',
      height: '100%',
      selectors: {
        '&:active': {
          backgroundImage: 'linear-gradient(rgb(0 0 0/40%) 0 0)',
        },
      },
    },
  },
})
export const table_button_wrapper = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '100%',
    },
  },
})
