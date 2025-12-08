import HTMLDOMParser from '../htmlParser/html-to-dom'
import domToReact from './reactParser'
import type { HTMLReactParserOptions } from './types'
import type { DOMNode } from '../htmlParser/types'
import { ReactNode, isValidElement, cloneElement, ReactElement } from 'react'

export type { Comment, Element, ProcessingInstruction, Text } from 'domhandler'

export type { HTMLReactParserOptions, DOMNode }

type Content = string | ReactNode | (string | ReactNode)[]

/**
 * Converts HTML string to React elements.
 *
 * @param content - Content to be parsed.
 * @param options - Parser options.
 * @returns - React element(s), empty array, or string.
 */
export default function HTMLReactParser(
  content: Content | undefined,
  options: HTMLReactParserOptions = {},
  index?: number
): ReactNode[] {
  if (!content) {
    return []
  }

  if (typeof content === 'string') {
    const nodes: DOMNode[] = HTMLDOMParser(content)
    let reactElements: ReactNode[] = []

    if (typeof options.replace === 'function') {
      reactElements = nodes.map((node, nIndex) => {
        const replacedNode = options.replace!(node, nIndex)

        if (replacedNode === false || replacedNode === null || replacedNode === undefined) {
          return null // Skip the node
        } else if (isValidElement(replacedNode)) {
          if (typeof (replacedNode as ReactElement<any>).props.children === 'object') {
            const childrenArray = createChildArray((replacedNode as ReactElement<any>).props.children)
            return cloneElement(
              replacedNode as ReactElement<any>,
              (replacedNode as ReactElement<any>).props,
              ...processChildren(childrenArray, options)
            )
          }
          return replacedNode
        } else {
          // Assume it's a DOMNode and process it
          return domToReact({ nodes: [replacedNode as DOMNode], nodeIndex: nIndex })
        }
      })
    } else {
      // Call domToReact only if options.replace is not defined or not a function
      reactElements = domToReact({ nodes, nodeIndex: index })
    }

    if (typeof options.transform === 'function') {
      reactElements = reactElements.map((element, index) => {
        return options.transform!(element, index)
      })
    }

    return reactElements
  } else if (isValidElement(content)) {
    // If it's a React element, recursively process its children
    // Create children into an array first before processing
    const typedContent = content as ReactElement<{ children: ReactNode }>
    const childrenArray = createChildArray(typedContent.props.children)
    return [cloneElement(typedContent, typedContent.props, ...processChildren(childrenArray, options))]
  } else if (Array.isArray(content)) {
    return content.flatMap((child) => HTMLReactParser(child, options))
  }

  return [content]
}

// Recursive function to process children
function processChildren(children: (ReactNode | DOMNode)[], options: HTMLReactParserOptions = {}): ReactNode[] {
  const processedChildren = children.map((child, index) => {
    if (typeof child === 'string') {
      return HTMLReactParser(child, options, index)
    } else if (isValidElement(child)) {
      const typedChild = child as ReactElement<{ children: ReactNode }>
      const childrenArray = createChildArray(typedChild.props.children)
      return cloneElement(typedChild, typedChild.props, ...processChildren(childrenArray, options))
    } else if (child && typeof child === 'object' && 'type' in child) {
      return domToReact({ nodes: [child as DOMNode], nodeIndex: index })
    }
    return child
  })

  return processedChildren.filter((child): child is NonNullable<typeof child> => child !== undefined && child !== null)
}

// Create child array
function createChildArray(child: ReactNode | DOMNode | ReactNode[] | DOMNode[]): (DOMNode | ReactNode)[] {
  return Array.isArray(child) ? child : [child]
}
