import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobileBreakpoint = 'screen and (max-width: 760px)'

export const rowActionButton = style({
  '@layer': {
    [app]: {
      vars: {
        '--ai-bg': foundationVars.color.input.background.default,
        '--ai-bd': `1px solid ${foundationVars.color.accent.border}`,
        '--ai-color': foundationVars.color.text.accent,
        '--ai-hover': foundationVars.color.accent.soft,
        '--ai-hover-color': foundationVars.color.text.accent
      },
      width: '34px',
      height: '34px',
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderColor: foundationVars.color.accent.border,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.accent,
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.accent.border,
        backgroundColor: foundationVars.color.accent.soft,
        color: foundationVars.color.text.accent
      },

      ':focus-visible': {
        boxShadow: foundationVars.shadow.focus
      },
      '@media': {
        [mobileBreakpoint]: {
          width: '44px',
          height: '44px'
        }
      }
    }
  }
})

export const dangerActionButton = style({
  '@layer': {
    [app]: {
      vars: {
        '--ai-bg': foundationVars.color.input.background.default,
        '--ai-bd': `1px solid ${foundationVars.color.status.danger}`,
        '--ai-color': foundationVars.color.status.danger,
        '--ai-hover': foundationVars.color.status.dangerSoft,
        '--ai-hover-color': foundationVars.color.status.danger
      },
      backgroundColor: foundationVars.color.input.background.default,
      borderColor: foundationVars.color.status.danger,
      color: foundationVars.color.status.danger,

      ':hover': {
        borderColor: foundationVars.color.status.danger,
        backgroundColor: foundationVars.color.status.dangerSoft,
        color: foundationVars.color.status.danger
      }
    }
  }
})

export const copyActionButton = style({
  '@layer': {
    [app]: {
      vars: {
        '--ai-bg': foundationVars.color.input.background.default,
        '--ai-bd': `1px solid ${foundationVars.color.accent.tertiaryBorder}`,
        '--ai-color': foundationVars.color.accent.tertiarySolid,
        '--ai-hover': foundationVars.color.accent.tertiarySoft,
        '--ai-hover-color': foundationVars.color.accent.tertiaryHover
      },
      border: `1px solid ${foundationVars.color.accent.tertiaryBorder}`,
      borderColor: foundationVars.color.accent.tertiaryBorder,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.accent.tertiarySolid,

      ':hover': {
        borderColor: foundationVars.color.accent.tertiaryBorder,
        backgroundColor: foundationVars.color.accent.tertiarySoft,
        color: foundationVars.color.accent.tertiaryHover
      }
    }
  }
})

export const dangerMenuItem = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger,

      ':hover': {
        backgroundColor: foundationVars.color.status.dangerSoft,
        color: foundationVars.color.status.danger
      }
    }
  }
})

export const copyMenuItem = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.accent.tertiarySolid,

      ':hover': {
        backgroundColor: foundationVars.color.accent.tertiarySoft,
        color: foundationVars.color.accent.tertiaryHover
      }
    }
  }
})

export const moreActionButton = style({
  '@layer': {
    [app]: {
      width: '44px',
      height: '44px',
      borderColor: foundationVars.color.button.secondary.border,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.button.secondary.background,
      color: foundationVars.color.button.secondary.text
    }
  }
})
