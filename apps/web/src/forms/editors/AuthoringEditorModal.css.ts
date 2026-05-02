import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const shell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr) auto',
      minHeight: '100dvh',
      background: foundationVars.color.surface.canvas
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: '64px',
      padding: `0 ${foundationVars.space[13]}`,
      borderBottom: `1px solid ${foundationVars.color.border.strong}`
    }
  },
  '@media': {
    [mobile]: {
      padding: `0 ${foundationVars.space[4]}`
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.heading.fontSize,
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: foundationVars.typography.heading.lineHeight,
      margin: 0
    }
  }
})

export const content = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gap: foundationVars.space[5],
      width: '100%',
      maxWidth: '900px',
      padding: `${foundationVars.space[8]} ${foundationVars.space[13]}`,
      overflow: 'auto'
    }
  },
  '@media': {
    [mobile]: {
      padding: foundationVars.space[4]
    }
  }
})

export const footer = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: foundationVars.space[3],
      minHeight: '56px',
      padding: `${foundationVars.space[2]} ${foundationVars.space[13]}`,
      borderTop: `1px solid ${foundationVars.color.border.strong}`,
      background: foundationVars.color.surface.header
    }
  },
  '@media': {
    [mobile]: {
      padding: foundationVars.space[4]
    }
  }
})
