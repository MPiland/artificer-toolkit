import { globalStyle, style } from '@vanilla-extract/css'
import * as inputStyles from '../../ui/primitives/Select/Select.css.ts'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'
import { fieldGrid, groupEditorContent, sectionStack } from './FormRenderer.css'

export const collectionContainerDefault = style({})

export const collectionContainerCard = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[3]
    }
  }
})

export const collectionContainerFlat = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[2]
    }
  }
})

export const collectionContainerCompact = style({
  '@layer': {
    [app]: {
      display: 'contents'
    }
  }
})

export const collectionHeaderCard = style({
  '@layer': {
    [app]: {
      order: 2,
      justifyContent: 'flex-end',
      marginBlockStart: 0,
      marginBlockEnd: 0
    }
  }
})

export const collectionHeaderFlat = style({
  '@layer': {
    [app]: {
      order: 2,
      justifyContent: 'flex-start',
      minBlockSize: 32,
      marginBlockStart: 0,
      marginBlockEnd: 0
    }
  }
})

export const collectionList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space['3'],
      order: 1
    }
  }
})

export const collectionListFlat = style({})

export const collectionListCompactTable = style({
  '@layer': {
    [app]: {
      gap: 0,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      overflow: 'hidden'
    }
  }
})

export const collectionListCompact = style({
  '@layer': {
    [app]: {
      display: 'contents'
    }
  }
})

export const collectionItem = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space['3'],
      paddingBlock: foundationVars.space['3'],
      borderBottom: `1px solid ${foundationVars.color.border.subtle}`,

      ':last-child': {
        borderBottom: 0
      }
    }
  }
})

export const collectionItemCompactTable = style({
  '@layer': {
    [app]: {
      gap: 0,
      paddingBlock: foundationVars.space[2],
      paddingInline: foundationVars.space[3],
      background: foundationVars.color.surface.panel
    }
  }
})

export const collectionItemCard = style({
  '@layer': {
    [app]: {
      position: 'relative',
      marginBlockEnd: 0,
      padding: `${foundationVars.space[8]} ${foundationVars.space[3]} ${foundationVars.space[3]}`,
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.panel,

      ':last-child': {
        borderBottom: `1px solid ${foundationVars.color.border.subtle}`
      }
    }
  }
})

export const collectionItemFlat = style({
  '@layer': {
    [app]: {
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      gap: foundationVars.space[2]
    }
  }
})

export const collectionItemCompact = style({
  '@layer': {
    [app]: {
      position: 'relative'
    }
  }
})

export const collectionItemHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space['3']
    }
  }
})

export const collectionItemHeaderCard = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      insetBlockStart: foundationVars.space[2],
      insetInlineStart: foundationVars.space[3],
      insetInlineEnd: foundationVars.space[2],
      zIndex: 1,
      justifyContent: 'space-between'
    }
  }
})

export const collectionItemHeaderInline = style({
  '@layer': {
    [app]: {
      position: 'static',
      order: 2,
      justifyContent: 'flex-end',
      marginBlockStart: foundationVars.space[1]
    }
  }
})

export const collectionItemBody = style({
  '@layer': {
    [app]: {
      marginTop: foundationVars.space['2'],
      padding: foundationVars.space['4'],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.raised
    }
  }
})

export const collectionItemBodyCompactTable = style({
  '@layer': {
    [app]: {
      marginTop: 0,
      padding: foundationVars.space[3],
      border: 0,
      borderRadius: 0,
      background: 'transparent'
    }
  }
})

export const collectionItemBodyCard = style({})

export const collectionItemBodyInline = style({})

export const collectionItemBodyTrigger = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      alignSelf: 'stretch',
      flex: '1 1 auto',
      gap: foundationVars.space['2'],
      minWidth: 0,
      width: '100%',
      minBlockSize: 44,
      paddingBlock: foundationVars.space['2'],
      paddingInline: 0,
      border: 0,
      background: 'transparent',
      color: foundationVars.color.text.primary,
      cursor: 'pointer',
      justifyContent: 'flex-start',
      textAlign: 'left'
    }
  }
})

