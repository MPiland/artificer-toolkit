import { style } from '@vanilla-extract/css'
import { app } from '../css/layers.css'
import { theme } from '../css/theme.css'
import { size } from '../css/size.css'

export const layout = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'height': '100dvh',
      'width': '100%',
      'overflow': 'hidden',
      'backgroundColor': theme.vars.component.content.backgroundColor.main,

      '@media': {
        'screen and (min-width: 1025px)': {
          gridTemplateColumns: `auto 1fr`,
          gridTemplateRows: `auto 1fr`,
          gridTemplateAreas: `
            "sidebar header"
            "sidebar content"
          `,
          selectors: {
            '&.collapsed': {
              gridTemplateColumns: `${theme.component.appShell.sidebar.spacing.width.collapsed} 1fr`,
            },
          },
        },
        'screen and (max-width: 1024px)': {
          gridTemplateColumns: '1fr',
          gridTemplateRows: `${theme.component.appShell.header.spacing.height} 1fr`,
          gridTemplateAreas: `
            "header"
            "content"
          `,
          selectors: {
            '&.collapsed': {
              gridTemplateColumns: '1fr',
            },
          },
        },
      },
    },
  },
})

export const content = style({
  '@layer': {
    [app]: {
      'gridArea': 'content',
      'overflow': 'hidden',
      'backgroundColor': theme.vars.component.content.backgroundColor.main,
      'color': theme.vars.typography.color.main,
      'padding': `${size['size-4']} 8rem 0`,
      'display': 'flex',
      'flexDirection': 'column',

      '@media': {
        'screen and (max-width: 567px)': {
          padding: `${size['size-4']} ${size['size-3']} 0`,
        },
        'screen and (max-width: 1440px)': {
          padding: `${size['size-4']} ${size['size-8']} 0`,
        },
      },
    },
  },
})
