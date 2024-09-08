// constants
const FIRST_TAG_REGEX = /<([a-zA-Z]+[0-9]?)/ // e.g., <h1>

// match-all-characters in case of newlines (DOTALL)
const HEAD_TAG_REGEX = /<head[^]*>/i
const BODY_TAG_REGEX = /<body[^]*>/i

/**
 * Creates an HTML document.
 *
 * @param html - The HTML string.
 * @param tagName - The element to render the HTML (with 'body' as fallback).
 * @returns - Document.
 */

const parseFromHTML = (html: string, tagName?: string): Document => {
  /**
   * DOMImplementation (performance: fair).
   *
   * @see https://developer.mozilla.org/docs/Web/API/DOMImplementation/createHTMLDocument
   */

  if (typeof document === 'object' && document.implementation) {
    const htmlDocument = document.implementation.createHTMLDocument()

    if (tagName) {
      const element = htmlDocument.documentElement.querySelector(tagName)

      if (element) {
        element.innerHTML = html
      }

      return htmlDocument
    }

    htmlDocument.documentElement.innerHTML = html
    return htmlDocument
  } else if (typeof window.DOMParser === 'function') {
    const domParser = new DOMParser()
    const mimeType = 'text/html'

    if (tagName) {
      /* istanbul ignore next */
      html = `<${tagName}>${html}</${tagName}>`
    }

    return domParser.parseFromString(html, mimeType)
  } else {
    throw new Error(
      'This browser does not support `document.implementation.createHTMLDocument` nor `DOMParser.prototype.parseFromString`'
    )
  }
}

/**
 * Template (performance: fast).
 *
 * @see https://developer.mozilla.org/docs/Web/HTML/Element/template
 */
const template = typeof document === 'object' && document.createElement('template')

// eslint-disable-next-line @typescript-eslint/no-unused-vars
let parseFromTemplate: (html: string) => NodeList

if (template && template.content) {
  /**
   * Uses a template element (content fragment) to parse HTML.
   *
   * @param html - HTML string.
   * @returns - Nodes.
   */
  parseFromTemplate = (html: string): NodeList => {
    template.innerHTML = html
    return template.content.childNodes
  }
}

/**
 * Parses HTML string to DOM nodes.
 *
 * @param html - HTML markup.
 * @returns - DOM nodes.
 */
export default function domParser(html: string): NodeList {
  const match = html.match(FIRST_TAG_REGEX)
  const firstTagName = match && match[1] ? match[1].toLowerCase() : ''

  switch (firstTagName) {
    case 'html': {
      const doc = parseFromHTML(html)

      // the created document may come with filler head/body elements,
      // so make sure to remove them if they don't actually exist
      if (!HEAD_TAG_REGEX.test(html)) {
        const element = doc.querySelector('head')
        element?.parentNode?.removeChild(element)
      }

      if (!BODY_TAG_REGEX.test(html)) {
        const element = doc.querySelector('body')
        element?.parentNode?.removeChild(element)
      }

      return doc.querySelectorAll('html')
    }

    case 'head':
    case 'body': {
      const elements = parseFromHTML(html).querySelectorAll(firstTagName)

      // if there's a sibling element, then return both elements
      if (BODY_TAG_REGEX.test(html) && HEAD_TAG_REGEX.test(html)) {
        return elements[0].parentNode!.childNodes
      }

      return elements
    }

    // low-level tag or text
    default: {
      if (parseFromTemplate) {
        return parseFromTemplate(html)
      }
      const element = parseFromHTML(html, 'body').querySelector('body')
      return element!.childNodes
    }
  }
}
