import { style, createVar, globalStyle } from '@vanilla-extract/css'
import { app } from '@/css/layers.css'
import { size } from '@/css/size.css'
import { space } from '@/css/size.css'

export const thumb_height = createVar()

export const thumb_top = createVar()

export const list_wrapper = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      flexGrow: 1,
      position: 'relative',
      overflow: 'hidden',
      columnGap: space['space-2'],
      marginRight: '-1rem',
      paddingRight: '1rem',
      paddingBottom: '1rem',
    },
  },
})

export const list_parent = style({
  '@layer': {
    [app]: {
      width: '100%',
      overflow: 'auto',
      position: 'relative',
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',

      selectors: {
        '&::webkit-listbar': {
          display: 'none',
        },
      },
    },
  },
})

export const list = style({
  '@layer': {
    [app]: {
      position: 'relative',
      width: '100%',
      padding: `0 ${size['size-3']}`,

      selectors: {
        '&.grid': {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          columnGap: space['space-3'],
        },
      },
    },
  },
})

export const list_title_container = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'end',
      marginBottom: space['space-2'],
    },
  },
})

export const list_title_button_container = style({
  '@layer': {
    ['app']: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      columnGap: space['space-2'],
    },
  },
})

export const list_item_link_icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      opacity: 0.6,
      height: size['size-4'],
      width: size['size-4'],
    },
  },
})

export const list_sub = style({
  '@layer': {
    [app]: {
      selectors: {
        [`${list} &`]: {
          width: 'auto',
          marginLeft: space['space-10'],
        },
      },
    },
  },
})

export const list_footer_group = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',

      selectors: {
        [`${list}.grid &`]: {
          alignItems: 'end',
        },
      },
    },
  },
})

export const list_footer_item = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: 'fit-content',
      textAlign: 'center',
      flexWrap: 'wrap',
      verticalAlign: 'middle',
    },
  },
})

export const list_layout_icon = style({
  '@layer': {
    [app]: {
      padding: space['space-2'],
      width: size['size-6'],
      height: size['size-6'],
    },
  },
})

globalStyle(`${list_footer_item} > svg`, {
  '@layer': {
    [app]: {
      scale: 0.7,
    },
  },
})
