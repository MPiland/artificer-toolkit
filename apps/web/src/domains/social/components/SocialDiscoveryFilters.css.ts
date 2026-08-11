import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

export const filterGroupFields = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const filterGroups = style({
  '@layer': {
    [app]: {
      display: 'grid',
      inlineSize: '100%'
    }
  }
})

export const filterGroupItem = style({
  '@layer': {
    [app]: {
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const filterGroupControl = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      inlineSize: '100%',
      minBlockSize: '44px',
      padding: `${foundationVars.space[3]} 0`,
      border: 0,
      borderRadius: foundationVars.radius.md,
      background: 'transparent',
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      textAlign: 'start',
      selectors: {
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 'none'
        }
      }
    }
  }
})

export const filterGroupLabel = style({
  '@layer': {
    [app]: {
      flex: 1,
      order: 1,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const filterGroupChevron = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      marginInlineStart: 'auto',
      order: 2,
      color: foundationVars.color.text.secondary,
      transition: `transform ${foundationVars.motion.fast} ease`,
      selectors: {
        '&[data-rotate]': {
          transform: 'rotate(180deg)'
        }
      },
      '@media': {
        '(prefers-reduced-motion: reduce)': {
          transition: 'none'
        }
      }
    }
  }
})

export const filterGroupContent = style({
  '@layer': {
    [app]: {
      padding: `0 0 ${foundationVars.space[4]}`
    }
  }
})
