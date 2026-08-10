import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const mobileToolbar = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'end',
      gap: foundationVars.space[2],
      minInlineSize: 0
    }
  }
})

export const mobileFiltersButton = style({
  '@layer': {
    [app]: {
      minHeight: '40px',
      whiteSpace: 'nowrap'
    }
  }
})

export const mobileDrawerContent = style({
  '@layer': {
    [app]: {
      flex: '0 1 auto',
      blockSize: 'auto',
      inlineSize: '100%',
      minBlockSize: 0,
      maxInlineSize: '100%',
      maxBlockSize: '80dvh',
      borderBlockStart: `1px solid ${foundationVars.color.border.strong}`,
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.text.primary
    }
  }
})

export const mobileDrawerHeader = style({
  '@layer': {
    [app]: {
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`
    }
  }
})

export const mobileDrawerBody = style({
  '@layer': {
    [app]: {
      display: 'grid',
      minBlockSize: 0,
      overflow: 'hidden',
      padding: 0
    }
  }
})

export const mobileDrawerStack = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr) auto',
      minBlockSize: 0,
      overflow: 'hidden'
    }
  }
})

export const mobileDrawerFields = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      minBlockSize: 0,
      overflowY: 'auto',
      padding: foundationVars.space[4]
    }
  }
})

export const mobileDrawerActions = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0, 1fr)',
      gap: foundationVars.space[3],
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]} max(${foundationVars.space[4]}, env(safe-area-inset-bottom))`,
      borderBlockStart: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.panel
    }
  }
})
