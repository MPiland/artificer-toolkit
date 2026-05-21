import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const shell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr) auto',
      height: '100dvh',
      overflow: 'hidden',
      background: foundationVars.color.surface.canvas
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'alignItems': 'center',
      'justifyContent': 'space-between',
      'gap': foundationVars.space[4],
      'minHeight': '64px',
      'padding': `0 ${foundationVars.space[13]}`,
      'borderBottom': `1px solid ${foundationVars.color.border.strong}`,
      '@media': {
        [mobile]: {
          padding: `0 ${foundationVars.space[4]}`
        }
      }
    }
  }
})

export const headerMain = style({
  '@layer': {
    [app]: {
      minWidth: 0
    }
  }
})

export const breadcrumbs = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      minWidth: 0
    }
  }
})

export const breadcrumbList = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      flexWrap: 'wrap',
      gap: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      minWidth: 0
    }
  }
})

export const breadcrumbItem = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      color: foundationVars.color.text.primary,
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '20px',

      selectors: {
        '&:not(:last-child)::after': {
          content: "'/'",
          color: foundationVars.color.text.muted,
          fontWeight: foundationVars.fontWeight.regular,
          marginLeft: foundationVars.space[3]
        }
      }
    }
  }
})

export const breadcrumbJoiner = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight,
      userSelect: 'none'
    }
  }
})

export const headerActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      flexShrink: 0
    }
  }
})

export const removeAction = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.status.danger,
      borderColor: foundationVars.color.status.danger,
      background: foundationVars.color.surface.panel
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

export const content = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'alignContent': 'start',
      'gap': foundationVars.space[5],
      'width': '100%',
      'maxWidth': '900px',
      'marginInline': 'auto',
      'padding': `${foundationVars.space[8]} ${foundationVars.space[13]}`,
      'overflow': 'auto',
      '@media': {
        [mobile]: {
          padding: foundationVars.space[4]
        }
      }
    }
  }
})
