import { style, globalStyle } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size, space } from '../../css/size.css'
import { fontWeight } from '../../css/typography.css'
import { theme } from '../../css/theme.css'

export const form_wrapper = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'flexDirection': 'column',
      'position': 'relative',
      'height': '100%',
      'width': '100%',

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
      padding: `${space['space-4']} 0`,
      marginBottom: space['space-3'],
    },
  },
})

export const form_content = style({
  '@layer': {
    [app]: {
      position: 'relative',
      flexGrow: 1,
      width: '100%',
    },
  },
})

export const form_footer = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      alignItems: 'center',
      paddingLeft: '.75rem',
      paddingRight: '.75rem',
      borderTop: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.content.border.color.main}`,
      left: 0,
      bottom: 0,
      width: '100%',
      padding: '.5rem .5rem',
    },
  },
})

export const row_button = style({
  '@layer': {
    [app]: {
      width: '1.5rem',
      height: 'auto',
      borderRadius: '.5rem',
      alignItems: 'center',
      justifyContent: 'center',
    },
  },
})

export const feature_list_button_container = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      paddingTop: space['space-4'],
    },
  },
})

export const feature_list = style({
  '@layer': {
    [app]: {
      width: '100%',
      marginTop: '2rem',
    },
  },
})

export const feature_description = style({
  height: '100%',
})

export const form_detail_title = style({
  '@layer': {
    [app]: {
      fontWeight: fontWeight['font-weight-7'],
    },
  },
})

export const form_detail_main = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'row',
      height: '100%',
      width: '100%',
      overflow: 'hidden',
    },
  },
})

export const form_detail_body = style({
  '@layer': {
    [app]: {
      position: 'relative',
      zIndex: 1,
      padding: `0 ${size['size-3']}`,
      flex: '1 1 0',
      overflowY: 'auto',
    },
  },
})

globalStyle(`${form_detail_body} td`, {
  '@layer': {
    [app]: {
      verticalAlign: 'top',
      padding: '0 .125rem',
    },
  },
})

globalStyle(`${form_detail_body} th`, {
  '@layer': {
    [app]: {
      textAlign: 'start',
      padding: '0 .125rem',
    },
  },
})

globalStyle(`${form_detail_body} blockquote`, {
  '@layer': {
    [app]: {
      marginLeft: size['size-3'],
      marginTop: size['size-2'],
      padding: size['size-1'],
    },
  },
})
