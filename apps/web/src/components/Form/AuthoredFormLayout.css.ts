import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const root = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      width: '100%',
      color: foundationVars.color.text.primary
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[4]
    }
  },
  '@media': {
    [mobile]: {
      display: 'grid'
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

export const eyebrow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '13px',
      fontWeight: foundationVars.fontWeight.medium,
      letterSpacing: '0'
    }
  }
})

export const shell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr) auto',
      minHeight: 'calc(100dvh - 104px)'
    }
  },
  '@media': {
    [mobile]: {
      minHeight: 'auto'
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
      backgroundColor: 'transparent'
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

export const footer = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      bottom: 0,
      display: 'flex',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      marginTop: foundationVars.space[4],
      minHeight: '56px',
      padding: `${foundationVars.space[2]} 0`,
      borderTop: `1px solid ${foundationVars.color.border.strong}`,
      backgroundColor: foundationVars.color.surface.canvas
    }
  },
  '@media': {
    [mobile]: {
      position: 'static',
      display: 'grid'
    }
  }
})

globalStyle(`${section} .mantine-Input-input`, {
  minHeight: '40px',
  borderColor: foundationVars.color.input.border.default,
  borderRadius: foundationVars.radius.md,
  backgroundColor: foundationVars.color.input.background.default,
  color: foundationVars.color.text.primary,
  fontSize: '14px'
})

globalStyle(`${section} .mantine-Input-input:disabled, ${section} .mantine-Input-input[readonly], ${section} .mantine-Input-input[data-disabled="true"]`, {
  borderColor: foundationVars.color.input.border.disabled,
  backgroundColor: foundationVars.color.input.background.disabled,
  color: foundationVars.color.text.muted
})

globalStyle(`${section} .mantine-InputWrapper-label`, {
  color: foundationVars.color.text.secondary,
  fontSize: foundationVars.typography.label.fontSize,
  fontWeight: foundationVars.fontWeight.medium,
  lineHeight: foundationVars.typography.label.lineHeight
})

globalStyle(`${section} .mantine-MultiSelect-pill`, {
  border: `1px solid ${foundationVars.color.accent.border}`,
  borderRadius: foundationVars.radius.pill,
  backgroundColor: foundationVars.color.accent.soft,
  color: foundationVars.color.text.accent,
  fontSize: '11px',
  fontWeight: foundationVars.fontWeight.medium
})
