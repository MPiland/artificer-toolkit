import { ReactNode, useEffect, createElement, CSSProperties, use, RefObject, useMemo, memo } from 'react'
import {
  card,
  card_header_title,
  card_header_title_container,
  card_header,
  card_content,
  card_content_wrapper,
  card_footer,
  card_header_icon,
  card_content_truncated,
  card_content_collapsed_height,
} from './Card.css'
import { MdDelete, MdExpandMore } from 'react-icons/md'
import clsx from 'clsx'
import useMeasure from 'react-use-measure'
import HTMLReactParser from '../../utils/reactParser/dom-to-react'
import { Text, Element } from '../../utils/reactParser/dom-to-react'
import { assignInlineVars } from '@vanilla-extract/dynamic'
import Button from '../Button/Button'
import { CardContext } from './CardContext'
import CardProvider from './CardProvider'

const Header = ({
  title,
  remove,
  titleLeft,
  titleRight,
  collapsible = false,
  startCollapsed = true,
  collapsed: collapsedProp,
  onCollapse,
}: {
  title: string
  open?: (arg: any) => void
  remove?: (arg: any) => void
  edit?: (arg: any) => void
  titleLeft?: ReactNode
  titleRight?: ReactNode
  collapsible?: boolean
  startCollapsed?: boolean
  collapsed?: boolean
  onCollapse?: () => void
}) => {
  const { collapsed, setCollapsed } = use(CardContext)

  useEffect(() => {
    if (!startCollapsed) {
      setCollapsed(false)
    }
    if (collapsedProp != null && collapsed !== collapsedProp) {
      setCollapsed(collapsedProp)
    }
  }, [startCollapsed, setCollapsed, collapsedProp, collapsed])

  return (
    <div
      className={clsx(card_header, { ['collapsible']: collapsible })}
      onClick={() => {
        if (collapsible) {
          setCollapsed(!collapsed)
          if (onCollapse && collapsedProp != null) {
            onCollapse()
          }
        }
      }}
    >
      <div className={card_header_title_container}>
        {titleLeft && <div>{titleLeft}</div>}
        <h4 className={card_header_title}>{title}</h4>
        {titleRight && <div>{titleRight}</div>}
        {remove && (
          <Button style='unstyled' height='xxs' onClick={remove}>
            <MdDelete />
          </Button>
        )}
      </div>
      {collapsible && <MdExpandMore className={clsx(card_header_icon, { ['collapsed']: collapsed })} />}
    </div>
  )
}

const Content = ({ children }: { children?: ReactNode | string }) => {
  const { collapsed } = use(CardContext)

  const [measureRef, { height }] = useMeasure()

  const parsedContent = useMemo(() => {
    return HTMLReactParser(children, {
      replace: (node, index) => {
        if (collapsed) {
          if (index === 0 && node && 'children' in node) {
            const tagName = node.name || 'p'
            const data: string =
              node.name === 'blockquote' ?
                ((node.children[0] as Element).children[0] as Text).data
              : (node.children[0] as Text).data

            return createElement(tagName, { key: index, className: card_content_truncated }, data)
          }
        } else {
          return node
        }
      },
    })
  }, [children, collapsed])

  return (
    <div className={card_content_wrapper}>
      <div
        style={assignInlineVars({
          [card_content_collapsed_height]: `${height}px`,
        })}
        className={clsx(card_content, { ['collapsed']: collapsed })}
      >
        <div ref={measureRef} className='heightdiv'>
          {parsedContent}
        </div>
      </div>
    </div>
  )
}

const Footer = ({ children }: { children: ReactNode }) => {
  return <div className={card_footer}>{children}</div>
}

type CardComponent = {
  children: ReactNode
  className?: string
  style?: CSSProperties
  itemId: string
  ref: RefObject<HTMLDivElement | null>
}

const CardBase = ({ children, className, style, itemId, ref }: CardComponent) => {
  return (
    <CardProvider itemId={itemId}>
      <div className={clsx(card, className)} ref={ref} style={style}>
        {children}
      </div>
    </CardProvider>
  )
}

const MemoizedCard = memo(CardBase)

const Card = Object.assign(MemoizedCard, {
  Header,
  Content,
  Footer,
})

Card.displayName = 'Card'

Card.Header = Header
Card.Content = Content
Card.Footer = Footer

export default Card
