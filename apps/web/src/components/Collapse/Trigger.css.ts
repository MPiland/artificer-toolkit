import { globalStyle, style } from '@vanilla-extract/css'
import { foundationVars } from '../../css/foundations.css.ts'
import { app } from '../../css/layers.css.ts'

export const base = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: foundationVars.space[2],
      backgroundColor: 'transparent',
    },
  },
})

export const button = style({
  '@layer': {
    [app]: {
      display: 'flex',
      flex: 1,
      alignItems: 'center',
      justifyContent: 'space-between',
      minWidth: 0,
      minHeight: '36px',
      padding: `${foundationVars.space[3]} 0`,
      borderRadius: foundationVars.radius.sm,
      color: 'inherit',
      fontSize: '14px',
      fontWeight: '500',
      cursor: 'pointer',
      transition: `background-color ${foundationVars.motion.fast} ease, box-shadow ${foundationVars.motion.fast} ease`,
      selectors: {
        '&:focus-visible': {
          outline: 'none',
          boxShadow: foundationVars.shadow.focus,
        },
      },
    },
  },
})

export const title = style({
  '@layer': {
    [app]: {
      textWrap: 'nowrap',
      margin: `0 ${foundationVars.space[2]}`,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  },
})

export const icon = style({
  '@layer': {
    [app]: {
      flexShrink: 0,
      opacity: 0.6,
      height: foundationVars.space[4],
      width: foundationVars.space[4],
    },
  },
})

export const icon_collapse = style({
  '@layer': {
    [app]: {
      transitionProperty: 'transform, translate, scale, rotate',
      transitionTimingFunction: 'cubic-bezier(0.7,0,0.3,1)',
      transitionDuration: '.3s',
      transformOrigin: '50%',

      selectors: {
        [`${base}[data-state="open"] &`]: {
          rotate: '180deg',
        },
      },
    },
  },
})

globalStyle(`${base}[data-state="open"] ${icon_collapse} > path:last-child`, {
  '@layer': {
    [app]: {
      opacity: '0',
      rotate: '90deg',
    },
  },
})
