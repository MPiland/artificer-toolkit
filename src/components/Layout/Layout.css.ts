import { style } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { fontSize } from '../../css/typography.css'
import { theme } from '../../css/global.css'
import { size } from '../../css/size.css'
import palette from '../../css/colors.css'

export const header_title = style({
  '@layer': {
    [app]: {
      margin: 'auto 0',
      fontSize: 'larger',
      fontWeight: '600',
      order: 2,
      cursor: 'pointer',
      textWrap: 'nowrap',
    },
  },
})

export const sidebar_item_group = style({
  '@layer': {
    [app]: {
      listStyleType: 'none',
      padding: '0',
    },
  },
})

export const header_item_group = style({
  '@layer': {
    [app]: {
      marginLeft: 'auto',
      listStyleType: 'none',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      order: 3,
      padding: '0',
      height: '100%',
    },
  },
})

export const header_item = style({
  '@layer': {
    [app]: {
      textAlign: 'start',
      fontSize: fontSize['font-size-1'],
      textDecoration: 'none',

      selectors: {
        [`${sidebar_item_group} &`]: {
          height: 'auto',
        },
        '&:visited': {
          color: theme.vars['app-color'],
        },
      },
    },
  },
})

export const header_nav_item = style({
  '@layer': {
    [app]: {
      textDecoration: 'none',
      fontSize: 'inherit',
      padding: `${size['size-1']} ${size['size-2']}`,
      cursor: 'pointer',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',

      selectors: {
        '&:visited': {
          color: theme.vars['app-color'],
        },
        '&:last-of-type': {
          paddingRight: size['size-5'],
        },
        '&:hover': {
          backgroundColor: palette['gray-3'],
        },
      },
    },
  },
})
