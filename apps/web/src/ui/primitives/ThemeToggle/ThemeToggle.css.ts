import { style, styleVariants } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const themeToggleRoot = style({
  '@layer': {
    [app]: {
      display: 'inline-flex'
    }
  }
})

export const themeToggleButton = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '40px',
      height: '40px',
      padding: 0,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.text.secondary,
      cursor: 'pointer',
      boxShadow: foundationVars.shadow.card,
      font: 'inherit',
      transition: [
        `background-color ${foundationVars.motion.fast} ease`,
        `border-color ${foundationVars.motion.fast} ease`,
        `color ${foundationVars.motion.fast} ease`,
        `box-shadow ${foundationVars.motion.fast} ease`,
        `transform ${foundationVars.motion.fast} ease`
      ].join(', ')
    }
  },
  'selectors': {
    '&:hover': {
      borderColor: foundationVars.color.accent.border,
      color: foundationVars.color.text.primary,
      transform: 'translateY(-1px)'
    },
    '&:disabled': {
      cursor: 'default',
      opacity: 0.72,
      transform: 'none'
    },
    '&:disabled:hover': {
      borderColor: foundationVars.color.border.subtle,
      color: foundationVars.color.text.secondary
    },
    '&:focus-visible': {
      outline: 'none',
      boxShadow: foundationVars.shadow.focus
    }
  }
})

export const themeToggleButtonIntent = styleVariants({
  light: {
    '@layer': {
      [app]: {
        backgroundColor: foundationVars.color.surface.panel
      }
    }
  },
  dark: {
    '@layer': {
      [app]: {
        backgroundColor: foundationVars.color.accent.soft,
        borderColor: foundationVars.color.accent.border,
        color: foundationVars.color.text.primary
      }
    }
  }
})

export const themeToggleIcon = style({
  '@layer': {
    [app]: {
      width: '18px',
      height: '18px',
      flexShrink: 0
    }
  }
})

export const visuallyHidden = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      width: '1px',
      height: '1px',
      padding: 0,
      margin: '-1px',
      overflow: 'hidden',
      clip: 'rect(0, 0, 0, 0)',
      whiteSpace: 'nowrap',
      border: 0
    }
  }
})
