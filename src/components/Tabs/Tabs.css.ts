import { app } from '../../css/layers.css'
import { globalStyle, style } from '@vanilla-extract/css'
import { size } from '../../css/size.css'
import { theme } from '../../css/theme'

export const tabs_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      boxShadow: '-2px 2px 4px 0px rgba(0,0,0,0.2)',
      zIndex: 0,
      marginBottom: size['size-3'],

      selectors: {
        '&.borderless': {
          border: 'none',
          borderRadius: '0',
          boxShadow: 'none',
        },
      },
    },
  },
})

export const tabs_header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      borderBottomLeftRadius: '0',
      borderBottomRightRadius: '0',
    },
  },
})

export const tabs_tab = style({
  '@layer': {
    [app]: {
      width: '100%',
      fontWeight: 'bold',
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      cursor: 'pointer',
      padding: `${size['size-2']} ${size['size-3']}`,
      height: '2.5rem',
      flexWrap: 'nowrap',
      borderBottom: `${theme.other?.border.width.thin} ${theme.other?.border.style} ${theme.other?.border.color}`,

      selectors: {
        '&.inactive': {
          borderBottom: 'none',
        },
      },
    },
  },
})

export const tabs_tab_icon = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: 'auto',
      alignItems: 'center',
      display: 'flex',
      marginLeft: size['size-3'],
    },
  },
})

export const tabs_body = style({
  '@layer': {
    [app]: {
      display: 'grid',
      borderSpacing: 0,
      gridTemplateRows: '1fr',
      transition: 'grid-template-rows 0.3s ease-in-out',

      selectors: {
        [`${tabs_wrapper}.inactive > &`]: {
          gridTemplateRows: '0fr',
        },
      },
    },
  },
})

export const tabs_content = style({
  '@layer': {
    [app]: {
      width: '100%',
      height: 'auto',
      overflow: 'hidden',
      padding: `${size['size-3']} ${size['size-3']}`,
      transition: 'padding 0.3s ease-in-out',

      selectors: {
        [`${tabs_wrapper}.inactive > ${tabs_body} > &`]: {
          padding: `0 ${size['size-3']}`,
        },
        [`${tabs_wrapper}.borderless > ${tabs_body} > &`]: {
          paddingLeft: '0',
          paddingRight: '0',
        },
      },
    },
  },
})

globalStyle(`${tabs_tab_icon} svg`, {
  '@layer': {
    [app]: {
      height: '60%',
      width: 'auto',
    },
  },
})
