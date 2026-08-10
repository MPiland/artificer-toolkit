import { style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'
const tablet = 'screen and (max-width: 64rem)'

export const inventoryWorkspace = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[5],
      inlineSize: '100%',
      maxInlineSize: '72rem',
      minInlineSize: 0
    }
  }
})

export const inventoryPanel = style({
  '@layer': {
    [app]: {
      maxInlineSize: '64rem'
    }
  }
})

export const inlineFieldIconAction = style({
  '@layer': {
    [app]: {
      minInlineSize: '2.5rem',
      inlineSize: '2.5rem',
      minBlockSize: '2.5rem',
      blockSize: '2.5rem'
    }
  }
})

export const partyInventoryActionGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(12rem, 1fr) 8rem 10rem',
      alignItems: 'end',
      gap: foundationVars.space[3],
      minInlineSize: 0,
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const partyInventoryAddSection = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      paddingBlockStart: foundationVars.space[2]
    }
  }
})

export const partyInventoryActionList = style({
  '@layer': {
    [app]: {
      display: 'grid'
    }
  }
})

export const partyInventoryActionRow = style([
  partyInventoryActionGrid,
  {
    '@layer': {
      [app]: {
        paddingBlock: foundationVars.space[3],
        selectors: {
          '&:not(:last-child)': {
            borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
          }
        }
      }
    }
  }
])

export const partyInventoryActionButtons = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: foundationVars.space[2],
      '@media': {
        [compact]: {
          justifyContent: 'flex-start'
        }
      }
    }
  }
})

export const confirmActions = style({
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: foundationVars.space[2],
      '@media': {
        [compact]: {
          flexDirection: 'column-reverse'
        }
      }
    }
  }
})

export const inventoryTransferGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(12rem, 1fr) minmax(12rem, 1fr) 7rem auto',
      alignItems: 'end',
      gap: foundationVars.space[3],
      minInlineSize: 0,
      '@media': {
        [tablet]: {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))'
        },
        [compact]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})