export const collectionItemBodyActionLabel = style({
  '@layer': {
    [app]: {
      marginInlineStart: 'auto',
      color: foundationVars.color.text.accent,
      fontSize: '13px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '18px'
    }
  }
})

export const collectionItemChevron = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      color: foundationVars.color.text.secondary,
      transition: `transform ${foundationVars.motion.fast} ease`
    }
  }
})

export const collectionItemChevronOpen = style({
  '@layer': {
    [app]: {
      transform: 'rotate(180deg)'
    }
  }
})

export const manualOrderingRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '44px minmax(0, 1fr)',
      gap: foundationVars.space[2],
      alignItems: 'start',

      selectors: {
        '&[data-dragging]': {
          opacity: 0.64
        }
      }
    }
  }
})

export const manualOrderingHandle = style({
  '@layer': {
    [app]: {
      display: 'inline-grid',
      placeItems: 'center',
      inlineSize: 44,
      minBlockSize: 44,
      padding: 0,
      border: 0,
      borderRadius: foundationVars.radius.sm,
      background: 'transparent',
      color: foundationVars.color.text.secondary,
      cursor: 'grab',

      ':focus-visible': {
        outline: `2px solid ${foundationVars.color.input.border.focus}`,
        outlineOffset: 2
      },

      ':disabled': {
        cursor: 'not-allowed',
        opacity: 0.5
      }
    }
  }
})

export const manualOrderingContent = style({
  '@layer': {
    [app]: {
      minWidth: 0
    }
  }
})

export const collectionItemTitle = style({
  '@layer': {
    [app]: {
      display: 'block',
      margin: 0,
      color: foundationVars.color.text.primary,
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '20px'
    }
  }
})

export const collectionItemDescription = style({
  '@layer': {
    [app]: {
      display: 'block',
      margin: 0,
      color: foundationVars.color.text.muted,
      fontSize: '12px',
      lineHeight: '18px'
    }
  }
})

export const collectionDivider = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[2],
      color: foundationVars.color.text.muted,
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.semibold,
      lineHeight: '16px',

      '::before': {
        content: '',
        blockSize: 1,
        flex: 1,
        background: foundationVars.color.border.subtle
      },

      '::after': {
        content: '',
        blockSize: 1,
        flex: 1,
        background: foundationVars.color.border.subtle
      }
    }
  }
})

export const collectionHeading = style({
  '@layer': {
    [app]: {
      margin: 0,
      color: foundationVars.color.text.secondary,
      fontSize: '17px',
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: '22px'
    }
  }
})

export const collectionHeadingIcon = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: foundationVars.color.accent.tertiarySolid
    }
  }
})

export const collectionHeadingHelpIcon = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted
    }
  }
})

export const collectionCard = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[3],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.panel,
      transition: `border-color ${foundationVars.motion.fast} ease, background-color ${foundationVars.motion.fast} ease`,

      ':hover': {
        borderColor: foundationVars.color.border.strong,
        backgroundColor: foundationVars.color.card.background.hover
      },

      selectors: {
        '&[data-editing]': {
          borderColor: foundationVars.color.card.border.selected
        },
        '&[data-editing]:hover': {
          borderColor: foundationVars.color.card.border.selected
        }
      },

      ':last-child': {
        borderBottom: `1px solid ${foundationVars.color.border.subtle}`
      }
    }
  }
})

export const collectionCardIcon = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flex: '0 0 28px',
      color: foundationVars.color.accent.tertiarySolid
    }
  }
})

export const collectionCardMeta = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: foundationVars.space[1],
      marginBlockStart: foundationVars.space[1]
    }
  }
})

export const collectionCardChip = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      minBlockSize: 22,
      paddingInline: foundationVars.space[2],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.surface.canvas,
      color: foundationVars.color.text.secondary,
      fontSize: '11px',
      lineHeight: '16px'
    }
  }
})

export const collectionCardActions = style({
  '@layer': {
    [app]: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: foundationVars.space[1],
      flexShrink: 0
    }
  }
})

