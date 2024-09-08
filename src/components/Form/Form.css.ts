import { style, globalStyle } from '@vanilla-extract/css'
import { app } from '../../css/layers.css'
import { size } from '../../css/size.css'
import { fontWeight } from '../../css/typography.css'

export const form_wrapper = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'flexDirection': 'column',
      'position': 'relative',
      'height': '100%',
      'width': '100%',
      'overflow': 'hidden',

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
      paddingTop: size['size-1'],
      padding: `${size['size-3']} ${size['size-4']}`,
      marginBottom: size['size-3'],
    },
  },
})

export const form_content = style({
  '@layer': {
    [app]: {
      position: 'relative',
      paddingLeft: '1rem',
      paddingRight: '1rem',
      height: '100%',
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
      left: 0,
      bottom: 0,
      width: '100%',
      padding: '.5rem .5rem',
    },
  },
})

export const form_remove_button = style({
  '@layer': {
    [app]: {
      width: '2rem',
      height: '1.75rem',
      borderRadius: '.5rem',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: '.5rem',
      marginRight: '.25rem',
    },
  },
})

export const form_add_button = style({
  '@layer': {
    [app]: {
      width: '2rem',
      height: '1.75rem',
      borderRadius: '.5rem',
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: '.25rem',
    },
  },
})

export const feature_content_header = style({
  '@layer': {
    [app]: {
      marginBottom: size['size-3'],
      padding: `0 ${size['size-4']}`,
    },
  },
})

export const feature_list = style({
  '@layer': {
    [app]: {
      width: '80%',
      marginLeft: '10%',
      marginTop: '2rem',
    },
  },
})

export const feature_description = style({
  height: '100%',
})

export const equipment_form_sub_group = style({
  '@layer': {
    [app]: {
      flexDirection: 'row',
      justifyContent: 'end',
      alignItems: 'start',
      flexWrap: 'nowrap',
    },
  },
})

export const equipment_sub_group_button = style({
  '@layer': {
    [app]: {
      marginTop: '19px',
    },
  },
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

globalStyle(`${form_remove_button} svg`, {
  '@layer': {
    [app]: {
      strokeWidth: '3px',
    },
  },
})

globalStyle(`${form_add_button} svg`, {
  '@layer': {
    [app]: {
      strokeWidth: '3px',
    },
  },
})
