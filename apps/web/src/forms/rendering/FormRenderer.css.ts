import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'
import * as richTextStyles from '../../ui/primitives/RichTextEditor/RichTextEditor.css'
import { AUTHORING_WIDE_DESKTOP_QUERY } from '../layout/authoringWorkspace.constants'

export const sectionStack = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[4],
      padding: foundationVars.space[3],
      border: `1px solid ${foundationVars.color.authoring.border}`,
      borderRadius: foundationVars.radius.md,
      backgroundColor: foundationVars.color.authoring.panel
    }
  }
})

export const canvasSectionStack = style([
  sectionStack,
  {
    '@layer': {
      [app]: {
        gap: 0,
        minInlineSize: 0,
        inlineSize: '100%',
        padding: 0,
        boxSizing: 'border-box'
      }
    }
  }
])

export const canvasSectionStackRowsOnly = style({
  '@layer': {
    [app]: {
      border: 0,
      borderRadius: 0,
      backgroundColor: 'transparent'
    }
  }
})

globalStyle(`${canvasSectionStack} > section`, {
  padding: foundationVars.space[3]
})

globalStyle(`${canvasSectionStackRowsOnly} > section`, {
  paddingBlock: 0
})

globalStyle(`${canvasSectionStack} > section + section`, {
  position: 'relative'
})

globalStyle(`${canvasSectionStack} > section + section::before`, {
  content: '',
  position: 'absolute',
  insetBlockStart: 0,
  insetInline: foundationVars.space[3],
  blockSize: 1,
  backgroundColor: foundationVars.color.authoring.border
})

globalStyle(`${sectionStack} ${sectionStack}`, {
  padding: 0,
  border: 0,
  borderRadius: 0,
  backgroundColor: 'transparent'
})

export const fieldGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: foundationVars.space['3'],
      minInlineSize: 0,

      '@media': {
        '(max-width: 768px)': {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const basicsFieldGrid = style([
  fieldGrid,
  {
    '@layer': {
      [app]: {
        gridTemplateColumns: 'minmax(0, 1fr) minmax(10rem, 0.65fr) 5rem',
        alignItems: 'start',

        '@media': {
          '(max-width: 768px)': {
            gridTemplateColumns: 'minmax(0, 1fr) 5rem'
          }
        }
      }
    }
  }
])

export const basicsArtwork = style({
  '@layer': {
    [app]: {
      gridColumn: 3,
      gridRow: 1,
      justifySelf: 'end',

      '@media': {
        '(max-width: 768px)': {
          gridColumn: 2
        }
      }
    }
  }
})

export const wideField = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})

