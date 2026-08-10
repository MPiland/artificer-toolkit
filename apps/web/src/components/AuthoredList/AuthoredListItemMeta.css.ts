import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const sourceDot = style({
  '@layer': {
    [app]: {
      display: 'block',
      width: '8px',
      height: '8px',
      borderRadius: foundationVars.radius.pill,
      backgroundColor: `var(--authored-list-accent, ${foundationVars.color.accent.solid})`
    }
  }
})

export const chipGroup = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      gap: foundationVars.space[2],
      minWidth: 0
    }
  }
})

export const classChip = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '24px',
      padding: `3px ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: '18px'
    }
  }
})

export const sourceChip = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '24px',
      padding: `3px ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: '18px'
    }
  }
})

export const masterSourceChip = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '24px',
      padding: `3px ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: '18px'
    }
  }
})

export const statusChip = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '24px',
      padding: `3px ${foundationVars.space[2]}`,
      border: `1px solid ${foundationVars.color.border.strong}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.input.background.default,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: '18px'
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
