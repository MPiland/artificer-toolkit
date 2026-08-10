import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const cardViewport = style({
  '@layer': {
    [app]: {
      maxHeight: 'min(72dvh, 820px)',
      overflow: 'auto',
      borderRadius: foundationVars.radius.lg
    }
  }
})

export const cardStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const cardRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(var(--authored-list-card-columns), minmax(0, 1fr))',
      gap: foundationVars.space[3]
    }
  }
})

export const card = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'space-between',
      gap: foundationVars.space[4],
      minHeight: '176px',
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      backgroundColor: foundationVars.color.surface.panel,
      cursor: 'pointer',
      transition: `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.accent.border,
        backgroundColor: foundationVars.color.card.background.hover,
        boxShadow: foundationVars.shadow.cardHover
      },

      ':focus-visible': {
        outline: `2px solid ${foundationVars.color.accent.solid}`,
        outlineOffset: '2px',
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const cardHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: foundationVars.space[3]
    }
  }
})

export const cardMetaGroup = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      flexShrink: 0,
      flexWrap: 'wrap',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2]
    }
  }
})

export const cardTitleGroup = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'flex-start',
      minWidth: 0,
      gap: foundationVars.space[2]
    }
  }
})

export const cardSourceDot = style({
  '@layer': {
    [app]: {
      marginTop: foundationVars.space[2]
    }
  }
})

export const cardTitleStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minWidth: 0,
      gap: '2px'
    }
  }
})

export const cardTitle = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.body.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.body.lineHeight,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const cardTitleButton = style({
  '@layer': {
    [app]: {
      display: 'inline-block',
      overflow: 'hidden',
      maxWidth: '100%',
      padding: 0,
      border: 0,
      background: 'transparent',
      color: 'inherit',
      cursor: 'pointer',
      font: 'inherit',
      fontWeight: 'inherit',
      textAlign: 'left',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',

      ':hover': {
        color: foundationVars.color.text.accent
      },

      ':focus-visible': {
        borderRadius: foundationVars.radius.sm,
        boxShadow: foundationVars.shadow.focus,
        outline: 'none'
      }
    }
  }
})

export const cardSubline = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.caption.lineHeight,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const cardFeatureRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minWidth: 0
    }
  }
})

export const levelBadge = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minHeight: '28px',
      padding: `4px ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.caption.lineHeight,
      whiteSpace: 'nowrap'
    }
  }
})

export const cardFeatureText = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const cardFooter = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[3]
    }
  }
})

export const cardFooterMeta = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      minWidth: 0,
      gap: foundationVars.space[2]
    }
  }
})
