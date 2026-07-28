import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const shell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      fontSize: '0.875rem',
      gap: '12px',
      gridTemplateColumns: 'minmax(0, 1fr)',
      maxWidth: '100%',
      minWidth: 0,
      width: '100%'
    }
  }
})

export const sheetMobile = style({
  '@layer': {
    [app]: {
      blockSize: '100%',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      overflow: 'hidden'
    }
  }
})
export const sheetTablet = style({})
export const sheetDesktop = style({})

export const desktopSheetCanvas = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      blockSize: '690px',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(620px, 1.08fr) minmax(430px, 0.92fr)',
      minWidth: 0
    }
  }
})

export const tabletLandscapeCanvas = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      blockSize: 'clamp(420px, calc(100dvh - 328px), 520px)',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(300px, 0.8fr) minmax(0, 1.2fr)',
      minHeight: 0,
      minWidth: 0
    }
  }
})

export const desktopWorkspace = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.xl,
      display: 'grid',
      minWidth: 0,
      minHeight: 0,
      overflow: 'hidden',
      padding: '12px'
    }
  }
})

export const desktopWorkspaceTabs = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'auto minmax(0, 1fr)',
      height: '100%',
      minHeight: 0
    }
  }
})

export const desktopWorkspacePanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr)',
      minHeight: 0,
      overflow: 'hidden',
      paddingBottom: '12px'
    }
  }
})

export const mobileViewTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.35rem',
      fontWeight: 760,
      lineHeight: 1.15,
      margin: 0
    }
  }
})

export const visuallyHidden = style({
  '@layer': {
    [app]: {
      border: 0,
      clip: 'rect(0 0 0 0)',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      padding: 0,
      position: 'absolute',
      whiteSpace: 'nowrap',
      width: '1px'
    }
  }
})

export const sheetOverlayCloseButton = style({
  '@media': {
    '(pointer: coarse)': {
      minHeight: '44px',
      minWidth: '44px'
    }
  }
})

export const sheetTopGrid = style({
  '@layer': {
    [app]: {
      alignItems: 'stretch',
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gridTemplateColumns: 'minmax(300px, 0.82fr) minmax(0, 1.18fr)',
      minWidth: 0,
      overflow: 'hidden',
      '@media': {
        '(max-width: 1000px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const sheetAbilityStatusGrid = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: 'minmax(520px, 1.12fr) minmax(420px, 0.88fr)',
      minWidth: 0,
      '@media': {
        '(max-width: 1120px)': {
          gridTemplateColumns: '1fr'
        },
        '(min-width: 960px) and (max-width: 1199px) and (orientation: landscape)': {
          gridTemplateColumns: 'minmax(500px, 1.12fr) minmax(400px, 0.88fr)'
        }
      }
    }
  }
})

export const tabList = style({
  '@layer': {
    [app]: {
      flexWrap: 'nowrap',
      maxWidth: '100%',
      minWidth: 0,
      overflowX: 'auto',
      overflowY: 'visible',
      paddingBottom: '4px',
      scrollbarWidth: 'thin',
      '@media': {
        '(max-width: 760px)': {
          marginInline: '-4px',
          paddingInline: '4px'
        }
      }
    }
  }
})

export const tab = style({
  '@layer': {
    [app]: {
      backgroundColor: 'transparent',
      flex: '0 0 auto',
      whiteSpace: 'nowrap',
      '@media': {
        '(max-width: 760px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

globalStyle(`${tab}:hover, ${tab}[data-active="true"]`, {
  '@layer': {
    [app]: {
      backgroundColor: 'transparent',
      borderColor: 'transparent'
    }
  }
})

globalStyle(`${tab}[data-active="true"]`, {
  '@layer': {
    [app]: {
      borderBottomColor: foundationVars.color.accent.solid
    }
  }
})

globalStyle(`${tab}:focus-visible`, {
  '@layer': {
    [app]: {
      boxShadow: foundationVars.shadow.focus,
      outline: 'none !important'
    }
  }
})
