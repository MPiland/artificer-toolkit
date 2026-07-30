import { style } from '@vanilla-extract/css'
import { foundationVars, media } from '../../../css/foundations.css.ts'
import { app } from '../../../css/layers.css.ts'

export const shell = style({
  '@layer': {
    [app]: {
      borderInlineStart: `1px solid ${foundationVars.color.authoring.border}`,
      backgroundColor: foundationVars.color.authoring.rail,
      inlineSize: 'clamp(360px, 27vw, 416px)',
      blockSize: '100%',
      minBlockSize: 0,
      maxInlineSize: '100%',
      flexShrink: 0,
      '@media': {
        [media.tablet]: {
          inlineSize: '100%',
          borderRadius: 0,
          borderInlineStart: 0
        }
      }
    }
  }
})

export const header = style({
  '@layer': {
    [app]: {
      minBlockSize: 50,
      padding: `${foundationVars.space[3]} ${foundationVars.space[5]}`,
      backgroundColor: foundationVars.color.authoring.band,
      borderBlockEnd: `1px solid ${foundationVars.color.authoring.border}`,
      color: foundationVars.color.text.primary,
      fontSize: foundationVars.typography.bodySm.fontSize,
      fontWeight: foundationVars.fontWeight.bold,
      letterSpacing: '0.06em',
      lineHeight: '20px',
      textTransform: 'uppercase'
    }
  }
})

export const content = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateRows: 'minmax(0, 1fr) auto',
      gap: foundationVars.space[3],
      blockSize: 'calc(100% - 50px)',
      padding: foundationVars.space[4],
      overflow: 'hidden'
    }
  }
})

export const previewFrame = style({
  '@layer': {
    [app]: {
      display: 'grid',
      alignContent: 'start',
      gridAutoRows: 'max-content',
      gap: 0,
      minBlockSize: 0,
      border: `1px solid ${foundationVars.color.authoring.previewBorder}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.authoring.preview,
      overflowX: 'hidden',
      overflowY: 'auto'
    }
  }
})

export const previewNotice = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gridTemplateColumns: '20px minmax(0, 1fr)',
      alignItems: 'center',
      gap: foundationVars.space[3],
      minBlockSize: 76,
      padding: foundationVars.space[4],
      border: `1px solid ${foundationVars.color.authoring.noticeBorder}`,
      borderRadius: foundationVars.radius.sm,
      backgroundColor: foundationVars.color.authoring.notice,
      color: foundationVars.color.text.secondary,
      fontSize: '13px',
      lineHeight: '19px'
    }
  }
})

export const previewNoticeIcon = style({
  '@layer': {
    [app]: {
      color: foundationVars.color.accent.tertiarySolid
    }
  }
})

export const previewNoticeCopy = style({
  '@layer': {
    [app]: {
      display: 'grid',
      gap: 2
    }
  }
})

export const drawerBody = style({
  '@layer': {
    [app]: {
      padding: 0,
      blockSize: '100%'
    }
  }
})

export const drawerAccessibleHeader = style({
  '@layer': {
    [app]: {
      position: 'absolute',
      inlineSize: '1px',
      blockSize: '1px',
      padding: 0,
      overflow: 'hidden',
      clip: 'rect(0 0 0 0)',
      whiteSpace: 'nowrap'
    }
  }
})

export const closeButton = style({
  '@layer': {
    [app]: {
      marginInlineEnd: 'auto',
      marginInlineStart: 0,
      display: 'inline-flex'
    }
  }
})
