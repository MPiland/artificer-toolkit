import { FC, ReactNode, useRef } from 'react'
import { TbSquarePlus, TbSquareMinus } from 'react-icons/tb'
import {
  accordion,
  accordion_close_button,
  accordion_container,
  accordion_content,
  accordion_header,
  accordion_header_button,
} from './Accordion.css'
import Group from '../Group/Group'
import clsx from 'clsx'
import { sprinkles } from '../../css/sprinkles.css'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import Button from '../Button/Button'
import { TbX } from 'react-icons/tb'

interface ContainerProps {
  children: ReactNode
}

interface HeaderProps {
  children: ReactNode
  onClick: () => void
  active: boolean
}

interface ContentProps {
  children: ReactNode
  active: boolean
}

interface AccordionProps {
  children: ReactNode
}

const Container: FC<ContainerProps> = ({ children }) => {
  return <div className={accordion_container}>{children}</div>
}

const Header: FC<HeaderProps> = ({ children, onClick, active }) => {
  return (
    <div
      className={clsx(accordion_header, { ['collapsed']: !active })}
      onClick={onClick}
    >
      <Group
        spaceVariant='spaceBetween'
        className={sprinkles({ width: 'full' })}
      >
        <Group>
          <Button
            variant='unstyled'
            type='button'
            className={accordion_close_button}
          >
            <TbX />
          </Button>
          <h2>{children}</h2>
        </Group>
        <span className={accordion_header_button}>
          {active ? <TbSquareMinus /> : <TbSquarePlus />}
        </span>
      </Group>
    </div>
  )
}

const Content: FC<ContentProps> = ({ children, active = false }) => {
  const content = useRef<HTMLDivElement | null>(null)

  useGSAP(() => {
    if (active && content.current) {
      gsap.to(content.current, {
        height: 'auto',
        duration: 0.3,
        ease: 'power1.inOut',
      })
    } else {
      gsap.to(content.current, {
        height: 0,
        duration: 0.3,
        ease: 'power1.inOut',
      })
    }
  })

  return (
    <div
      className={clsx(accordion_content, { ['collapsed']: !active })}
      ref={content}
    >
      {children}
    </div>
  )
}

const Accordion: FC<AccordionProps> & {
  Container: FC<ContainerProps>
  Header: FC<HeaderProps>
  Content: FC<ContentProps>
} = ({ children }) => {
  return <div className={accordion}>{children}</div>
}

Accordion.Container = Container
Accordion.Header = Header
Accordion.Content = Content

export default Accordion
