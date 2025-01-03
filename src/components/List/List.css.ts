import { style, createVar, globalStyle } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'
import { space } from '../../css/size.css'

export const thumb_height = createVar()

export const thumb_top = createVar()

export const list = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      position: 'relative',
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

export const list_button_container = style({
  '@layer': {
    ['app']: {
      width: '100%',
      display: 'flex',
      justifyContent: 'end',
      columnGap: space['space-2'],
      marginBottom: space['space-4'],
      marginTop: space['space-2'],
    },
  },
})

export const list_container_wrapper = style({
  '@layer': {
    [app]: {
      position: 'relative',
      flex: 1,
      width: '100%',
      padding: `0 ${size['size-3']}`,
      overflowY: 'scroll',
      height: '100%',
      willChange: 'transform',

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

export const list_container = style({
  '@layer': {
    [app]: {
      position: 'relative',
      width: 'inherit',

      selectors: {
        '&.grid': {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          width: '100%',
          columnGap: space['space-3'],
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
        [`${list_container}.grid &`]: {
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
      padding: `0 ${space['space-2']}`,
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
