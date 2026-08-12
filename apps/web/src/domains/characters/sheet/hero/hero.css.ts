import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const hero = style({
  '@layer': {
    [app]: {
      borderInlineEnd: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      maxWidth: '100%',
      minWidth: 0,
      padding: '8px 12px',
      '@media': {
        '(max-width: 1000px)': {
          borderBottom: `1px solid ${foundationVars.color.border.subtle}`,
          borderInlineEnd: 0
        },
        '(max-width: 760px)': {
          alignItems: 'center',
          gridTemplateColumns: '44px minmax(0, 1fr) auto',
          gap: '8px',
          padding: '8px 10px'
        }
      }
    }
  }
})

export const heroIdentity = style({
  '@layer': {
    [app]: {
      alignItems: 'start',
      display: 'grid',
      gap: '12px',
      gridTemplateColumns: '64px minmax(0, 1fr)',
      minWidth: 0,
      '@media': {
        '(max-width: 760px)': {
          display: 'contents'
        }
      }
    }
  }
})

export const heroIdentityCopy = style({
  '@layer': {
    [app]: {
      minWidth: 0,
      '@media': {
        '(max-width: 760px)': {
          justifySelf: 'start',
          textAlign: 'left'
        }
      }
    }
  }
})

export const characterMark = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      border: `1px solid ${foundationVars.color.accent.solid}`,
      borderRadius: foundationVars.radius.lg,
      color: foundationVars.color.text.primary,
      display: 'grid',
      height: '64px',
      justifyItems: 'center',
      overflow: 'hidden',
      width: '64px',
      '@media': {
        '(max-width: 760px)': {
          borderRadius: foundationVars.radius.md,
          height: '44px',
          justifySelf: 'center',
          width: '44px'
        }
      }
    }
  }
})

export const characterMarkIcon = style({
  '@layer': {
    [app]: {
      height: '34px',
      opacity: 0.9,
      width: '34px',
      '@media': {
        '(max-width: 760px)': {
          height: '24px',
          width: '24px'
        }
      }
    }
  }
})

export const eyebrow = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: '0.68rem',
      fontWeight: 800,
      letterSpacing: '0.08em',
      textTransform: 'uppercase',
      '@media': {
        '(max-width: 760px)': {
          display: 'none'
        }
      }
    }
  }
})

export const heroTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '1.48rem',
      fontWeight: 760,
      lineHeight: 1.12,
      margin: 0,
      '@media': {
        '(max-width: 760px)': {
          fontSize: '1.08rem',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }
      }
    }
  }
})

export const heroMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.accent,
      fontSize: '0.84rem',
      fontWeight: 700,
      lineHeight: 1.45,
      maxWidth: '70ch',
      '@media': {
        '(max-width: 760px)': {
          fontSize: '0.74rem',
          lineHeight: 1.25,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }
      }
    }
  }
})

export const heroClassLine = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '6px',
      '@media': {
        '(max-width: 760px)': {
          justifyContent: 'flex-start'
        }
      }
    }
  }
})

export const heroSubMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.82rem',
      lineHeight: 1.35,
      minHeight: '1.1rem',
      '@media': {
        '(max-width: 760px)': {
          display: 'none'
        }
      }
    }
  }
})

export const heroIconAction = style({
  '@layer': {
    [app]: {
      alignSelf: 'start',
      minHeight: '44px',
      minWidth: '44px',
      '@media': {
        '(max-width: 760px)': {
          alignSelf: 'center'
        }
      }
    }
  }
})

export const heroActions = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      alignSelf: 'start',
      display: 'flex',
      flexDirection: 'row',
      gap: '6px',
      '@media': {
        '(max-width: 760px)': {
          alignSelf: 'center',
          justifyContent: 'flex-end',
          justifySelf: 'end'
        }
      }
    }
  }
})

export const heroActionsMobileRow = style({
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 760px)': {
          gridColumn: '1 / -1',
          justifyContent: 'center',
          justifySelf: 'stretch'
        }
      }
    }
  }
})
