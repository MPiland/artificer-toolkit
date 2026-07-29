import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'
import { desktopWorkspacePanel } from '../core/sheetShell.css'

export const panel = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      display: 'grid',
      gap: '16px',
      padding: '18px',
      selectors: {
        [`${desktopWorkspacePanel} > &`]: {
          alignContent: 'start',
          boxSizing: 'border-box',
          height: '100%',
          minHeight: 0,
          overflowY: 'auto',
          paddingInlineEnd: '8px',
          scrollbarGutter: 'stable',
          scrollbarWidth: 'thin'
        }
      }
    }
  }
})

globalStyle(`${desktopWorkspacePanel} > ${panel}::-webkit-scrollbar`, {
  width: '6px'
})

globalStyle(`${desktopWorkspacePanel} > ${panel}::-webkit-scrollbar-track`, {
  background: 'transparent'
})

globalStyle(`${desktopWorkspacePanel} > ${panel}::-webkit-scrollbar-thumb`, {
  background: foundationVars.color.accent.border,
  borderRadius: foundationVars.radius.pill
})

export const panelHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gap: '12px',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      '@media': {
        '(max-width: 620px)': {
          flexDirection: 'column'
        }
      }
    }
  }
})

export const panelTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1rem',
      fontWeight: 750,
      margin: 0
    }
  }
})

export const muted = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary
    }
  }
})
