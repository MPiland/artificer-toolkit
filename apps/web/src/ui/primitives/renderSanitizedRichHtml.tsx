import { createElement, type ReactNode } from 'react'
import parse, {
  attributesToProps,
  domToReact,
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

function isElementNode(domNode: DOMNode): domNode is Element {
  const candidate = domNode as Partial<Element>
  return typeof candidate.name === 'string'
    && typeof candidate.attribs === 'object'
    && candidate.attribs !== null
    && Array.isArray(candidate.children)
}

function isSafeUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return true
  if (trimmed.startsWith('#') || trimmed.startsWith('/') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true
  }

  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:'
  } catch {
    return !trimmed.includes(':')
  }
}

function sanitizeAttributes(attributes: Record<string, string | undefined>): Record<string, string> {
  const sanitized: Record<string, string> = {}

  for (const [name, value] of Object.entries(attributes)) {
    if (value === undefined) continue

    const normalizedName = name.toLowerCase()
    if (normalizedName.startsWith('on') || normalizedName === 'style' || normalizedName === 'srcdoc') {
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

    const props = attributesToProps(sanitizeAttributes(domNode.attribs))
    if (VOID_TAGS.has(tagName)) {
      return createElement(tagName, props)
    }

    const children = domToReact(domNode.children as DOMNode[], options)

    return createElement(tagName, props, children)
  }
}

export function renderSanitizedRichHtml(html: string): ReactNode {
  return parse(html, options) as ReactNode
}
