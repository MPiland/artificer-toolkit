import type { DomHandlerOptions } from 'domhandler'
import type { ParserOptions } from 'htmlparser2'
import type { JSX, ReactNode } from 'react'
import { DOMNode } from '../htmlParser/types'

export interface HTMLReactParserOptions {
  htmlparser2?: ParserOptions & DomHandlerOptions

  library?: {
    cloneElement: (element: JSX.Element, props?: object, ...children: any[]) => JSX.Element
    createElement: (type: any, props?: object, ...children: any[]) => JSX.Element
    isValidElement: (element: any) => boolean
    [key: string]: any
  }

  replace?: (node: DOMNode | null | undefined, index: number) => DOMNode | null | boolean | undefined | ReactNode
  transform?: (node: ReactNode, index: number) => ReactNode

  trim?: boolean
}