export const collectionOverviewHeader = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[3]
    }
  }
})

export const collectionOverviewHeaderRule = style({
  '@layer': {
    [app]: {
      blockSize: 1,
      flex: 1,
      background: foundationVars.color.border.subtle
    }
  }
})

globalStyle(`${groupEditorContent} ${collectionItem}`, {
  gap: foundationVars.space[3],
  paddingBlock: foundationVars.space[2],
  borderBlockEnd: 0
})

globalStyle(`${groupEditorContent} ${collectionItemCard}`, {
  paddingBlockStart: `calc(44px + ${foundationVars.space[2]})`,
  borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
})

globalStyle(`${groupEditorContent} ${collectionItemBody}`, {
  marginBlockStart: 0,
  padding: 0,
  border: 0,
  borderRadius: 0,
  background: 'transparent'
})

globalStyle(`${groupEditorContent} ${collectionItemBodyCard}`, {
  marginBlockStart: 0,
  paddingBlockStart: 0,
  paddingInline: 0,
  paddingBlockEnd: 0,
  border: 0
})

globalStyle(`${groupEditorContent} ${collectionItemBodyInline}`, {
  marginBlockStart: 0,
  padding: 0,
  border: 0
})

globalStyle(`${groupEditorContent} ${collectionItemBodyTrigger}`, {
  paddingBlock: foundationVars.space[1]
})

globalStyle(`${groupEditorContent} ${inputStyles.root}`, {
  display: 'grid',
  gridTemplateColumns: '7.5rem minmax(0, 1fr)',
  alignItems: 'center',
  columnGap: foundationVars.space[4]
})

globalStyle(`${groupEditorContent} ${inputStyles.root} > ${inputStyles.label}`, {
  gridColumn: '1'
})

globalStyle(`${groupEditorContent} ${inputStyles.root} > :not(${inputStyles.label})`, {
  gridColumn: '2',
  minInlineSize: 0,
  inlineSize: '100%'
})

globalStyle(`${groupEditorContent} ${inputStyles.input}`, {
  minHeight: '34px',
  height: '34px',
  inlineSize: '100%',
  borderRadius: foundationVars.radius.md,

  '@media': {
    '(max-width: 768px)': {
      minHeight: '44px',
      height: '44px'
    }
  }
})

globalStyle(`${groupEditorContent} ${collectionItemCompact} ${collectionItemHeaderInline}`, {
  display: 'none'
})

globalStyle(`${groupEditorContent} ${collectionItemCompact} > [id]`, {
  display: 'contents'
})

globalStyle(`${groupEditorContent} ${collectionItemCompact} ${collectionItemBodyInline}`, {
  display: 'contents'
})

globalStyle(
  `${groupEditorContent} ${collectionContainerFlat} > ${collectionListFlat} > ${collectionItemFlat}:last-child`,
  {
    position: 'static'
  }
)

globalStyle(
  `${groupEditorContent} ${collectionContainerFlat} > ${collectionListFlat} > ${collectionItemFlat}:last-child ${collectionItemHeaderInline}`,
  {
    position: 'absolute',
    insetBlockEnd: 0,
    insetInlineEnd: 0,
    minBlockSize: 44,
    marginBlockStart: 0,
    alignItems: 'center'
  }
)

globalStyle(`${groupEditorContent} ${collectionItemCompact} ${sectionStack}`, {
  display: 'contents'
})

globalStyle(`${groupEditorContent} ${collectionItemCompact} section`, {
  display: 'contents'
})

globalStyle(`${groupEditorContent} ${collectionItemCompact} ${fieldGrid}`, {
  display: 'contents'
})

globalStyle(`${groupEditorContent} ${inputStyles.root}`, {
  '@media': {
    '(max-width: 768px)': {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: foundationVars.space[1]
    }
  }
})

globalStyle(`${groupEditorContent} ${inputStyles.root} > *`, {
  '@media': {
    '(max-width: 768px)': {
      gridColumn: '1'
    }
  }
})
