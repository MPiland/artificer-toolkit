import { createElement, type ReactNode } from 'react'
import parse, {
  attributesToProps,
  domToReact,
  htmlToDOM,
  type DOMNode,
  type Element,
  type HTMLReactParserOptions
} from 'html-react-parser'

const BLOCKED_TAGS = new Set([
  'base',
  'button',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'math',
  'meta',
  'object',
  'script',
  'select',
  'style',
  'svg',
  'textarea'
])

const URL_ATTRIBUTES = new Set(['action', 'formaction', 'href', 'src', 'xlink:href'])
const VOID_TAGS = new Set(['area', 'br', 'col', 'hr', 'img', 'source', 'track', 'wbr'])
const TABLE_STYLE_TAGS = new Set(['col', 'table', 'td', 'th'])
const TABLE_STYLE_PROPERTIES = new Set(['min-width', 'width'])
const TABLE_SIZE_VALUE_PATTERN = /^(?:\d+(?:\.\d+)?(?:ch|em|px|rem|%)|auto)$/i
const PLAIN_TEXT_SEPARATOR_TAGS = new Set([
  'blockquote',
  'br',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'li',
  'p',
  'pre',
  'table',
  'tr'
])

function isElementNode(domNode: DOMNode): domNode is Element {
  const candidate = domNode as Partial<Element>
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.attribs === 'object' &&
    candidate.attribs !== null &&
    Array.isArray(candidate.children)
  )
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./') ||
    trimmed.startsWith('../')
  ) {
    return true
  }

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
  } catch {
    return !trimmed.includes(':')
  }
}

function sanitizeStyleAttribute(tagName: string, value: string): string | null {
  if (!TABLE_STYLE_TAGS.has(tagName)) return null

  const declarations = value
    .split(';')
    .map((declaration) => declaration.trim())
    .filter(Boolean)
    .flatMap((declaration) => {
      const separatorIndex = declaration.indexOf(':')
      if (separatorIndex < 1) return []

      const property = declaration.slice(0, separatorIndex).trim().toLowerCase()
      const propertyValue = declaration.slice(separatorIndex + 1).trim()
      if (!TABLE_STYLE_PROPERTIES.has(property) || !TABLE_SIZE_VALUE_PATTERN.test(propertyValue)) {
        return []
      }

      return [`${property}: ${propertyValue}`]
    })

  return declarations.length ? declarations.join('; ') : null
}

function sanitizeAttributes(
  tagName: string,
  attributes: Record<string, string | undefined>
): Record<string, string> {
  const sanitized: Record<string, string> = {}

  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined) continue

    const normalizedName = name.toLowerCase()
    if (normalizedName.startsWith('on') || normalizedName === 'srcdoc') {
      continue
    }

    if (normalizedName === 'style') {
      const safeStyle = sanitizeStyleAttribute(tagName, value)
      if (safeStyle) sanitized.style = safeStyle
      continue
    }

    if (URL_ATTRIBUTES.has(normalizedName) && !isSafeUrl(value)) {
      continue
    }

    sanitized[name] = value
  }

  return sanitized
}

const options: HTMLReactParserOptions = {
  replace(domNode) {
    if (!isElementNode(domNode)) {
      return undefined
    }

    const tagName = domNode.name.toLowerCase()
    if (BLOCKED_TAGS.has(tagName)) {
      return <></>
    }

    const props = attributesToProps(sanitizeAttributes(tagName, domNode.attribs))
    if (VOID_TAGS.has(tagName)) {
      return createElement(tagName, props)
    }

    const children = domToReact(domNode.children as DOMNode[], options)

    return createElement(tagName, props, children)
  }
}

function extractPlainText(domNode: DOMNode): string {
  if (domNode.nodeType === 3 && 'data' in domNode) {
    return domNode.data
  }

  if (!isElementNode(domNode)) {
    return ''
  }

  const tagName = domNode.name.toLowerCase()
  if (BLOCKED_TAGS.has(tagName)) {
    return ''
  }

  const text = (domNode.children as DOMNode[]).map(extractPlainText).join('')
  return PLAIN_TEXT_SEPARATOR_TAGS.has(tagName) ? `${text} ` : text
}

export function renderSanitizedRichHtml(html: string): ReactNode {
  return parse(html, options) as ReactNode
}

export function richHtmlToPlainText(html: string): string {
  return htmlToDOM(html).map(extractPlainText).join(' ').replace(/\s+/g, ' ').trim()
}
