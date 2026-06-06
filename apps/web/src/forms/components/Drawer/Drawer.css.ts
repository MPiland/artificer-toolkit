import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

const mobilePortrait = 'screen and (max-width: 640px) and (orientation: portrait)'

export const content = style({
  '@layer': {
    [app]: {
      border: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.panel,
      color: foundationVars.color.text.primary,
      '@media': {
        [mobilePortrait]: {
          inlineSize: '100%',
          maxInlineSize: '100vw',
          maxBlockSize: 'min(78dvh, 32rem)',
          borderInline: 0,
          borderBlockEnd: 0,
          borderStartStartRadius: foundationVars.radius.md,
          borderStartEndRadius: foundationVars.radius.md,
          borderEndStartRadius: 0,
          borderEndEndRadius: 0,
          overflow: 'hidden'
        }
      }
    }
  }
})

globalStyle(content, {
  '@media': {
    [mobilePortrait]: {
      blockSize: 'auto !important',
      flex: '0 0 auto !important',
      height: 'auto !important',
      maxHeight: 'min(78dvh, 32rem) !important'
    }
  }
})

globalStyle(`${content} > div`, {
  '@media': {
    [mobilePortrait]: {
      height: 'auto !important'
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      minBlockSize: 52,
      borderBlockEnd: `1px solid ${foundationVars.color.border.subtle}`,
      backgroundColor: foundationVars.color.surface.panel,
      '@media': {
        [mobilePortrait]: {
          minBlockSize: 0,
          paddingBlockStart: foundationVars.space[2],
          paddingBlockEnd: foundationVars.space[3]
        }
      }
    }
  }
})

export const title = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.body.fontSize,
      fontWeight: foundationVars.fontWeight.bold,
      lineHeight: foundationVars.typography.body.lineHeight,
      inlineSize: '100%',
      textAlign: 'center'
    }
  }
})

export const icon = style({
  '@layer': {
    [app]: {
      marginInlineStart: 0
    }
  }
})

export const body = style({
  '@layer': {
    [app]: {
      padding: foundationVars.space[4],
      backgroundColor: foundationVars.color.surface.canvas,
      '@media': {
        [mobilePortrait]: {
          maxBlockSize: 'calc(min(78dvh, 32rem) - 64px)',
          overflowY: 'auto',
          padding: foundationVars.space[3]
        }
      }
    }
  }
})
