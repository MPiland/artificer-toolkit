import { style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

const mobile = 'screen and (max-width: 760px)'

export const contentWide = style({
  '@layer': {
    [app]: {
      maxWidth: '1188px'
    }
  }
})

export const fieldGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: foundationVars.space[4],
      '@media': {
        [mobile]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const singleField = style({
  '@layer': {
    [app]: {
      width: 'min(100%, 280px)',
      '@media': {
        [mobile]: {
          width: '100%'
        }
      }
    }
  }
})

export const wide = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})

export const collectionList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4]
    }
  }
})

export const collectionRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1fr) auto',
      alignItems: 'center',
      gap: foundationVars.space[4],
      minHeight: '44px'
    }
  }
})

export const rowTitle = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '14px',
      fontWeight: foundationVars.fontWeight.medium,
      lineHeight: '22px'
    }
  }
})

export const rowDescription = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '12px',
      lineHeight: '18px'
    }
  }
})

export const rowActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      gap: foundationVars.space[4]
    }
  }
})

export const emptyCopy = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: foundationVars.typography.bodySm.fontSize
    }
  }
})

export const sectionAction = style({
  '@layer': {
    [app]: {
      justifySelf: 'start',
      width: 'fit-content'
    }
  }
})

export const inheritedPanel = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[4],
      maxWidth: '680px'
    }
  }
})

export const inheritedGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: foundationVars.space[4],
      '@media': {
        [mobile]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const inheritedItem = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[1],
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.subtle
    }
  }
})

export const inheritedLabel = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.secondary,
      fontSize: '11px',
      fontWeight: foundationVars.fontWeight.medium,
      letterSpacing: '0.06em',
      textTransform: 'uppercase'
    }
  }
})

export const inheritedValue = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: '13px',
      lineHeight: '20px'
    }
  }
})
