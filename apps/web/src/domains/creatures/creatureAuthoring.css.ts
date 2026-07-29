import { style } from '@vanilla-extract/css'
import { foundationVars } from '#css/foundations.css'
import { app } from '#css/layers.css'

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

export const wide = style({
  '@layer': {
    [app]: {
      gridColumn: '1 / -1'
    }
  }
})

export const scoreGrid = style({
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
