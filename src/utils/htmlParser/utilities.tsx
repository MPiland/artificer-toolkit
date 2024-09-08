import { Comment, Element, ProcessingInstruction, Text } from 'domhandler'

import { CASE_SENSITIVE_TAG_NAMES_MAP } from './constants'
import type { DOMNode } from './types'

/**
 * Gets case-sensitive tag name.
 *
 * @param tagName - Tag name in lowercase.
 * @returns - Case-sensitive tag name.
 */
function getCaseSensitiveTagName(tagName: string): string | undefined {
  return CASE_SENSITIVE_TAG_NAMES_MAP[tagName]
}

/**
 * Formats DOM attributes to a hash map.
 *
 * @param attributes - List of attributes.
 * @returns - Map of attribute name to value.
 */
export function formatAttributes(attributes: NamedNodeMap) {
  const map: Record<string, string> = {}
  let index = 0
  const attributesLength = attributes.length

  // `NamedNodeMap` is array-like
  for (; index < attributesLength; index++) {
    const attribute = attributes[index]
    map[attribute.name] = attribute.value
  }

  return map
}

/**
 * Creates a deep clone of the node sent to prevent infinite nesting of previous and next nodes
 *
 * @param node - Node to append to current.prev or current.next property
 * @returns - Deep clone of node
 */

function deepCopyNode(node: DOMNode) {
  if (node === null || typeof node !== 'object') {
    return node // Primitive value, just return
  }

  if (node instanceof Element) {
    const newNode = new Element(node.name, { ...node.attribs }) // Shallow copy attribs
    newNode.children = node.children // Recursive deep copy for children
    return newNode
  }

  // Add similar logic for other node types (Text, Comment, etc.)

  return node // Default, shouldn't be reached for DOM nodes
}

/**
 * Corrects the tag name if it is case-sensitive (SVG).
 * Otherwise, returns the lowercase tag name (HTML).
 *
 * @param tagName - Lowercase tag name.
 * @returns - Formatted tag name.
 */
function formatTagName(tagName: string): string {
  tagName = tagName.toLowerCase()
  const caseSensitiveTagName = getCaseSensitiveTagName(tagName)

  if (caseSensitiveTagName) {
    return caseSensitiveTagName
  }

  return tagName
}

/**
 * Transforms DOM nodes to `domhandler` nodes.
 *
 * @param nodes - DOM nodes.
 * @param parent - Parent node.
 * @param directive - Directive.
 * @returns - Nodes.
 */
export function formatDOM(nodes: NodeList, parent: DOMNode | null = null, directive?: string): DOMNode[] {
  const domNodes = []
  let current: Element | Text | Comment | ProcessingInstruction

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index]

    // set the node data given the type
    switch (node.nodeType) {
      case 1: {
        const tagName = formatTagName(node.nodeName)

        // script, style, or tag
        current = new Element(tagName, formatAttributes((node as HTMLElement).attributes))

        current.children = formatDOM(
          // template children are on content
          tagName === 'template' ? (node as HTMLTemplateElement).content.childNodes : node.childNodes,
          current
        )

        break
      }

      case 3:
        current = new Text(node.nodeValue!)
        break

      case 8:
        current = new Comment(node.nodeValue!)
        break

      default:
        continue
    }

    // set properties for current node
    current.parent = parent as Element

    if (index > 0) {
      current.prev = deepCopyNode(domNodes[index - 1])
    }

    domNodes.push(current)

    if (index >= 1) {
      domNodes[index - 1].next = deepCopyNode(current)
    }
  }

  if (directive) {
    current = new ProcessingInstruction(directive.substring(0, directive.indexOf(' ')).toLowerCase(), directive)

    current.next = domNodes[0] || null
    current.parent = parent as Element
    domNodes.unshift(current)

    if (domNodes[1]) {
      domNodes[1].prev = deepCopyNode(domNodes[0])
    }
  }

  return domNodes
}
