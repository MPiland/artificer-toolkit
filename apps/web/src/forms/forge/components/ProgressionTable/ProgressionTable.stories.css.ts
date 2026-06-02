import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../../../css/foundations.css.ts'
import { app } from '../../../../css/layers.css.ts'

export const storyCanvas = style({
  '@layer': {
    [app]: {
      display: 'grid',
      justifyItems: 'start',
      minBlockSize: '100dvh',
      padding: foundationVars.space[4],
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary,
      '@media': {
        'screen and (max-width: 640px) and (orientation: portrait)': {
          padding: 0
        }
      }
    }
  }
})

export const tableSurface = style({
  '@layer': {
    [app]: {
      inlineSize: 'min(100%, 42rem)',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.surface.panel,
      overflow: 'hidden'
    }
  }
})

export const tableSurfaceFlat = style({
  '@layer': {
    [app]: {
      inlineSize: '100%',
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const desktopFrame = style({
  '@layer': {
    [app]: {
      inlineSize: '100%'
    }
  }
})

export const mobilePortraitFrame = style({
  '@layer': {
    [app]: {
      inlineSize: 'min(100%, 390px)'
    }
  }
})

export const mobileLandscapeFrame = style({
  '@layer': {
    [app]: {
      inlineSize: 'min(100%, 844px)'
    }
  }
})

export const tabletPortraitFrame = style({
  '@layer': {
    [app]: {
      inlineSize: 'min(100%, 768px)'
    }
  }
})
