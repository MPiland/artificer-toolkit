import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderSanitizedRichHtml } from './renderSanitizedRichHtml'

describe('renderSanitizedRichHtml', () => {
  it('preserves supported prose markup', () => {
    const html = renderToStaticMarkup(renderSanitizedRichHtml('<p><strong>Arcane</strong> note</p>'))

    expect(html).toContain('<p>')
    expect(html).toContain('<strong>Arcane</strong>')
  })

  it('removes executable tags, event handlers, styles, and unsafe urls', () => {
    const html = renderToStaticMarkup(renderSanitizedRichHtml(`
      <p style="color:red" onclick="alert(1)">Hello</p>
      <script>alert(1)</script>
      <a href="javascript:alert(1)">bad</a>
      <img src="javascript:alert(1)" onerror="alert(1)" />
    `))

    expect(html).not.toContain('<script')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('style=')
    expect(html).not.toContain('javascript:')
  })
})
