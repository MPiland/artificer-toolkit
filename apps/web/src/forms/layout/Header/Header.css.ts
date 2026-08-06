import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'
import { AUTHORING_WIDE_DESKTOP_QUERY } from '../authoringWorkspace.constants'

export const header = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      minBlockSize: 64,
      maxInlineSize: '100%',
      borderBlockEnd: `1px solid ${foundationVars.color.authoring.border}`,
      backgroundColor: foundationVars.color.authoring.header,
      flexShrink: 0
    }
  }
})

export const contextBar = style({
  '@layer': {
    [app]: {
      display: 'none',
      alignItems: 'center',
      minBlockSize: 50,
      paddingInline: foundationVars.space[5],
      borderBlockEnd: `1px solid ${foundationVars.color.authoring.border}`,
      backgroundColor: foundationVars.color.authoring.band,
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          display: 'flex'
        }
      }
    }
  }
})

export const headerMain = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[4],
      minBlockSize: 64,
      paddingBlock: foundationVars.space[2],
      paddingInline: foundationVars.space[4],
      backgroundColor: foundationVars.color.authoring.header,
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          paddingInline: foundationVars.space[5]
        },
        [media.tabletPortrait]: {
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: foundationVars.space[3]
        },
        [media.mobile]: {
          paddingInline: foundationVars.space[3]
        }
      }
    }
  }
})

export const titleRow = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'nowrap',
      alignItems: 'center',
      minInlineSize: 0,
      gap: foundationVars.space[2],
      '@media': {
        [media.mobile]: {
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto auto'
        }
      }
    }
  }
})

export const titleStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      flex: '0 1 auto',
      minInlineSize: 0
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      margin: 0,
      minInlineSize: 0,
      overflow: 'hidden',
      color: foundationVars.color.text.primary,
      fontSize: '20px',
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '-0.02em',
      lineHeight: '26px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const statusBadge = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minBlockSize: 32,
      paddingInline: foundationVars.space[3],
      border: `1px solid ${foundationVars.color.accent.border}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.accent.soft,
      color: foundationVars.color.text.accent,
      fontSize: '12px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '18px',
      whiteSpace: 'nowrap',
      '@media': {
        [media.mobile]: {
          display: 'none'
        }
      }
    }
  }
})

export const saveState = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      color: foundationVars.color.text.accent,
      fontSize: foundationVars.typography.bodySm.fontSize,
      lineHeight: '16px',
      whiteSpace: 'nowrap',
      selectors: {
        '&[data-dirty="true"]': {
          color: foundationVars.color.status.warning,
          fontWeight: foundationVars.fontWeight.semibold
        },
        '&[data-dirty="true"]::before': {
          content: '',
          inlineSize: 8,
          blockSize: 8,
          borderRadius: foundationVars.radius.pill,
          backgroundColor: foundationVars.color.status.warning
        }
      },
      '@media': {
        'screen and (min-width: 1280px) and (max-width: 1399px)': {
          minInlineSize: 15,
          fontSize: 0
        },
        [media.mobile]: {
          display: 'none'
        }
      }
    }
  }
})

export const provenanceBadge = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      minBlockSize: 24,
      paddingInline: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: 'transparent',
      color: foundationVars.color.text.muted,
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '16px',
      alignSelf: 'center',
      whiteSpace: 'nowrap',
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          display: 'none'
        }
      }
    }
  }
})

export const viewActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      marginInlineStart: foundationVars.space[2],
      flexShrink: 0,
      '@media': {
        [media.mobile]: {
          marginInlineStart: 0
        }
      }
    }
  }
})

export const formActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2],
      alignSelf: 'center',
      minInlineSize: 0,
      flexShrink: 0,
      '@media': {
        [media.tabletPortrait]: {
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          inlineSize: '100%'
        },
        [media.mobile]: {
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr)',
          inlineSize: '100%'
        },
        'screen and (max-width: 360px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const utilityActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      '@media': {
        [media.mobile]: {
          justifySelf: 'start'
        }
      }
    }
  }
})

export const lifecycleActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      '@media': {
        [media.mobile]: {
          display: 'grid',
          gridAutoColumns: 'minmax(96px, 1fr)',
          gridAutoFlow: 'column',
          inlineSize: '100%'
        }
      }
    }
  }
})
