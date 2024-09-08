import { createElement, Fragment } from 'react'
import type { ReactNode } from 'react'
import type { DOMNode, Element, Text } from '../htmlParser/types'

import attributesToProps from './attributes-to-props'
import type { Props } from './attributes-to-props'
import { PRESERVE_CUSTOM_ATTRIBUTES, canTextBeChildOfNode, isCustomComponent, setStyleProp } from './utilities'

/**
 * Converts DOM nodes to JSX element(s).
 *
 * @param nodes - DOM nodes.
 * @param options - Options.
 * @returns - String or JSX element(s).
 */
export default function domToReact({ nodes, nodeIndex }: { nodes: DOMNode[]; nodeIndex?: number }): ReactNode[] {
  const reactElements: ReactNode[] = []

  const nodesLength = nodes.length

  for (let index = 0; index < nodesLength; index++) {
    const node = nodes[index]

    if (node && typeof node === 'object') {
      if (node.type === 'text') {
        const isWhitespace = !node.data.trim().length

        // We have a whitespace node that can't be nested in its parent
        // so skip it
        if (isWhitespace && node.parent && !canTextBeChildOfNode(node.parent as Element)) {
          continue
        }

        // We have a text node that's not whitespace and it can be nested
        // in its parent so add it to the results
        reactElements.push(createElement(Fragment, { key: nodeIndex || index }, node.data))
        continue
      }

      const element = node as Element
      let props: Props = {}

      if (skipAttributesToProps(element)) {
        setStyleProp(element.attribs.style, element.attribs)
        props = element.attribs
      } else if (element.attribs) {
        props = attributesToProps(element.attribs, element.name)
      }

      let children: ReactNode[] | undefined

      switch (node.type) {
        case 'script':
        case 'style':
          // prevent text in <script> or <style> from being escaped
          // https://react.dev/reference/react-dom/components/common#dangerously-setting-the-inner-html
          if (node.children[0]) {
            props.dangerouslySetInnerHTML = {
              __html: (node.children[0] as Text).data,
            }
          }
          break

        case 'tag':
          // setting textarea value in children is an antipattern in React
          // https://react.dev/reference/react-dom/components/textarea#caveats
          if (node.name === 'textarea' && node.children[0]) {
            props.defaultValue = (node.children[0] as Text).data
          } else if (node.children && node.children.length) {
            // continue recursion of creating React elements (if applicable)
            children = domToReact({ nodes: node.children as Text[] })
          }
          break

        // skip all other cases (e.g., comment)
        default:
          continue
      }

      reactElements.push(createElement(node.name, { ...props, key: nodeIndex || index }, children))
    }
  }

  return reactElements
}

/**
 * Determines whether DOM element attributes should be transformed to props.
 * Web Components should not have their attributes transformed except for `style`.
 *
 * @param node - Element node.
 * @returns - Whether the node attributes should be converted to props.
 */
function skipAttributesToProps(node: Element): boolean {
  return PRESERVE_CUSTOM_ATTRIBUTES && node.type === 'tag' && isCustomComponent(node.name, node.attribs)
}
