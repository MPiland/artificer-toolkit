import { createVar, globalStyle, style } from '@vanilla-extract/css'
import { theme } from '../../css/theme.css'
import { size } from '../../css/size.css'
import { app } from '../../css/layers.css'
import { fontSize } from '../../css/typography.css'

export const card_content_collapsed_height = createVar()

export const card = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      width: 'inherit',
      height: 'auto',
      borderRadius: theme.border.radius,
      border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
      marginBottom: size['size-4'],
      backgroundColor: theme.vars.component.card.backgroundColor.main,
      color: theme.vars.typography.color.main,
    },
  },
})

export const card_header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      borderBottom: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
      padding: `${size['size-4']} ${size['size-4']}`,
      backgroundColor: theme.vars.component.card.backgroundColor.header,
      alignItems: 'center',
    },
  },
})

export const card_header_title_container = style({
  '@layer': {
    [app]: {
      display: 'flex',
      width: 'fit-content',
      columnGap: size['size-2'],
      alignItems: 'center',
    },
  },
})

export const card_header_title = style({
  '@layer': {
    [app]: {
      textWrap: 'nowrap',
    },
  },
})

export const card_header_icon_container = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      height: '100%',
      justifyContent: 'end',
      cursor: 'pointer',
    },
  },
})

export const card_header_icon = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: 'auto',
      transition: 'rotate .3s ease-in-out',

      selectors: {
        '&.collapsed': {
          rotate: '180deg',
          transition: 'rotate .3s ease-in-out',
        },
      },
    },
  },
})

export const card_content_wrapper = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      padding: `${size['size-4']} ${size['size-4']}`,
      height: '100%',
    },
  },
})

export const card_content = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden',
      height: card_content_collapsed_height,
      transition: 'height .3s ease-in-out',
      contain: 'style',

      selectors: {
        '&.collapsed': {
          height: '1rem',
          transition: 'height .3s ease-in-out',
        },
      },
    },
  },
})

export const card_content_truncated = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  },
})

export const card_footer = style({
  '@layer': {
    [app]: {
      padding: `${size['size-2']} ${size['size-2']}`,
      borderTop: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
    },
  },
})

globalStyle(`${card_footer} *`, {
  '@layer': {
    [app]: {
      fontSize: fontSize['font-size-00'],
    },
  },
})

globalStyle(`${card_content} p:last-of-type`, {
  '@layer': {
    [app]: {
      marginBottom: 0,
    },
  },
})

globalStyle(`${card_content} p:first-of-type`, {
  '@layer': {
    [app]: {
      marginTop: 0,
    },
  },
})
