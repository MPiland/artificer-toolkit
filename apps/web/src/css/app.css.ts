import { globalStyle } from '@vanilla-extract/css'
import { app } from './layers.css'
import { fontSize } from './typography.css'

globalStyle('*:where(:not(html, iframe, canvas, img, svg, video, audio):not(svg *, symbol *))', {
  '@layer': {
    [app]: {
      fontFamily: '"Roboto", sans-serif',
      margin: '0',
      boxSizing: 'border-box'
    }
  }
})

globalStyle('*:where(:not(html, iframe, canvas, img, svg, video, audio):not(svg *, symbol *):not(h1, h2, h3, h4, h5, h6, h1 *, h2 *, h3 *, h4 *, h5 *, h6 *))', {
  '@layer': {
    [app]: {
      'fontSize': fontSize['font-size-0'],

      '@media': {
        'screen and (max-width: 567px)': {
          fontSize: fontSize['font-size-1']
        }
      }
    }
  }
})

globalStyle('html, body, #root', {
  '@layer': {
    [app]: {
      height: '100dvh',
      width: '100dvw',
      padding: 0,
      margin: 0,
      boxSizing: 'border-box',
      overflow: 'hidden'
    }
  }
})
