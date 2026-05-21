import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const root = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[4],
      width: '100%',
      maxWidth: '900px',
      height: 'var(--at-workspace-available-height, calc(100dvh - 112px))',
      minHeight: 0,
      margin: '0 auto',
      minWidth: 0,
      overflow: 'hidden',
      color: foundationVars.color.text.primary
    }
  }
})

export const storyCanvas = style({
  '@layer': {
    [app]: {
      'minHeight': '100dvh',
      'padding': `${foundationVars.space[8]} ${foundationVars.space[6]}`,
      'backgroundColor': foundationVars.color.surface.canvas,
      '@media': {
        [mobile]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'alignItems': 'flex-start',
      'justifyContent': 'space-between',
      'gap': foundationVars.space[4],
      '@media': {
        [mobile]: {
          display: 'grid'
        }
      }
    }
  }
})

export const headerContent = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      minWidth: 0
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '26px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: '1.2'
    }
  }
})

export const statusChip = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '24px',
      padding: `0 ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.pill,
      backgroundColor: foundationVars.color.surface.subtle,
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: 1
    }
  }
})

export const statusChipDraft = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.status.warning,
      backgroundColor: foundationVars.color.status.warningSoft,
      color: foundationVars.color.status.warning
    }
  }
})

export const statusChipActive = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent
    }
  }
})

export const shell = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateRows': 'minmax(0, 1fr) auto',
      'flex': '1 1 auto',
      'height': 'auto',
      'minHeight': 0,
      'overflow': 'hidden'
    }
  }
})

export const contentScroller = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'alignContent': 'start',
      'minHeight': 0,
      'overflowX': 'hidden',
      'overflowY': 'auto',
      'paddingBottom': foundationVars.space[4],
      'scrollbarGutter': 'stable'
    }
  }
})

export const sectionStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[4]
    }
  }
})

export const section = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: '0 0 14px',
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: 'transparent',

      ':last-child': {
        paddingBottom: 0,
        borderBottom: 0
      }
    }
  }
})

export const sectionHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      width: '100%'
    }
  }
})

export const sectionTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '22px',
      letterSpacing: '0.28px',
      textTransform: 'uppercase'
    }
  }
})

export const sectionCopy = style({
  '@layer': {
    [app]: {
      maxWidth: '68ch',
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const mutedText = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary
    }
  }
})

export const dangerIconButton = style({
  '@layer': {
    [app]: {
      'vars': {
        '--ai-bg': foundationVars.color.input.background.default,
        '--ai-bd': `1px solid ${foundationVars.color.status.danger}`,
        '--ai-color': foundationVars.color.status.danger,
        '--ai-hover': foundationVars.color.status.dangerSoft,
        '--ai-hover-color': foundationVars.color.status.danger
      },
      'borderColor': foundationVars.color.status.danger,
      'borderRadius': foundationVars.radius.sm,
      'backgroundColor': foundationVars.color.input.background.default,
      'color': foundationVars.color.status.danger,
      'transition': `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.status.danger,
        backgroundColor: foundationVars.color.status.dangerSoft,
        color: foundationVars.color.status.danger
      }
    }
  }
})
