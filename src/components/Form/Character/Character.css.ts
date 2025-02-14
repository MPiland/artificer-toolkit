import { style } from '@vanilla-extract/css'
import { app } from '../../../css/layers.css'
import { size, space } from '../../../css/size.css'
import { fontSize } from '../../../css/typography.css'
import { theme } from '../../../css/theme.css'

export const option_dropdown = style({
  '@layer': {
    [app]: {
      'width': 'auto',
      'margin': `${space['space-3']} ${space['space-15']}`,

      '@media': {
        'screen and (min-width: 568px) and (max-width: 1024px)': {
          margin: `0 ${space['space-10']}`,
        },
        'screen and (max-width: 567px)': {
          margin: `0 ${space['space-3']}`,
        },
      },
    },
  },
})

export const card_group = style({
  '@layer': {
    [app]: {
      'padding': `0 ${space['space-10']}`,
      'marginBottom': space['space-3'],

      '@media': {
        'screen and (min-Width: 568px) and (max-width: 1024px)': {
          padding: `0 ${space['space-12']}`,
        },
        'screen and (max-width: 567px)': {
          padding: `0 ${space['space-10']}`,
        },
      },
    },
  },
})

export const main_card = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      height: '3.5rem',
      border: `${theme.border.size.main} ${theme.border.style} ${theme.vars.component.card.border.color.main}`,
      borderRadius: theme.border.radius,

      selectors: {
        '&.clickable:hover': {
          cursor: 'pointer',
        },
      },
    },
  },
})

export const card_header = style({
  '@layer': {
    [app]: {
      marginLeft: size['size-3'],
    },
  },
})

export const card_header_title = style({
  '@layer': {
    [app]: {
      marginRight: size['size-3'],

      selectors: {
        '&.selected': {
          textDecoration: 'line-through',
        },
        '&.invalid': {
          textDecoration: 'line-through',
        },
      },
    },
  },
})

export const card_header_subtext = style({
  '@layer': {
    [app]: {
      fontSize: fontSize['font-size-00'],
    },
  },
})

export const subrace_card = style({
  '@layer': {
    [app]: {
      marginLeft: `${size['size-3']}`,
      marginRight: `${size['size-10']}`,
      borderRadius: '0px',
      borderTop: 'none',
    },
  },
})

export const feature_card = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      width: 'auto',
      height: 'auto',
      boxShadow: '-2px 2px 4px 0px rgba(0,0,0,0.2)',
      marginBottom: size['size-3'],
    },
  },
})

export const feature_card_header = style({
  '@layer': {
    [app]: {
      padding: `0 ${size['size-3']}`,
      height: '2.5rem',
      display: 'flex',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
  },
})

export const feature_card_body = style({
  '@layer': {
    [app]: {
      padding: size['size-3'],
      marginBottom: size['size-1'],
    },
  },
})

export const character_header_body = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
    },
  },
})

export const character_header_group = style({
  '@layer': {
    [app]: {
      marginRight: size['size-3'],
      marginBottom: size['size-3'],
      width: 'auto',
    },
  },
})

export const character_header_group_label = style({
  '@layer': {
    [app]: {
      textDecoration: 'underline',
      marginBottom: size['size-2'],
    },
  },
})

export const character_header_item = style({
  '@layer': {
    [app]: {
      width: 'auto',
    },
  },
})

export const character_header_item_divier = style({
  '@layer': {
    [app]: {
      margin: `0 ${size['size-3']}`,
    },
  },
})

export const character_header_item_label = style({
  '@layer': {
    [app]: {
      marginRight: size['size-1'],
    },
  },
})

export const class_title = style({
  '@layer': {
    [app]: {
      marginRight: size['size-3'],
    },
  },
})

export const system_select = style({
  '@layer': {
    [app]: {
      width: size['size-14'],
      marginBottom: size['size-3'],
    },
  },
})

