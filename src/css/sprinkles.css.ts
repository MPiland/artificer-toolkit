import { defineProperties, createSprinkles } from '@vanilla-extract/sprinkles'
import palette from './colors.css'
import { fontFamily, fontWeight, lineHeight, fontSize } from './typography.css'
import { size, space, position } from './size.css'
import { borderSize, borderRadius, shadows } from './border.css'

const responsiveProperties = defineProperties({
  properties: {
    display: ['none', 'flex', 'block', 'inline', 'inline-flex'],
    flexDirection: ['row', 'column'],
    justifyContent: [
      'stretch',
      'flex-start',
      'start',
      'end',
      'center',
      'flex-end',
      'space-around',
      'space-between',
    ],
    justifySelf: ['flex-start', 'center', 'flex-end'],
    alignItems: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
    alignSelf: ['flex-start', 'center', 'flex-end'],
    flex: {
      '1': '1 1 0%',
      'auto': '1 1 0%',
      'initial': '1 1 0%',
      'none': 'none',
    },
    flexWrap: ['wrap', 'wrap-reverse', 'nowrap'],
    position: ['static', 'fixed', 'absolute', 'relative', 'sticky'],
    paddingTop: space,
    paddingBottom: space,
    paddingLeft: space,
    paddingRight: space,
    marginTop: space,
    marginBottom: space,
    marginLeft: space,
    marginRight: space,
    gap: space,
    width: { ...size, screen: '100dvw' },
    height: { ...size, screen: '100dvh' },
    top: position,
    left: position,
    bottom: position,
    right: position,
    objectFit: ['contain', 'cover', 'fill', 'none', 'scale-down'],
    backgroundColor: palette,
    overflow: ['auto', 'hidden'],
    overflowX: ['auto', 'hidden'],
    overflowY: ['auto', 'hidden'],
  },
  shorthands: {
    p: ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight'],
    px: ['paddingLeft', 'paddingRight'],
    py: ['paddingTop', 'paddingBottom'],
    pb: ['paddingBottom'],
    pt: ['paddingTop'],
    m: ['marginTop', 'marginBottom', 'marginLeft', 'marginRight'],
    mx: ['marginLeft', 'marginRight'],
    my: ['marginTop', 'marginBottom'],
    mt: ['marginTop'],
    ms: ['marginLeft'],
    me: ['marginRight'],
    mb: ['marginBottom'],
    w: ['width'],
    h: ['height'],
    placeItems: ['justifyContent', 'alignItems'],
    inset: ['top', 'left', 'right', 'bottom'],
    bc: ['backgroundColor'],
  },
})

const systemProperties = defineProperties({
  conditions: {
    lightMode: {},
    darkMode: { '@media': '(prefers-color-scheme: dark)' },
  },
  defaultCondition: 'lightMode',
  properties: {
    color: palette,
    background: palette,
    borderColor: palette,
    fontFamily: fontFamily,
    fontSize: fontSize,
    fontWeight: fontWeight,
    lineHeight: lineHeight,
    borderRadius: borderRadius,
    borderTopWidth: borderSize,
    borderLeftWidth: borderSize,
    borderBottomWidth: borderSize,
    borderRightWidth: borderSize,
    borderWidth: borderSize,
    boxShadow: shadows,
    textAlign: ['center', 'left', 'right', 'justify'],
  },
  shorthands: {
    fs: ['fontSize'],
    ta: ['textAlign'],
  },
})

export const sprinkles = createSprinkles(responsiveProperties, systemProperties)

// It's a good idea to export the Sprinkles type too
export type Sprinkles = Parameters<typeof sprinkles>[0]
