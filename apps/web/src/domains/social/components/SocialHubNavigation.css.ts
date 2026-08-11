import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const desktopNavigation = style({
  '@layer': {
    [app]: {
      inlineSize: '100%',
      minInlineSize: 0,
      '@media': { [media.mobile]: { display: 'none' } }
    }
  }
})

export const tab = style({
  '@layer': {
    [app]: {
      backgroundColor: 'transparent',
      color: foundationVars.color.text.secondary,
      selectors: {
        '&:hover': {
          backgroundColor: 'transparent',
          color: foundationVars.color.text.primary
        },
        '&[data-active]': {
          backgroundColor: 'transparent',
          color: foundationVars.color.text.primary
        }
      }
    }
  }
})

export const mobileNavigation = style({
  '@layer': {
    [app]: {
      display: 'none',
      '@media': { [media.mobile]: { display: 'block' } }
    }
  }
})

export const drawerNavigation = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1]
    }
  }
})

export const drawerItem = style({
  '@layer': {
    [app]: {
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      minBlockSize: '48px',
      inlineSize: '100%',
      paddingInline: foundationVars.space[3],
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.medium,
      selectors: {
        '&:hover': {
          backgroundColor: foundationVars.color.surface.subtle
        },
        '&:focus-visible': {
          outline: 'none',
          boxShadow: foundationVars.shadow.focus
        },
        '&[data-active]': {
          backgroundColor: foundationVars.color.accent.soft,
          color: foundationVars.color.text.accent
        }
      }
    }
  }
})
