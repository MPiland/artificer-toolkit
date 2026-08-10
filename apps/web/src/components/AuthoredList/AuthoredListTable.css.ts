import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const tableScroll = style({
  '@layer': {
    [app]: {
      height: '100%',
      width: '100%',
      minWidth: 0,
      maxWidth: '100%',
      overflow: 'auto'
    }
  }
})

export const table = style({
  '@layer': {
    [app]: {
      width: '100%',
      minWidth: '1188px',
      borderCollapse: 'separate',
      borderSpacing: 0,
      tableLayout: 'fixed'
    }
  }
})

export const tableHead = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      top: 0,
      zIndex: 2,
      backgroundColor: foundationVars.color.surface.recessed
    }
  }
})

export const tableHeaderCell = style({
  '@layer': {
    [app]: {
      height: '36px',
      padding: `0 ${foundationVars.space[2]}`,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      color: foundationVars.color.text.muted,
      fontFamily: foundationVars.font.mono,
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.medium,
      letterSpacing: '0.04em',
      textAlign: 'left',
      textTransform: 'uppercase',
      whiteSpace: 'nowrap'
    }
  }
})

export const tableHeaderEdgeStart = style({
  '@layer': {
    [app]: {
      borderLeft: 0
    }
  }
})

export const tableHeaderEdgeEnd = style({
  '@layer': {
    [app]: {
      borderRight: 0
    }
  }
})

export const tableBodyCell = style({
  '@layer': {
    [app]: {
      height: '52px',
      padding: `0 ${foundationVars.space[2]}`,
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      whiteSpace: 'nowrap',
      selectors: {
        'tr:hover &': {
          backgroundColor: foundationVars.color.card.background.hover
        },
        'tr:focus-visible &': {
          borderColor: foundationVars.color.accent.border
        }
      }
    }
  }
})

export const tableBodyEdgeStart = style({
  '@layer': {
    [app]: {
      borderLeft: 0
    }
  }
})

export const tableBodyEdgeEnd = style({
  '@layer': {
    [app]: {
      borderRight: 0
    }
  }
})

export const spacerCell = style({
  '@layer': {
    [app]: {
      padding: 0,
      border: 0
    }
  }
})

export const listRow = style({
  '@layer': {
    [app]: {
      cursor: 'pointer',
      outline: 'none',
      transition: `background-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease`,

      ':hover': {
        backgroundColor: foundationVars.color.card.background.hover
      },

      ':focus-visible': {
        boxShadow: foundationVars.shadow.focus
      }
    }
  }
})

export const dotCell = style({
  '@layer': {
    [app]: {
      width: '32px',
      paddingInline: foundationVars.space[3]
    }
  }
})

export const nameCell = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.medium
    }
  }
})

export const nameColumnNoAccent = style({
  '@layer': {
    [app]: {
      paddingLeft: foundationVars.space[4]
    }
  }
})

export const itemNameButton = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      maxWidth: '100%',
      padding: 0,
      border: 0,
      background: 'transparent',
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      font: 'inherit',
      fontWeight: foundationVars.fontWeight.medium,
      textAlign: 'left',

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

export const nameHierarchy = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      maxWidth: '100%',
      gap: foundationVars.space[2],
      paddingLeft: `calc(var(--authored-list-hierarchy-level, 0) * ${foundationVars.space[5]})`
    }
  }
})

export const hierarchyMarker = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      width: '14px',
      height: '1px',
      backgroundColor: foundationVars.color.border.strong
    }
  }
})

export const monoCell = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      fontFamily: foundationVars.font.mono
    }
  }
})

export const chipCell = style({
  '@layer': {
    [app]: {
      overflow: 'hidden'
    }
  }
})

export const statusCell = style({
  '@layer': {
    [app]: {
      overflow: 'hidden'
    }
  }
})

export const actionCell = style({
  '@layer': {
    [app]: {
      textAlign: 'left',
      width: '132px'
    }
  }
})
