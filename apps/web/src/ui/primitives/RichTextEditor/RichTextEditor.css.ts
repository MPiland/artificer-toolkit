import { globalStyle, style } from '@vanilla-extract/css'
import { app } from '#css/layers.css'
import { size } from '#css/size.css'
import { foundationVars } from '#css/foundations.css'

const editorBorder = `1px solid ${foundationVars.color.border.strong}`

export const editorRoot = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      minHeight: '10rem',
      overflow: 'auto',
      resize: 'vertical',
      '@media': {
        'screen and (max-width: 760px)': {
          resize: 'none'
        }
      }
    }
  }
})

export const editorLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.label.fontSize,
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: foundationVars.typography.label.lineHeight
    }
  }
})

export const editorRequired = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.input.border.error
    }
  }
})

export const editorError = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.input.border.error,
      fontSize: foundationVars.typography.label.fontSize,
      lineHeight: foundationVars.typography.label.lineHeight
    }
  }
})

export const editorToolbar = style({
  '@layer': {
    [app]: {
      gap: foundationVars.space[2],
      padding: `${foundationVars.space[2]} ${foundationVars.space[2]}`,
      rowGap: foundationVars.space[2],
      '@media': {
        'screen and (max-width: 760px)': {
          gap: foundationVars.space[1],
          padding: foundationVars.space[1],
          rowGap: foundationVars.space[1]
        }
      }
    }
  }
})

export const editorContent = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      minHeight: '6rem',
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0
    }
  }
})

globalStyle(`${editorContent} .ProseMirror`, {
  '@layer': {
    [app]: {
      flex: 1,
      minHeight: '4.5rem'
    }
  }
})

globalStyle(`${editorContent} .ProseMirror table`, {
  '@layer': {
    [app]: {
      borderCollapse: 'collapse',
      margin: `${size['size-3']} 0`,
      overflow: 'hidden',
      tableLayout: 'fixed'
    }
  }
})

globalStyle(`${editorContent} .tableWrapper > table`, {
  '@layer': {
    [app]: {
      width: '100%'
    }
  }
})

globalStyle(`${editorContent} table .selectedCell:after`, {
  '@layer': {
    [app]: {
      background: foundationVars.color.accent.soft,
      content: '',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      pointerEvents: 'none',
      position: 'absolute',
      zIndex: 2
    }
  }
})

globalStyle(`${editorContent} .resize-cursor`, {
  '@layer': {
    [app]: {
      cursor: ['ew-resize', 'col-resize'],
      zIndex: '10'
    }
  }
})

export const editorControl = style({
  '@layer': {
    [app]: {
      borderRadius: foundationVars.radius.sm,
      minWidth: '28px',
      minHeight: '28px',
      padding: 0,
      '@media': {
        'screen and (max-width: 760px)': {
          minWidth: '44px',
          minHeight: '44px'
        }
      }
    }
  }
})

export const editorControlIcon = style({
  '@layer': {
    [app]: {
      width: '0.875rem',
      height: '0.875rem',
      '@media': {
        'screen and (max-width: 760px)': {
          width: '0.8125rem',
          height: '0.8125rem'
        }
      }
    }
  }
})

export const editorControlsGroup = style({
  '@layer': {
    [app]: {
      gap: '2px',
      overflow: 'visible',
      '@media': {
        'screen and (max-width: 760px)': {
          gap: '1px'
        }
      }
    }
  }
})

export const editorMenuControlContent = style({
  '@layer': {
    [app]: {
      alignItems: 'center',
      display: 'inline-flex',
      gap: '2px',
      justifyContent: 'center',
      '@media': {
        'screen and (max-width: 760px)': {
          gap: '1px'
        }
      }
    }
  }
})

export const editorMenuIcon = style({
  '@layer': {
    [app]: {
      blockSize: '0.875rem',
      flexShrink: 0,
      inlineSize: '0.875rem',
      '@media': {
        'screen and (max-width: 760px)': {
          blockSize: '0.8125rem',
          inlineSize: '0.8125rem'
        }
      }
    }
  }
})

export const editorMenuChevron = style({
  '@layer': {
    [app]: {
      blockSize: '0.625rem',
      flexShrink: 0,
      inlineSize: '0.625rem',
      opacity: 0.75,
      '@media': {
        'screen and (max-width: 760px)': {
          blockSize: '0.5rem',
          inlineSize: '0.5rem'
        }
      }
    }
  }
})

export const editorMenuDropdown = style({
  '@layer': {
    [app]: {
      background: foundationVars.color.surface.panel,
      borderColor: foundationVars.color.border.subtle,
      borderRadius: foundationVars.radius.md,
      padding: foundationVars.space[1]
    }
  }
})

export const editorMenuItem = style({
  '@layer': {
    [app]: {
      borderRadius: foundationVars.radius.sm,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.label.fontSize
    }
  },
  selectors: {
    '&[data-active]': {
      '@layer': {
        [app]: {
          background: foundationVars.color.accent.soft,
          color: foundationVars.color.text.accent
        }
      }
    }
  }
})

export const editorTypography = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      minHeight: 0
    }
  }
})

export const editor_table = style({
  '@layer': {
    [app]: {
      borderCollapse: 'collapse',
      overflow: 'hidden',
      tableLayout: 'fixed',
      width: '90%',
      backgroundColor: 'transparent'
    }
  }
})

export const editor_table_th = style({
  '@layer': {
    [app]: {
      border: editorBorder,
      backgroundColor: foundationVars.color.surface.raised,
      color: foundationVars.color.text.primary,
      borderBottomWidth: '2px',
      fontWeight: 'bold',
      textAlign: 'left',
      padding: '3px 5px',
      verticalAlign: 'top',
      minWidth: '1rem'
    }
  }
})

globalStyle(`${editor_table_th} > p`, {
  '@layer': {
    [app]: {
      width: 'fit-content'
    }
  }
})

export const editor_table_td = style({
  '@layer': {
    [app]: {
      border: editorBorder,
      padding: '3px 5px',
      verticalAlign: 'top',
      backgroundColor: 'inherit',
      width: 'auto'
    }
  }
})
