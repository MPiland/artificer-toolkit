import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '#app/css/foundations.css'
import { app } from '#app/css/layers.css'

const compact = 'screen and (max-width: 48rem)'
const tablet = 'screen and (max-width: 64rem)'

export const encounterActorSummary = style({
  '@layer': {
    [app]: {
      paddingBlock: foundationVars.space[2],
      selectors: {
        '&:not(:last-child)': {
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const encounterManager = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      minInlineSize: 0,
      paddingBlockStart: foundationVars.space[2],
      '@media': {
        [tablet]: {
          paddingBlockStart: 0
        }
      }
    }
  }
})

export const encounterActorItem = style({
  '@layer': {
    [app]: {
      selectors: {
        '&[data-current]': {
          borderColor: foundationVars.color.accent.border
        }
      }
    }
  }
})

export const encounterActorHeader = style({
  '@layer': {
    [app]: {
      inlineSize: '100%'
    }
  }
})

export const encounterActorControl = style({
  '@layer': {
    [app]: {
      flex: '1 1 auto',
      minInlineSize: 0
    }
  }
})

export const encounterActorControls = style({
  '@layer': {
    [app]: {
      alignItems: 'flex-end',
      gap: foundationVars.space[3],
      '@media': {
        [compact]: {
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          inlineSize: '100%'
        }
      }
    }
  }
})

export const encounterNumericField = style({
  '@layer': {
    [app]: {
      flex: '0 0 6.5rem',
      inlineSize: '6.5rem',
      '@media': {
        [compact]: {
          inlineSize: '100%'
        }
      }
    }
  }
})

export const encounterRoundField = style({
  '@layer': {
    [app]: {
      inlineSize: '5.5rem'
    }
  }
})

export const encounterTurnSelect = style({
  '@layer': {
    [app]: {
      minInlineSize: '12rem',
      maxInlineSize: '18rem',
      '@media': {
        [compact]: {
          flex: '1 1 100%',
          maxInlineSize: 'none'
        }
      }
    }
  }
})

export const encounterTurnButton = style({
  '@layer': {
    [app]: {
      flex: '0 0 8rem',
      inlineSize: '8rem',
      '@media': {
        [compact]: {
          flex: '1 1 8rem',

          inlineSize: 'auto'
        }
      }
    }
  }
})

export const encounterVisibility = style({
  '@layer': {
    [app]: {
      display: 'flex',
      alignItems: 'center',
      minBlockSize: '2.25rem',
      paddingBlockEnd: '0.3rem',
      '@media': {
        [compact]: {
          minBlockSize: 'auto',
          paddingBlock: foundationVars.space[2]
        }
      }
    }
  }
})

export const encounterStatBlock = style({
  '@layer': {
    [app]: {
      display: 'grid',
      overflow: 'hidden',
      border: `1px solid ${foundationVars.color.border.subtle}`,
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.panel
    }
  }
})

export const encounterStatSummary = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
      margin: 0,
      paddingBlock: foundationVars.space[3],
      '@media': {
        [compact]: {
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          rowGap: foundationVars.space[3]
        }
      }
    }
  }
})

export const encounterAbilities = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'repeat(6, minmax(2.5rem, 1fr))',
      margin: 0,
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`,
      borderBlock: `1px solid ${foundationVars.color.border.subtle}`,
      background: foundationVars.color.surface.recessed,
      textAlign: 'center',
      '@media': {
        [compact]: {
          gridTemplateColumns: 'repeat(3, minmax(2.5rem, 1fr))',
          rowGap: foundationVars.space[3]
        }
      }
    }
  }
})

export const encounterDefenseList = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[2],
      margin: 0,
      padding: `${foundationVars.space[3]} ${foundationVars.space[4]}`
    }
  }
})

globalStyle(`${encounterStatSummary} > div`, {
  '@layer': {
    [app]: {
      minInlineSize: 0,
      paddingInline: foundationVars.space[4]
    }
  }
})

globalStyle(`${encounterStatSummary} dt, ${encounterAbilities} dt`, {
  '@layer': {
    [app]: {
      color: foundationVars.color.text.muted,
      fontSize: foundationVars.typography.caption.fontSize,
      lineHeight: 1.3
    }
  }
})

globalStyle(`${encounterStatSummary} dd`, {
  '@layer': {
    [app]: {
      margin: 0,
      overflowWrap: 'anywhere',
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.semibold
    }
  }
})

globalStyle(`${encounterAbilities} dd`, {
  '@layer': {
    [app]: {
      display: 'flex',
      justifyContent: 'center',
      gap: foundationVars.space[1],
      margin: 0,
      fontSize: foundationVars.typography.bodySm.fontSize
    }
  }
})

globalStyle(`${encounterAbilities} dd span`, {
  '@layer': { [app]: { color: foundationVars.color.text.muted } }
})

globalStyle(`${encounterDefenseList} > div`, {
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '8rem minmax(0, 1fr)',
      gap: foundationVars.space[2],
      '@media': { [compact]: { gridTemplateColumns: '1fr' } }
    }
  }
})

globalStyle(`${encounterDefenseList} dt`, {
  '@layer': { [app]: { fontWeight: foundationVars.fontWeight.semibold } }
})

globalStyle(`${encounterDefenseList} dd`, {
  '@layer': { [app]: { margin: 0 } }
})

export const encounterReminders = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: foundationVars.space[3],
      paddingBlock: foundationVars.space[3]
    }
  }
})

export const encounterReminderRow = style({
  '@layer': {
    [app]: {
      minBlockSize: '2.75rem',
      paddingInline: foundationVars.space[3],
      borderRadius: foundationVars.radius.md,
      background: foundationVars.color.surface.recessed
    }
  }
})

export const encounterReminderEditor = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[4],
      borderRadius: foundationVars.radius.lg,
      background: foundationVars.color.surface.recessed
    }
  }
})

export const encounterTimelineRow = style({
  '@layer': {
    [app]: {
      minBlockSize: '2.5rem',
      selectors: {
        '&:not(:last-child)': {
          borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`
        }
      }
    }
  }
})

export const encounterBuilderGrid = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.45fr) minmax(18rem, .75fr)',
      gap: foundationVars.space[4],
      alignItems: 'start',
      minInlineSize: 0,
      '@media': {
        [tablet]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const encounterBuilderSourceRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(14rem, 1fr) auto',
      inlineSize: '100%',
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

export const encounterBuilderCustomRow = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: 'minmax(12rem, 1fr) minmax(8rem, 0.45fr) auto',
      inlineSize: '100%',
      '@media': {
        [compact]: {
          gridTemplateColumns: '1fr'
        }
      }
    }
  }
})

globalStyle(`${encounterBuilderSourceRow} > :last-child`, {
  '@layer': { [app]: { justifySelf: 'start' } }
})

globalStyle(`${encounterBuilderCustomRow} > :last-child`, {
  '@layer': { [app]: { justifySelf: 'start' } }
})
