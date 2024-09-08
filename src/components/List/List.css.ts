import { style, globalStyle } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { space } from '../../css/size.css'
import { fontSize } from '../../css/typography.css'

export const list_container = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',

      selectors: {
        '&.grid': {
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          width: '100%',
          gap: space['space-3'],
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

export const list_header_title = style({
  '@layer': {
    [app]: {
      'width': 'fit-content',

      '@media': {
        'screen and (max-width: 567px)': {
          width: '100%',
          marginBottom: space['space-1'],
        },
      },
    },
  },
})

export const list_loading = style({
  '@layer': {
    [app]: {
      width: '100%',
      fontSize: fontSize['font-size-2'],
      textAlign: 'center',
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
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      width: 'fit-content',
      textAlign: 'center',
      flexWrap: 'wrap',
      verticalAlign: 'middle',
      padding: `${space['space-2']} ${space['space-2']}`,
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
