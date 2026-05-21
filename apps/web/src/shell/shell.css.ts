import { style } from '@vanilla-extract/css'
import { foundationVars } from '../css/foundations.css.ts'
import { app } from '../css/layers.css.ts'

const mobileBreakpoint = 'screen and (max-width: 992px)'

export const skipLink = style({
  '@layer': {
    [app]: {
      'position': 'fixed',
      'top': foundationVars.space[3],
      'left': foundationVars.space[3],
      'zIndex': 1000,
      'transform': 'translateY(-150%)',
      'padding': `${foundationVars.space[2]} ${foundationVars.space[3]}`,
      'border': `1px solid ${foundationVars.color.accent.border}`,
      'borderRadius': foundationVars.radius.md,
      'backgroundColor': foundationVars.color.surface.panel,
      'color': foundationVars.color.text.primary,
      'fontSize': foundationVars.typography.bodySm.fontSize,
      'fontWeight': foundationVars.fontWeight.semibold,
      'textDecoration': 'none',
      'boxShadow': foundationVars.shadow.card,
      'transition': `transform ${foundationVars.motion.fast} ease`,

      ':focus-visible': {
        transform: 'translateY(0)',
        outline: `2px solid ${foundationVars.color.accent.solid}`,
        outlineOffset: '2px'
      }
    }
  }
})

export const shellRoot = style({
  '@layer': {
    [app]: {
      minHeight: '100dvh',
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.primary
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      'position': 'fixed',
      'top': 0,
      'right': 0,
      'left': 0,
      'zIndex': 200,
      'display': 'grid',
      'gridTemplateColumns': '48px minmax(0, 1fr)',
      'height': '48px',
      'borderBottom': 0,
      'backgroundColor': foundationVars.color.surface.header,

      ':after': {
        content: '""',
        position: 'absolute',
        right: 0,
        bottom: 0,
        left: 0,
        height: '1px',
        backgroundColor: foundationVars.color.border.subtle,
        pointerEvents: 'none'
      }
    }
  }
})

export const logoCell = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'width': '48px',
      'height': '48px',
      'placeItems': 'center',
      'color': foundationVars.color.logo.icon,
      'backgroundColor': foundationVars.color.surface.header,
      'textDecoration': 'none',
      'position': 'relative',

      ':focus-visible': {
        outline: `2px solid ${foundationVars.color.accent.solid}`,
        outlineOffset: '-3px'
      }
    }
  }
})

export const headerBar = style({
  '@layer': {
    [app]: {
      'minWidth': 0,
      'display': 'grid',
      'gridTemplateColumns': 'minmax(0, 1fr) auto',
      'alignItems': 'center',
      'gap': foundationVars.space[4],
      'padding': `0 ${foundationVars.space[6]}`,
      '@media': {
        [mobileBreakpoint]: {
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          padding: `0 ${foundationVars.space[3]}`
        }
      }
    }
  }
})

export const mobileHeaderGroup = style({
  '@layer': {
    [app]: {
      'display': 'none',
      '@media': {
        [mobileBreakpoint]: {
          display: 'flex'
        }
      }
    }
  }
})

export const breadcrumb = style({
  '@layer': {
    [app]: {
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: foundationVars.typography.bodySm.lineHeight
    }
  }
})

export const breadcrumbSupplement = style({
  '@layer': {
    [app]: {
      minWidth: 0,
      display: 'inline-flex',
      alignItems: 'center',
      overflow: 'hidden'
    }
  }
})

export const breadcrumbSegment = style({
  '@layer': {
    [app]: {
      minWidth: 0,
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2]
    }
  }
})

export const breadcrumbRoot = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      whiteSpace: 'nowrap'
    }
  }
})

export const breadcrumbSlash = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted
    }
  }
})

export const breadcrumbLeaf = style({
  '@layer': {
    [app]: {
      overflow: 'hidden',
      color: foundationVars.color.text.primary,
      fontWeight: foundationVars.fontWeight.semibold,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const headerActions = style({
  '@layer': {
    [app]: {
      justifyContent: 'flex-end'
    }
  }
})

export const headerUserMenu = style({
  '@layer': {
    [app]: {
      'display': 'none',
      '@media': {
        [mobileBreakpoint]: {
          display: 'inline-flex'
        }
      }
    }
  }
})

export const navbar = style({
  '@layer': {
    [app]: {
      'top': '48px',
      'height': 'calc(100dvh - 48px)',
      'display': 'grid',
      'gridTemplateRows': 'minmax(0, 1fr) auto',
      'alignItems': 'stretch',
      'padding': `${foundationVars.space[3]} 0`,
      'borderRight': `1px solid ${foundationVars.color.border.subtle}`,
      'backgroundColor': foundationVars.color.surface.sidebar,
      '@media': {
        [mobileBreakpoint]: {
          padding: foundationVars.space[4],
          width: '18rem'
        }
      }
    }
  }
})

export const navScroll = style({
  '@layer': {
    [app]: {
      minHeight: 0
    }
  }
})

export const navStack = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'justifyItems': 'center',
      'gap': foundationVars.space[2],
      '@media': {
        [mobileBreakpoint]: {
          justifyItems: 'stretch'
        }
      }
    }
  }
})

