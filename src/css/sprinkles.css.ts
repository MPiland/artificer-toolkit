import { defineProperties, createSprinkles, createMapValueFn, ConditionalValue } from '@vanilla-extract/sprinkles'
import { fontFamily, fontWeight, lineHeight, fontSize } from './typography.css'
import { size, space, position } from './size.css'
import { borderSize, borderRadius, shadows } from './border.css'
import { app } from './layers.css'

const responsiveProperties = defineProperties({
  '@layer': app,
  'conditions': {
    mobile: { '@media': 'screen and (max-width: 567px)' },
    tablet: { '@media': 'screen and (max-width: 1024px)' },
    desktop: { '@media': 'screen and (min-width: 1025px)' },
  },
  'defaultCondition': 'desktop',
  'responsiveArray': ['desktop', 'tablet', 'mobile'],
  'properties': {
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
      'space-evenly',
    ],
    justifyItems: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
    justifySelf: ['flex-start', 'center', 'flex-end'],
    alignItems: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
    alignSelf: ['flex-start', 'center', 'flex-end'],
    alignContent: ['stretch', 'flex-start', 'center', 'flex-end', 'space-around', 'space-between'],
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
    rowGap: space,
    columnGap: space,
    width: { ...size, screen: '100dvw' },
    height: { ...size, screen: '100dvh' },
    top: position,
    left: position,
    bottom: position,
    right: position,
    objectFit: ['contain', 'cover', 'fill', 'none', 'scale-down'],
    overflow: ['auto', 'hidden'],
    overflowX: ['auto', 'hidden'],
    overflowY: ['auto', 'hidden'],
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
    whiteSpace: ['normal', 'nowrap', 'pre', 'pre-line', 'pre-wrap'],
  },
  'shorthands': {
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
    fs: ['fontSize'],
    ta: ['textAlign'],
    ws: ['whiteSpace'],
  },
})

export type ResponsiveValue<Value extends string | number> = ConditionalValue<typeof responsiveProperties, Value>

export const mapResponsiveValue = createMapValueFn(responsiveProperties)

export const sprinkles = createSprinkles(responsiveProperties)

export type Sprinkles = Parameters<typeof sprinkles>[0]
