import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { renderSanitizedRichHtml, richHtmlToPlainText } from './richText'

describe('renderSanitizedRichHtml', () => {
  it('preserves supported prose markup', () => {
    const html = renderToStaticMarkup(
      renderSanitizedRichHtml('<p><strong>Arcane</strong> note</p>')
    )

    expect(html).toContain('<p>')
    expect(html).toContain('<strong>Arcane</strong>')
  })

  it('removes executable tags, event handlers, styles, and unsafe urls', () => {
    const html = renderToStaticMarkup(
      renderSanitizedRichHtml(`
      <p style="color:red" onclick="alert(1)">Hello</p>
      <script>alert(1)</script>
      <a href="javascript:alert(1)">bad</a>
      <img src="javascript:alert(1)" onerror="alert(1)" />
    `)
    )

    expect(html).not.toContain('<script')
    expect(html).not.toContain('onclick')
    expect(html).not.toContain('onerror')
    expect(html).not.toContain('style=')
    expect(html).not.toContain('javascript:')
  })

  it('removes remote media markup while preserving nearby prose and tables', () => {
    const html = renderToStaticMarkup(
      renderSanitizedRichHtml(`
      <p>Visible prose</p>
      <picture><source srcset="https://media.example.test/image.webp" /><img src="https://media.example.test/image.png" /></picture>
      <video src="https://media.example.test/video.mp4"><track src="https://media.example.test/captions.vtt" /></video>
      <audio src="https://media.example.test/audio.mp3"></audio>
      <table><tbody><tr><td>Visible table value</td></tr></tbody></table>
    `)
    )

    expect(html).toContain('Visible prose')
    expect(html).toContain('Visible table value')
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<picture')
    expect(html).not.toContain('<source')
    expect(html).not.toContain('<video')
    expect(html).not.toContain('<audio')
    expect(html).not.toContain('<track')
    expect(html).not.toContain('media.example.test')
  })

  it('keeps safe table width styles and removes unsafe table styles', () => {
    const html = renderToStaticMarkup(
      renderSanitizedRichHtml(`
      <table style="width: 100%; background: url(javascript:alert(1))">
        <colgroup>
          <col style="width: 5rem; color: red" />
          <col style="min-width: 24ch" />
        </colgroup>
        <tbody>
          <tr>
            <td style="width: 25%">d8</td>
            <td style="position: fixed">Trait</td>
          </tr>
        </tbody>
      </table>
    `)
    )

    expect(html).toContain('style="width:100%"')
    expect(html).toContain('style="width:5rem"')
    expect(html).toContain('style="min-width:24ch"')
    expect(html).toContain('style="width:25%"')
    expect(html).not.toContain('background')
    expect(html).not.toContain('position')
    expect(html).not.toContain('javascript:')
  })
})

describe('richHtmlToPlainText', () => {
  it('preserves block separation and removes blocked media', () => {
    expect(
      richHtmlToPlainText(
        '<p>First paragraph</p><p>Second <strong>paragraph</strong></p><img src="https://example.test/tracker.png" />'
      )
    ).toBe('First paragraph Second paragraph')
  })
})
