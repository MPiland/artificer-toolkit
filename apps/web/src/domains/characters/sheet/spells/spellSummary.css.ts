import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const sectionHeadingRow = style({
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px 12px',
      justifyContent: 'space-between'
    }
  }
})

export const spellCastingSummary = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flex: '1 1 auto',
      flexWrap: 'wrap',
      gap: '8px 20px',
      minHeight: '28px',
      minWidth: 0,
      '@media': {
        '(max-width: 760px)': {
          gap: '6px 14px'
        }
      }
    }
  }
})

export const spellSummaryRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between',
      minWidth: 0
    }
  }
})

globalStyle(`${spellCastingSummary} > span`, {
  '@layer': {
    [app]: {
      alignItems: 'baseline',
      display: 'inline-flex',
      gap: '6px'
    }
  }
})

globalStyle(`${spellCastingSummary} small`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.64rem',
      fontWeight: 700,
      textTransform: 'uppercase'
    }
  }
})

export const spellSlotSection = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: '10px',
      minWidth: 0
    }
  }
})

export const spellSlotHeading = style({
  '@layer': {
    [app]: {
      flex: '0 0 auto',
      fontSize: '0.78rem'
    }
  }
})

export const spellSlotGrid = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gap: '6px',
      minWidth: 0,
      overflowX: 'auto',
      padding: '2px',
      scrollbarWidth: 'thin'
    }
  }
})

export const spellSlotCell = style({
  '@layer': {
    [app]: {
      appearance: 'none',
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      display: 'inline-flex',
      flex: '0 0 auto',
      font: 'inherit',
      gap: '5px',
      alignItems: 'baseline',
      minHeight: '34px',
      padding: '4px 8px',
      textAlign: 'center',
      transition: 'border-color 180ms ease-out, background-color 180ms ease-out',
      '@media': {
        '(pointer: coarse)': {
          minHeight: '44px',
          paddingInline: '10px'
        }
      },
      selectors: {
        '&:hover': {
          background: foundationVars.color.surface.subtle,
          borderColor: foundationVars.color.accent.solid
        },
        '&:focus-visible': {
          outline: `2px solid ${foundationVars.color.accent.solid}`,
          outlineOffset: '2px'
        }
      }
    }
  }
})

globalStyle(`${spellSlotCell} span`, {
  '@layer': { [app]: { color: foundationVars.color.text.secondary, fontSize: '0.7rem' } }
})

globalStyle(`${spellSlotCell} strong`, {
  '@layer': { [app]: { fontVariantNumeric: 'tabular-nums' } }
})
