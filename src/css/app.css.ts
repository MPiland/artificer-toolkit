import { globalStyle } from '@vanilla-extract/css'
import { app } from './layers.css'
import { fontFamily, fontSize } from './typography.css'

globalStyle(
  '*:where(:not(html, iframe, canvas, img, svg, video, audio):not(svg *, symbol *))',
  {
    '@layer': {
      [app]: {
        fontFamily: fontFamily['sans-serif'],
        margin: '0',
        boxSizing: 'border-box',
      },
    },
  }
)

globalStyle(
  '*:where(:not(html, iframe, canvas, img, svg, video, audio):not(svg *, symbol *):not(h1, h2, h3, h4, h5, h6))',
  {
    '@layer': {
      [app]: {
        fontSize: fontSize['font-size-0'],
      },
    },
  }
)

globalStyle('html, body, #root', {
  '@layer': {
    [app]: {
      height: '100lvh',
      width: '100lvw',
      padding: 0,
      margin: 0,
      boxSizing: 'border-box',
    },
  },
})
