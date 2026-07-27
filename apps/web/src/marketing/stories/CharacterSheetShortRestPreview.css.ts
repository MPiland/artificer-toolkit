import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

const compact = 'screen and (max-width: 760px)'

export const popoverAnchor = style({
  position: 'fixed',
  right: '172px',
  top: '180px',
  width: '104px',
  height: '40px',
  opacity: 0,
  pointerEvents: 'none'
})

export const popover = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.canvas,
      borderColor: foundationVars.color.border.subtle,
      display: 'grid',
      gap: foundationVars.space[4],
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

export const description = style({
  color: foundationVars.color.text.secondary,
  fontSize: '0.82rem',
  lineHeight: 1.45
})

export const body = style({
  display: 'grid',
  gap: foundationVars.space[4]
})

export const drawerBody = style({
  display: 'grid',
  gap: foundationVars.space[5],
  padding: foundationVars.space[5]
})

export const vitals = style({
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  borderBlock: `1px solid ${foundationVars.color.border.subtle}`,
  '@media': {
    [compact]: {
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
    }
  }
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
  fontSize: '0.68rem',
  fontWeight: 700,
  letterSpacing: '0.04em',
  textTransform: 'uppercase'
})

export const value = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.9rem',
  fontWeight: 760
})

export const section = style({
  display: 'grid',
  gap: foundationVars.space[3]
})

export const options = style({
  display: 'grid',
  gap: foundationVars.space[2]
})

export const sectionHeading = style({
  alignItems: 'baseline',
  display: 'flex',
  gap: foundationVars.space[3],
  justifyContent: 'space-between'
})

export const sectionTitle = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.82rem',
  fontWeight: 760
})

export const sectionMeta = style({
  color: foundationVars.color.text.secondary,
  fontSize: '0.74rem'
})

export const hitDieRow = style({
  alignItems: 'center',
  display: 'grid',
  gap: foundationVars.space[3],
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  paddingBlock: foundationVars.space[2],
  selectors: {
    '&:not(:last-child)': {
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`
    }
  }
})

export const hitDiceList = style({
  display: 'grid'
})

export const hitDieIdentity = style({
  display: 'grid',
  gap: foundationVars.space[1]
})

export const hitDieName = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.88rem',
  fontWeight: 700
})

export const hitDieMeta = style({
  color: foundationVars.color.text.secondary,
  fontSize: '0.74rem'
})

export const stepper = style({
  alignItems: 'center',
  display: 'grid',
  gap: foundationVars.space[2],
  gridTemplateColumns: '36px 34px 36px'
})

export const stepperButton = style({
  '@layer': {
    [app]: {
      minHeight: '36px',
      minWidth: '36px',
      paddingInline: 0
    }
  }
})

export const stepperValue = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.9rem',
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
      minWidth: '148px'
    }
  }
})

export const recoverySummary = style({
  display: 'grid',
  gap: foundationVars.space[2],
  padding: foundationVars.space[3],
  border: `1px solid ${foundationVars.color.border.subtle}`,
  borderRadius: foundationVars.radius.md,
  background: foundationVars.color.surface.subtle
})

export const recoveryLine = style({
  alignItems: 'baseline',
  display: 'flex',
  gap: foundationVars.space[3],
  justifyContent: 'space-between'
})

export const recoveryLabel = style({
  color: foundationVars.color.text.secondary,
  fontSize: '0.76rem'
})

export const recoveryValue = style({
  color: foundationVars.color.text.primary,
  fontSize: '0.78rem',
  fontWeight: 700,
  textAlign: 'right'
})

export const note = style({
  color: foundationVars.color.text.muted,
  fontSize: '0.72rem',
  lineHeight: 1.4
})

export const actions = style({
  display: 'grid',
  gap: foundationVars.space[3],
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.35fr)',
  paddingTop: foundationVars.space[1]
})
