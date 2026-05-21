import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const shell = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '22px'
    }
  }
})

export const tabList = style({
  '@layer': {
    [app]: {
      'flexWrap': 'nowrap',
      'overflowX': 'auto',
      'overflowY': 'hidden',
      'paddingBottom': '4px',
      'scrollbarWidth': 'thin',
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
      'flex': '0 0 auto',
      'whiteSpace': 'nowrap',
      '@media': {
        '(max-width: 760px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

export const hero = style({
  '@layer': {
    [app]: {
      'background': foundationVars.color.surface.panel,
      'border': `1px solid ${foundationVars.color.border.subtle}`,
      'borderRadius': '24px',
      'boxShadow': foundationVars.shadow.card,
      'display': 'grid',
      'gap': '18px',
      'gridTemplateColumns': 'minmax(0, 1fr) auto',
      'padding': '24px',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const eyebrow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.78rem',
      fontWeight: 800,
      letterSpacing: '0.08em',
      textTransform: 'uppercase'
    }
  }
})

export const heroTitle = style({
  '@layer': {
    [app]: {
      'color': foundationVars.color.text.primary,
      'fontSize': '2.5rem',
      'lineHeight': 1.08,
      'margin': 0,
      '@media': {
        '(max-width: 760px)': {
          fontSize: '2rem'
        }
      }
    }
  }
})

export const heroMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '1rem',
      lineHeight: 1.45,
      maxWidth: '70ch'
    }
  }
})

export const heroActions = style({
  '@layer': {
    [app]: {
      'alignItems': 'flex-end',
      'display': 'flex',
      'flexDirection': 'column',
      'gap': '10px',
      '@media': {
        '(max-width: 760px)': {
          alignItems: 'stretch'
        }
      }
    }
  }
})

export const statDock = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'repeat(4, minmax(0, 1fr))',
      '@media': {
        '(max-width: 920px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        '(max-width: 520px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const statTile = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: '18px',
      display: 'grid',
      gap: '4px',
      padding: '16px'
    }
  }
})

export const statValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.65rem',
      fontWeight: 800,
      lineHeight: 1
    }
  }
})

export const statLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.78rem',
      fontWeight: 750,
      letterSpacing: '0.03em',
      textTransform: 'uppercase'
    }
  }
})

export const contentGrid = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '18px',
      'gridTemplateColumns': 'minmax(0, 1fr) 340px',
      '@media': {
        '(max-width: 1080px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const panel = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: '18px',
      display: 'grid',
      gap: '16px',
      padding: '18px'
    }
  }
})

export const panelHeader = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'gap': '12px',
      'justifyContent': 'space-between',
      'alignItems': 'flex-start',
      'flexWrap': 'wrap',
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
      fontSize: '1.15rem',
      fontWeight: 800,
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

export const abilityGrid = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '10px',
      'gridTemplateColumns': 'repeat(6, minmax(0, 1fr))',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
        },
        '(max-width: 480px)': {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        }
      }
    }
  }
})

export const abilityTile = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: '14px',
      display: 'grid',
      gap: '2px',
      padding: '12px',
      textAlign: 'center'
    }
  }
})

export const rowList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '10px'
    }
  }
})

export const row = style({
  '@layer': {
    [app]: {
      'alignItems': 'center',
      'border': `1px solid ${foundationVars.color.border.subtle}`,
      'borderRadius': '14px',
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'minmax(0, 1fr) auto',
      'padding': '12px',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const inlineEditorShell = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})

export const inlineEditor = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '12px'
    }
  }
})

export const compactActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      justifyContent: 'flex-end'
    }
  }
})

export const compactActionControl = style({
  '@layer': {
    [app]: {
      'minHeight': '34px',
      '@media': {
        '(max-width: 620px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

export const hpControls = style({
  '@layer': {
    [app]: {
      'display': 'grid',
      'gap': '12px',
      'gridTemplateColumns': 'repeat(3, minmax(0, 1fr))',
      '@media': {
        '(max-width: 760px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const hpControlTarget = style({
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 760px), (pointer: coarse)': {
          minHeight: '44px'
        }
      }
    }
  }
})

export const sidebar = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: '18px',
      alignContent: 'start'
    }
  }
})