export const dice_section = style({
  '@layer': {
    [app]: {
      marginBottom: size['size-3'],

      selectors: {
        '&:not(:first-of-type)': {
          marginTop: size['size-3'],
        },
      },
    },
  },
})

export const dice_group = style({
  '@layer': {
    [app]: {
      width: '100%',
    },
  },
})

export const dice_group_header = style({
  '@layer': {
    [app]: {
      width: '100%',
    },
  },
})

export const dice_group_footer = style({
  '@layer': {
    [app]: {
      width: '100%',
      marginTop: size['size-3'],
    },
  },
})

export const dice_group_divider = style({
  '@layer': {
    [app]: {
      height: '3px',
      width: '100%',
    },
  },
})

export const dice_roll_group = style({
  '@layer': {
    [app]: {
      'width': 'auto',

      '@media': {
        'screen and (min-width: 1024px) and (max-width: 1300px)': {
          width: 'auto',
        },
      },
    },
  },
})

export const dice_roll_value = style({
  '@layer': {
    [app]: {
      'fontSize': '1.75rem',
      'fontWeight': '700',
      'pointerEvents': 'none',
      'border': 'none',
      'height': '100%',

      '@media': {
        'screen and (max-width: 567px)': {
          fontSize: '1.5rem',
        },
      },
    },
  },
})

export const dice_roll_value_group = style({
  '@layer': {
    [app]: {
      marginBottom: size['size-3'],
      height: '4rem',
      flexWrap: 'nowrap',
    },
  },
})

export const dice_roll_dropdown = style({
  '@layer': {
    [app]: {
      width: '100%',
    },
  },
})

export const dice_spinner = style({
  '@layer': {
    [app]: {
      height: '100%',
      marginBottom: size['size-3'],
      vars: {
        '--spinner-size': '2rem',
        '--spinner-thickness': '4px',
      },
    },
  },
})

export const ability_group = style({
  '@layer': {
    [app]: {
      marginBottom: size['size-3'],
    },
  },
})

export const ability_label = style({
  '@layer': {
    [app]: {
      width: 'auto',
    },
  },
})

export const ability_card_group = style({
  '@layer': {
    [app]: {
      marginBottom: size['size-3'],
    },
  },
})

export const ability_card = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
    },
  },
})

export const ability_card_header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      fontWeight: 'bold',
      padding: `${size['size-2']} ${size['size-3']}`,
    },
  },
})

export const ability_card_info = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      minHeight: size['size-8'],
      padding: `${size['size-2']} ${size['size-3']}`,
      alignItems: 'center',
      justifyContent: 'space-evenly',
    },
  },
})

export const ability_card_info_label = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'row',
      width: '100%',
      textAlign: 'left',
    },
  },
})

export const ability_card_info_value = style({
  '@layer': {
    [app]: {
      width: size['size-8'],
      textAlign: 'right',
    },
  },
})

export const roll_score_group = style({
  '@layer': {
    [app]: {
      columnGap: '.25rem',
    },
  },
})

export const roll_score_box = style({
  '@layer': {
    [app]: {
      'height': '1.75rem',
      'margin': 'auto',

      '@media': {
        'screen and (min-width: 710px) and (max-width: 1300px)': {
          height: '1.5rem',
        },
      },
    },
  },
})

export const roll_score = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'alignItems': 'center',
      'justifyContent': 'center',
      'color': 'white',
      'borderRadius': '.25rem',
      'height': '100%',
      'width': '1.5rem',

      '@media': {
        'screen and (min-width: 710px) and (max-width: 1300px)': {
          width: '1.5rem',
        },
        'screen and (max-width: 710px)': {
          width: '1.5rem',
        },
      },
    },
  },
})

export const point_counter = style({
  '@layer': {
    [app]: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignContent: 'center',
      flexWrap: 'wrap',
      textAlign: 'center',
      marginBottom: size['size-3'],
    },
  },
})

export const point_counter_label = style({
  '@layer': {
    [app]: {
      fontSize: '18px',
      fontWeight: '400',
    },
  },
})