export const canvasStepHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      minBlockSize: 56,
      minInlineSize: 0,
      inlineSize: '100%',
      marginBlockEnd: 0,
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`,
      border: `1px solid ${foundationVars.color.authoring.border}`,
      borderRadius: foundationVars.radius.sm,
      boxSizing: 'border-box',
      backgroundColor: foundationVars.color.authoring.active,
      color: foundationVars.color.text.secondary,
      '@media': {
        [AUTHORING_WIDE_DESKTOP_QUERY]: {
          inlineSize: `calc(100% + ${foundationVars.space[4]} + ${foundationVars.space[4]})`,
          marginBlockStart: `calc(0px - ${foundationVars.space[4]})`,
          marginInline: `calc(0px - ${foundationVars.space[4]})`,
          borderInline: 0,
          borderRadius: 0
        }
      }
    }
  }
})

export const canvasStepTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '20px',
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: foundationVars.typography.heading.lineHeight
    }
  }
})

export const canvasStepDivider = style({
  '@layer': {
    [app]: {
      inlineSize: 1,
      blockSize: 20,
      flexShrink: 0,
      backgroundColor: foundationVars.color.authoring.border
    }
  }
})

export const canvasStepDescription = style({
  '@layer': {
    [app]: {
      minInlineSize: 0,
      overflow: 'hidden',
      color: foundationVars.color.text.muted,
      fontSize: '12px',
      lineHeight: '18px',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }
})

export const sectionHeading = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      marginBlockEnd: foundationVars.space[2],
      color: foundationVars.color.text.secondary
    }
  }
})

globalStyle(`${fieldGrid} ${richTextStyles.editorRoot}`, {
  minHeight: '6rem'
})

globalStyle(`${fieldGrid} ${richTextStyles.editorContent} .ProseMirror`, {
  minHeight: '3.5rem'
})

export const sectionHeadingTitle = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '16px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '22px'
    }
  }
})

export const inlineArrayRemoveAction = style({
  '@layer': {
    [app]: {
      minInlineSize: 44,
      minBlockSize: 44,
      borderRadius: foundationVars.radius.md,
      color: foundationVars.color.text.muted,

      selectors: {
        '&[data-destructive]:hover': {
          background: foundationVars.color.status.dangerSoft,
          color: foundationVars.color.status.danger
        },
        '&[data-destructive]:focus-visible': {
          outline: `2px solid ${foundationVars.color.status.danger}`,
          outlineOffset: 2
        }
      }
    }
  }
})

export const authoringActionControl = style({
  '@layer': {
    [app]: {
      minBlockSize: 44,
      borderRadius: foundationVars.radius.md
    }
  }
})

export const nestedShell = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space['3'],
      border: `1px dashed ${foundationVars.color.authoring.border}`,
      borderRadius: foundationVars.radius.md,
      padding: foundationVars.space['4']
    }
  }
})

export const groupEditorBody = style({
  '@layer': {
    [app]: {
      blockSize: '100%',
      boxSizing: 'border-box',
      padding: `${foundationVars.space['4']} ${foundationVars.space['5']} 0`,
      backgroundColor: foundationVars.color.authoring.panel
    }
  }
})

export const groupEditorSurface = style({
  '@layer': {
    [app]: {
      borderInlineStart: `1px solid ${foundationVars.color.authoring.border}`,
      backgroundColor: foundationVars.color.authoring.panel,
      color: foundationVars.color.text.primary
    }
  }
})

export const groupEditorRoot = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      inset: 0
    }
  }
})

export const groupEditorOverlay = style({
  '@layer': {
    [app]: {
      position: 'absolute'
    }
  }
})

export const groupEditorInner = style({
  '@layer': {
    [app]: {
      position: 'absolute'
    }
  }
})

export const groupEditorHeader = style({
  '@layer': {
    [app]: {
      minBlockSize: 72,
      paddingInline: foundationVars.space[5],
      borderBlockEnd: `1px solid ${foundationVars.color.authoring.border}`,
      backgroundColor: foundationVars.color.authoring.panel
    }
  }
})

export const groupEditorTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary
    }
  }
})

export const groupEditorClose = style({
  '@layer': {
    [app]: {
      inlineSize: 44,
      blockSize: 44,
      border: 0,
      borderRadius: foundationVars.radius.md,
      background: 'transparent',
      color: foundationVars.color.text.secondary,

      ':hover': {
        background: foundationVars.color.surface.raised,
        color: foundationVars.color.text.primary
      },

      ':focus-visible': {
        outline: `2px solid ${foundationVars.color.input.border.focus}`,
        outlineOffset: 2
      }
    }
  }
})

export const groupEditorTitleStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 1,
      fontSize: '18px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '22px'
    }
  }
})

export const groupEditorSubtitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '13px',
      fontWeight: foundationVars.fontWeight.regular,
      lineHeight: '18px'
    }
  }
})

export const groupEditorContent = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space['4'],
      minBlockSize: '100%',
      counterReset: 'authoring-drawer-section'
    }
  }
})

export const groupEditorActions = style({
  '@layer': {
    [app]: {
      position: 'sticky',
      insetBlockEnd: 0,
      display: 'flex',
      justifyContent: 'flex-end',
      gap: foundationVars.space['3'],
      marginBlockStart: 'auto',
      paddingBlockStart: foundationVars.space['3'],
      paddingBlockEnd: foundationVars.space['5'],
      borderBlockStart: `1px solid ${foundationVars.color.authoring.border}`,
      background: foundationVars.color.authoring.panel
    }
  }
})

globalStyle(`${groupEditorActions} > *`, {
  inlineSize: '7.5rem',
  minInlineSize: '7.5rem',
  minBlockSize: '2.75rem',
  borderRadius: foundationVars.radius.md
})

globalStyle(`${groupEditorContent} > ${sectionStack} > section`, {
  paddingBlockEnd: foundationVars.space[5],
  borderBlockEnd: `1px solid ${foundationVars.color.authoring.border}`,
  counterIncrement: 'authoring-drawer-section'
})

globalStyle(`${groupEditorContent} > ${sectionStack} > section:last-child`, {
  paddingBlockEnd: 0,
  borderBlockEnd: 0
})

globalStyle(`${groupEditorContent} > ${sectionStack} > section > ${sectionHeading} > h2::before`, {
  content: 'counter(authoring-drawer-section) ". "'
})

globalStyle(`${groupEditorContent} ${fieldGrid}`, {
  gridTemplateColumns: '1fr',
  gap: foundationVars.space[2]
})

globalStyle(`${groupEditorContent} ${sectionStack}`, {
  gap: foundationVars.space[6]
})

globalStyle(`${groupEditorContent} > ${sectionStack}`, {
  padding: 0,
  border: 0,
  borderRadius: 0,
  background: 'transparent'
})

globalStyle(`${groupEditorContent} ${sectionHeading}`, {
  marginBlockEnd: foundationVars.space[2]
})

globalStyle(`${groupEditorContent} ${nestedShell}`, {
  gap: foundationVars.space[3],
  padding: 0,
  border: 0,
  borderRadius: 0,
  background: 'transparent'
})
