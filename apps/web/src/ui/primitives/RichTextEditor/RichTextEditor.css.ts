import { globalStyle, style } from '@vanilla-extract/css'
import { app } from '#css/layers.css'
import { size } from '#css/size.css'
import { foundationVars } from '#css/foundations.css'

const editorBorder = `1px solid ${foundationVars.color.border.strong}`

export const editorRoot = style({
  '@layer': {
    [app]: {
      'display': 'flex',
      'flexDirection': 'column',
      'minHeight': '10rem',
      'overflow': 'auto',
      'resize': 'vertical',
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

export const editorToolbar = style({
  '@layer': {
    [app]: {
      gap: foundationVars.space[1]
    }
  }
})

export const editorContent = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      minHeight: '6rem'
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
      background: 'rgba(200, 200, 255, 0.4)',
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
      'minWidth': '32px',
      'minHeight': '32px',
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
      width: '1rem',
      height: '1rem'
    }
  }
})

export const editorControlsGroup = style({
  '@layer': {
    [app]: {
      gap: 0
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
      backgroundColor: 'lightgrey',
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
