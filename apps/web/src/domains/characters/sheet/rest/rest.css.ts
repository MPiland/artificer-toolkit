import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

const compact = 'screen and (max-width: 48rem)'

export const popover = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.canvas,
      borderColor: foundationVars.color.border.subtle,
      boxShadow: foundationVars.shadow.floatingControl,
      display: 'grid',
      gap: foundationVars.space[4],
      gridTemplateRows: 'auto minmax(0, 1fr)',
      maxHeight: 'min(44rem, calc(100dvh - 2rem))',
      overflow: 'hidden',
      padding: foundationVars.space[4]
    }
  }
})

export const header = style({
  alignItems: 'center',
  display: 'flex',
  gap: foundationVars.space[3],
  justifyContent: 'space-between'
})

export const title = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.95rem',
  fontWeight: 760
})

export const previewLayout = style({
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  minHeight: 0,
  overflow: 'hidden'
})

export const scrollOwner = style({
  alignContent: 'start',
  display: 'grid',
  gap: foundationVars.space[4],
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
  paddingRight: foundationVars.space[1],
  scrollbarWidth: 'thin'
})

export const drawerViewport = style({
  '@layer': {
    [app]: {
      display: 'grid',
      flex: '1 1 auto',
      minHeight: 0,
      overflow: 'hidden'
    }
  }
})

export const drawerBody = style({
  display: 'grid',
  gap: foundationVars.space[5],
  minHeight: 0,
  padding: `${foundationVars.space[2]} ${foundationVars.space[5]} max(${foundationVars.space[5]}, env(safe-area-inset-bottom))`,
  '@media': {
    [compact]: {
      paddingInline: foundationVars.space[4]
    }
  }
})

export const description = style({
  color: foundationVars.color.text.secondary,
  fontSize: '0.82rem',
  lineHeight: 1.45
})

export const vitals = style({
  borderBlock: `1px solid ${foundationVars.color.border.subtle}`,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
})

export const vital = style({
  display: 'grid',
  gap: foundationVars.space[1],
  minWidth: 0,
  padding: `${foundationVars.space[3]} ${foundationVars.space[2]}`,
  selectors: {
    '&:not(:last-child)': {
      borderRight: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const label = style({
  color: foundationVars.color.text.muted,
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase'
})

export const value = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.9rem',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 760
})

export const section = style({
  border: 0,
  display: 'grid',
  gap: foundationVars.space[3],
  margin: 0,
  minInlineSize: 0,
  padding: 0
})

export const options = style({
  display: 'grid',
  gap: foundationVars.space[2]
})

export const optionRoot = style({
  '@media': {
    '(pointer: coarse)': {
      minHeight: '44px'
    }
  }
})

globalStyle(`${optionRoot} .mantine-Checkbox-body`, {
  '@media': {
    '(pointer: coarse)': {
      alignItems: 'center',
      minHeight: '44px'
    }
  }
})

globalStyle(`${optionRoot} .mantine-Checkbox-inner`, {
  '@media': {
    '(pointer: coarse)': {
      alignItems: 'center',
      display: 'flex',
      minHeight: '44px'
    }
  }
})

globalStyle(`${optionRoot} .mantine-Checkbox-labelWrapper`, {
  '@media': {
    '(pointer: coarse)': {
      alignContent: 'center',
      display: 'grid',
      minHeight: '44px'
    }
  }
})

globalStyle(`${optionRoot} .mantine-Checkbox-label`, {
  fontSize: '0.82rem',
  lineHeight: 1.35
})

globalStyle(`${optionRoot} .mantine-Checkbox-description`, {
  fontSize: '0.75rem',
  lineHeight: 1.35
})

export const sectionHeading = style({
  alignItems: 'baseline',
  display: 'flex',
  flexWrap: 'wrap',
  gap: foundationVars.space[2],
  justifyContent: 'space-between'
})

export const sectionTitle = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.82rem',
  fontWeight: 760
})

export const sectionMeta = style({
  color: foundationVars.color.text.secondary,
  fontSize: '0.75rem'
})

export const hitDiceList = style({
  display: 'grid'
})

export const hitDieRow = style({
  alignItems: 'center',
  display: 'grid',
  gap: foundationVars.space[3],
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  paddingBlock: foundationVars.space[2],
  '@media': {
    '(max-width: 22rem)': {
      alignItems: 'stretch',
      gridTemplateColumns: '1fr'
    }
  },
  selectors: {
    '&:not(:last-child)': {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const hitDieIdentity = style({
  display: 'grid',
  gap: foundationVars.space[1],
  minWidth: 0
})

export const hitDieName = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.88rem',
  fontWeight: 700
})

export const hitDieMeta = style({
  color: foundationVars.color.text.secondary,
  fontSize: '0.75rem',
  lineHeight: 1.35
})

export const stepper = style({
  alignItems: 'center',
  display: 'grid',
  gap: foundationVars.space[2],
  gridTemplateColumns: '36px 34px 36px',
  justifySelf: 'end',
  '@media': {
    '(max-width: 22rem)': {
      justifySelf: 'start'
    },
    '(pointer: coarse)': {
      gridTemplateColumns: '44px 34px 44px'
    }
  }
})

export const stepperButton = style({
  '@layer': {
    [app]: {
      minHeight: '36px',
      minWidth: '36px',
      paddingInline: 0,
      '@media': {
        '(pointer: coarse)': {
          minHeight: '44px',
          minWidth: '44px'
        }
      }
    }
  }
})

export const stepperValue = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.9rem',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 760,
  textAlign: 'center'
})

export const diceAction = style({
  display: 'flex',
  justifyContent: 'center'
})

export const diceButton = style({
  '@layer': {
    [app]: {
      minHeight: '40px',
      minWidth: '148px',
      whiteSpace: 'normal',
      '@media': {
        '(pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

export const recoverySummary = style({
  background: foundationVars.color.surface.subtle,
  border: `1px solid ${foundationVars.color.border.subtle}`,
  borderRadius: foundationVars.radius.md,
  display: 'grid',
  gap: foundationVars.space[2],
  padding: foundationVars.space[3]
})

export const recoveryLine = style({
  alignItems: 'baseline',
  display: 'flex',
  gap: foundationVars.space[3],
  justifyContent: 'space-between',
  '@media': {
    '(max-width: 22rem)': {
      alignItems: 'start',
      flexDirection: 'column',
      gap: foundationVars.space[1]
    }
  }
})

export const recoveryLabel = style({
  color: foundationVars.color.text.secondary,
  fontSize: '0.76rem'
})

export const recoveryValue = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.78rem',
  fontWeight: 700,
  overflowWrap: 'anywhere',
  textAlign: 'right',
  '@media': {
    '(max-width: 22rem)': {
      textAlign: 'left'
    }
  }
})

export const note = style({
  color: foundationVars.color.text.muted,
  fontSize: '0.75rem',
  lineHeight: 1.4
})

export const companionList = style({
  display: 'grid',
  gap: foundationVars.space[2]
})

export const error = style({
  color: foundationVars.color.status.danger,
  fontSize: '0.76rem',
  lineHeight: 1.35
})

export const actions = style({
  background: foundationVars.color.surface.canvas,
  borderTop: `1px solid ${foundationVars.color.border.subtle}`,
  display: 'grid',
  gap: foundationVars.space[3],
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.35fr)',
  paddingTop: foundationVars.space[3],
  '@media': {
    '(max-width: 22rem)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const refreshAction = style({
  gridColumn: '1 / -1'
})

export const actionButton = style({
  '@layer': {
    [app]: {
      minHeight: '40px',
      '@media': {
        '(pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})
