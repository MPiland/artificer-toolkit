import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

export const statusControlPanel = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      display: 'grid',
      gap: '8px',
      minWidth: 0,
      padding: '10px'
    }
  }
})

export const statusControlOverlay = style({
  '@layer': {
    [app]: {
      insetInline: 0,
      position: 'absolute',
      top: 'calc(100% + 8px)',
      zIndex: 20
    }
  }
})

export const statusControlPanelFloating = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.canvas,
      boxShadow: foundationVars.shadow.floatingControl
    }
  }
})

export const statusDrawerBody = style({
  '@layer': {
    [app]: {
      overflowY: 'auto',
      overscrollBehavior: 'contain'
    }
  }
})

export const statusEditorSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      minWidth: 0
    }
  }
})

export const statusEditorSectionDivided = style({
  '@layer': {
    [app]: {
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      gap: 0,
      paddingTop: foundationVars.space[3]
    }
  }
})

export const statusEditorHeading = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'flex',
      gap: foundationVars.space[3],
      justifyContent: 'space-between',
      minWidth: 0,
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          flexDirection: 'column'
        }
      }
    }
  }
})

export const statusEditorTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.92rem',
      fontWeight: 760,
      lineHeight: 1.2
    }
  }
})

export const statusEditorMeta = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '0.76rem',
      lineHeight: 1.35,
      marginTop: foundationVars.space[1]
    }
  }
})

export const statusEditorLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.label.lineHeight
    }
  }
})

export const exhaustionAccordion = style({
  '@layer': {
    [app]: {
      minWidth: 0,
      width: '100%'
    }
  }
})

export const exhaustionAccordionItem = style({
  '@layer': {
    [app]: {
      minWidth: 0,
      width: '100%'
    }
  }
})

export const exhaustionAccordionHeader = style({
  '@layer': {
    [app]: {
      minHeight: '44px',
      minWidth: 0,
      position: 'relative'
    }
  }
})

export const exhaustionAccordionControl = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      appearance: 'none',
      background: 'transparent',
      border: 0,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      display: 'flex',
      minHeight: '44px',
      minWidth: 0,
      padding: 0,
      textAlign: 'left',
      width: '100%',
      selectors: {
        '&:focus-visible': {
          boxShadow: foundationVars.shadow.focus,
          outline: 'none'
        }
      }
    }
  }
})

export const exhaustionAccordionLabel = style({
  '@layer': {
    [app]: {
      flex: 1,
      minWidth: 0,
      order: 1,
      paddingRight: '210px',
      '@media': {
        '(max-width: 620px)': {
          paddingRight: '194px'
        }
      }
    }
  }
})

export const exhaustionAccordionMeta = style({
  '@layer': {
    [app]: {
      '@media': {
        '(max-width: 620px)': {
          display: 'none'
        }
      }
    }
  }
})

export const exhaustionAccordionChevron = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      flexShrink: 0,
      marginLeft: 'auto',
      order: 2,
      transition: `transform ${foundationVars.motion.fast} ease`,
      width: '18px',
      selectors: {
        '&[data-rotate]': {
          transform: 'rotate(180deg)'
        }
      },
      '@media': {
        '(prefers-reduced-motion: reduce)': {
          transition: 'none'
        }
      }
    }
  }
})

export const exhaustionAccordionContent = style({
  '@layer': {
    [app]: {
      padding: 0
    }
  }
})

export const exhaustionDisclosureCopy = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minWidth: 0
    }
  }
})

export const exhaustionDetails = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      paddingTop: foundationVars.space[3]
    }
  }
})

export const exhaustionLevelControls = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'grid',
      gap: foundationVars.space[2],
      gridTemplateColumns: '36px minmax(82px, auto) 36px',
      position: 'absolute',
      right: '30px',
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 1,
      '@media': {
        '(max-width: 620px)': {
          gridTemplateColumns: '44px minmax(58px, auto) 44px',
          right: '26px'
        }
      }
    }
  }
})

export const exhaustionLevelButton = style({
  '@layer': {
    [app]: {
      minHeight: '36px',
      minWidth: '36px',
      paddingInline: 0,
      '@media': {
        '(max-width: 620px), (pointer: coarse)': {
          minHeight: '44px',
          minWidth: '44px'
        }
      }
    }
  }
})

export const exhaustionLevelValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '0.84rem',
      fontVariantNumeric: 'tabular-nums',
      fontWeight: 720,
      textAlign: 'center',
      whiteSpace: 'nowrap'
    }
  }
})

export const exhaustionEffects = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.subtle,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      display: 'grid',
      gap: foundationVars.space[2],
      padding: foundationVars.space[3]
    }
  }
})

export const statusControlGrid = style({
  '@layer': {
    [app]: {
      alignItems: 'end',
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'minmax(160px, 0.85fr) minmax(180px, 1fr) auto',
      minWidth: 0,
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const statusConditionList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 0,
      minWidth: 0
    }
  }
})

export const statusConditionRow = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      borderTop: `1px solid ${foundationVars.color.border.subtle}`,
      display: 'grid',
      gap: '8px',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      minHeight: '34px',
      minWidth: 0,
      padding: '7px 0',
      '@media': {
        '(max-width: 620px)': {
          alignItems: 'stretch',
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})
