import { ReactNode, useEffect, createElement } from 'react'
import {
  card,
  card_header_title,
  card_header_title_container,
  card_header,
  card_content,
  card_content_wrapper,
  card_footer,
  card_header_icon,
  card_header_icon_container,
  card_content_truncated,
} from './Card.css'
import { MdDelete, MdExpandMore, MdModeEdit } from 'react-icons/md'
import Box from '../Box/Box'
import clsx from 'clsx'
import useMeasure from 'react-use-measure'
import HTMLReactParser from '../../utils/reactParser/dom-to-react'
import CardProvider from './CardProvider'
import { useCard } from '../../hooks/useCard'
import { Text, Element } from '../../utils/reactParser/dom-to-react'
import { assignInlineVars } from '@vanilla-extract/dynamic'
import Button from '../Button/Button'

const Header = ({
  title,
  editable,
  removable,
  leftSide,
  collapsible = false,
  startCollapsed = true,
}: {
  title: string
  editable?: (arg: any) => void
  removable?: (arg: any) => void
  leftSide?: ReactNode
  collapsible?: boolean
  startCollapsed?: boolean
}) => {
  const { collapsed, setCollapsed } = useCard()

  useEffect(() => {
    if (!startCollapsed) {
      setCollapsed(false)
    }
  }, [startCollapsed, setCollapsed])

  return (
    <div className={card_header} onClick={() => setCollapsed(!collapsed)}>
      <div className={card_header_title_container}>
        {leftSide && <div>{leftSide}</div>}
        <h4 className={card_header_title}>{title}</h4>
        {editable && (
          <Button style='unstyled' onClick={editable}>
            <MdModeEdit />
          </Button>
        )}
        {removable && (
          <Button style='unstyled' onClick={removable}>
            <MdDelete />
          </Button>
        )}
      </div>
      {collapsible && (
        <div className={card_header_icon_container}>
          <MdExpandMore className={clsx(card_header_icon, { ['collapsed']: collapsed })} />
        </div>
      )}
    </div>
  )
}

const Content = ({ children }: { children?: ReactNode | string }) => {
  const { collapsed } = useCard()

  const [measureRef, { height }] = useMeasure()

  return (
    <div className={card_content_wrapper}>
      <div
        style={{
          transition: 'height .3s ease-in-out',
          ...assignInlineVars({
            height: collapsed ? '1rem' : `${height}px`,
          }),
        }}
        className={clsx(card_content, { ['collapsed']: collapsed })}
      >
        <div ref={measureRef} className='heightdiv'>
          {HTMLReactParser(children, {
            replace: (node, index) => {
              if (collapsed) {
                if (index === 0 && node && 'children' in node) {
                  const TagName = node.name || 'p'
                  const data: string =
                    node.name === 'blockquote'
                      ? ((node.children[0] as Element).children[0] as Text).data
                      : (node.children[0] as Text).data

                  return createElement(
                    TagName, // Use the tag name directly
                    { key: index, className: card_content_truncated },
                    data
                  )
                }
              } else {
                return node
              }
            },
          })}
        </div>
      </div>
    </div>
  )
}

const Footer = ({ children }: { children: ReactNode }) => {
  return <div className={card_footer}>{children}</div>
}

const Card = ({ children }: { children: ReactNode }) => {
  return (
    <CardProvider>
      <Box as='div' className={card}>
        {children}
      </Box>
    </CardProvider>
  )
}

Card.Header = Header
Card.Content = Content
Card.Footer = Footer

export default Card