export const navGroup = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '0.25rem',
      paddingTop: foundationVars.space[2],
      selectors: {
        '& + &': {
          marginTop: foundationVars.space[2],
          paddingTop: foundationVars.space[3],
          borderTop: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const navGroupLabel = style({
  '@layer': {
    [app]: {
      'width': '1px',
      'height': '1px',
      'position': 'absolute',
      'overflow': 'hidden',
      'clip': 'rect(0 0 0 0)',
      'whiteSpace': 'nowrap',
      '@media': {
        [mobileBreakpoint]: {
          width: 'auto',
          height: 'auto',
          position: 'static',
          clip: 'auto',
          padding: `${foundationVars.space[2]} ${foundationVars.space[3]}`,
          color: foundationVars.color.text.secondary,
          fontSize: foundationVars.typography.caption.fontSize,
          fontWeight: foundationVars.fontWeight.medium,
          letterSpacing: '0.06em',
          textTransform: 'uppercase'
        }
      }
    }
  }
})

export const navItem = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gridTemplateColumns': '40px',
      'appearance': 'none',
      'alignItems': 'center',
      'justifyItems': 'center',
      'width': '40px',
      'minHeight': '40px',
      'padding': 0,
      'border': '1px solid transparent',
      'borderRadius': foundationVars.radius.md,
      'background': 'transparent',
      'color': foundationVars.color.icon.muted,
      'textDecoration': 'none',
      'transition': `background-color ${foundationVars.motion.fast} ease, border-color ${foundationVars.motion.fast} ease, color ${foundationVars.motion.fast} ease`,

      ':focus-visible': {
        outline: `2px solid ${foundationVars.color.accent.solid}`,
        outlineOffset: '-2px'
      },

      ':disabled': {
        cursor: 'not-allowed'
      },
      '@media': {
        [mobileBreakpoint]: {
          gridTemplateColumns: '48px minmax(0, 1fr)',
          justifyItems: 'start',
          width: '100%',
          minHeight: '48px',
          borderRadius: foundationVars.radius.lg
        }
      }
    }
  }
})

export const navItemInteractive = style({
  '@layer': {
    [app]: {
      'cursor': 'pointer',
      ':hover': {
        color: foundationVars.color.icon.hover,
        backgroundColor: foundationVars.color.nav.pillHover
      }
    }
  }
})

export const navItemActive = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.icon.selected,
      backgroundColor: foundationVars.color.nav.pillActive,
      borderColor: foundationVars.color.accent.border
    }
  }
})

export const navItemDisabled = style({
  '@layer': {
    [app]: {
      opacity: 0.54
    }
  }
})

export const navIcon = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'width': '40px',
      'height': '40px',
      'placeItems': 'center',
      '@media': {
        [mobileBreakpoint]: {
          width: '48px'
        }
      }
    }
  }
})

export const navItemLabel = style({
  '@layer': {
    [app]: {
      'display': 'none',
      '@media': {
        [mobileBreakpoint]: {
          display: 'block',
          color: foundationVars.color.text.primary,
          fontSize: foundationVars.typography.bodySm.fontSize,
          fontWeight: foundationVars.fontWeight.medium
        }
      }
    }
  }
})

export const sidebarFooter = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'placeItems': 'center',
      'paddingTop': foundationVars.space[3],
      'borderTop': `1px solid ${foundationVars.color.border.subtle}`,
      '@media': {
        [mobileBreakpoint]: {
          display: 'none'
        }
      }
    }
  }
})

export const userIconButton = style({
  '@layer': {
    [app]: {
      width: '40px',
      height: '40px'
    }
  }
})

export const main = style({
  '@layer': {
    [app]: {
      minWidth: 0,
      minHeight: 'calc(100dvh - 48px)',
      backgroundColor: foundationVars.color.surface.canvas
    }
  }
})

export const contentArea = style({
  '@layer': {
    [app]: {
      'vars': {
        '--at-workspace-content-padding-block': foundationVars.space[8],
        '--at-workspace-available-height': 'calc(100dvh - 48px - var(--at-workspace-content-padding-block) - var(--at-workspace-content-padding-block))'
      },
      'boxSizing': 'border-box',
      'width': '100%',
      'maxWidth': '1272px',
      'minWidth': 0,
      'display': 'grid',
      'alignContent': 'start',
      'gap': foundationVars.space[8],
      'marginInline': 'auto',
      'padding': `var(--at-workspace-content-padding-block) ${foundationVars.space[6]}`,

      ':focus': {
        outline: 'none'
      },
      '@media': {
        [mobileBreakpoint]: {
          vars: {
            '--at-workspace-content-padding-block': foundationVars.space[4]
          },
          padding: foundationVars.space[4],
          gap: foundationVars.space[6]
        }
      }
    }
  }
})

export const pageHeader = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'alignItems': 'flex-end',
      'justifyContent': 'space-between',
      'gap': foundationVars.space[6],
      '@media': {
        [mobileBreakpoint]: {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})

export const pageHeaderCopy = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '0.25rem',
      maxWidth: '44rem'
    }
  }
})

export const eyebrow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      fontSize: foundationVars.typography.caption.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const pageTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontFamily: foundationVars.font.display,
      fontSize: foundationVars.typography.heading.fontSize,
      fontWeight: foundationVars.typography.heading.fontWeight,
      letterSpacing: foundationVars.typography.heading.letterSpacing,
      lineHeight: foundationVars.typography.heading.lineHeight
    }
  }
})

export const pageDescription = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: foundationVars.typography.caption.lineHeight
    }
  }
})

export const footerActionBar = style({
  '@layer': {
    [app]: {
      'position': 'sticky',
      'bottom': foundationVars.space[4],
      'zIndex': 5,
      'display': 'flex',
      'alignItems': 'center',
      'justifyContent': 'space-between',
      'gap': foundationVars.space[4],
      'padding': foundationVars.space[4],
      'border': `1px solid ${foundationVars.color.border.subtle}`,
      'borderRadius': foundationVars.radius.md,
      'backgroundColor': foundationVars.color.surface.panel,
      'boxShadow': foundationVars.shadow.card,
      '@media': {
        [mobileBreakpoint]: {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})
