import { style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css.ts'
import { app } from '../css/layers.css.ts'

export const shellRoot = style({
  '@layer': {
    [app]: {
      minHeight: '100dvh',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary,
      padding: foundationVars.space[6]
    }
  }
})

export const publicFrame = style({
  '@layer': {
    [app]: {
      margin: '0 auto',
      maxWidth: '1200px'
    }
  }
})

export const brandRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      marginBottom: foundationVars.space[8]
    }
  }
})

export const brandLockup = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[2]
    }
  }
})

export const brandMark = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      width: 'fit-content',
      borderRadius: foundationVars.radius.pill,
      padding: `0.35rem 0.85rem`,
      backgroundColor: foundationVars.color.accent.soft,
      border: `1px solid ${foundationVars.color.accent.border}`,
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.mono,
      fontSize: '0.78rem',
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }
})

export const shellGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[6],
      gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 420px)'
    }
  },
  '@media': {
    'screen and (max-width: 960px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const heroPanel = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[8],
      borderRadius: foundationVars.radius.xl,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card
    }
  }
})

export const surfaceCard = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[6],
      borderRadius: foundationVars.radius.lg,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.panel,
      boxShadow: foundationVars.shadow.card
    }
  }
})

export const summaryList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      padding: 0,
      margin: 0,
      listStyle: 'none'
    }
  }
})

export const summaryItem = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: foundationVars.space[4],
      borderRadius: foundationVars.radius.md,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.raised
    }
  }
})

export const appFrame = style({
  '@layer': {
    [app]: {
      margin: '0 auto',
      maxWidth: '1360px'
    }
  }
})

export const appGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[6],
      gridTemplateColumns: '280px minmax(0, 1fr)'
    }
  },
  '@media': {
    'screen and (max-width: 1080px)': {
      gridTemplateColumns: '1fr'
    }
  }
})

export const sidebar = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      alignContent: 'start'
    }
  }
})

export const navList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3]
    }
  }
})

export const navItem = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      padding: foundationVars.space[4],
      borderRadius: foundationVars.radius.md,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})

export const navItemActive = style({
  '@layer': {
    [app]: {
      borderColor: foundationVars.color.accent.border,
      backgroundColor: foundationVars.color.accent.soft,
      boxShadow: foundationVars.shadow.focus
    }
  }
})

export const contentColumn = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5],
      alignContent: 'start'
    }
  }
})
