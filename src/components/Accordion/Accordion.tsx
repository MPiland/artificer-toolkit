import { FC, ReactNode, useRef, useState } from 'react'
import { TbSquarePlus, TbSquareMinus, TbEdit } from 'react-icons/tb'
import {
  accordion,
  accordion_remove_button,
  accordion_container,
  accordion_body,
  accordion_header,
  accordion_header_button,
  accordion_content,
  accordion_footer,
} from './Accordion.css'
import Group from '../Group/Group'
import clsx from 'clsx'
import { sprinkles } from '../../css/sprinkles.css'
import Button from '../Button/Button'
import { TbX } from 'react-icons/tb'
import {
  closestCenter,
  DndContext,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ReducerActionType } from '../../utils/types'

interface ContainerProps {
  children: ReactNode
  itemId?: number
}

interface HeaderProps {
  children: ReactNode
  handleClick: () => void
  handleRemove?: () => void
  handleEdit?: () => void
  active: boolean | null
}

interface ContentProps {
  children: ReactNode
  active: boolean
}

interface FooterProps {
  children: ReactNode
}

interface AccordionProps {
  dataArray?: any[]
  children: ReactNode
  setState?: (arg: ReducerActionType) => void
  name?: string
}

const Container: FC<ContainerProps> = ({ children, itemId }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: itemId as number,
    disabled: !itemId,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={accordion_container}
    >
      {children}
    </div>
  )
}

const Header: FC<HeaderProps> = ({
  children,
  handleClick,
  active,
  handleRemove,
  handleEdit,
}) => {
  return (
    <div
      className={clsx(accordion_header, { ['collapsed']: !active })}
      onClick={handleClick}
    >
      <Group
        justifyContentVariant='spaceBetween'
        className={sprinkles({ width: 'full' })}
      >
        <Group>
          {handleRemove && (
            <Button
              variant='unstyled'
              type='button'
              className={accordion_remove_button}
              onClick={(e) => {
                e.stopPropagation()
                handleRemove()
              }}
            >
              <TbX />
            </Button>
          )}
          {handleEdit && (
            <Button
              variant='unstyled'
              type='button'
              className={accordion_remove_button}
              onClick={(e) => {
                e.stopPropagation()
                handleEdit()
              }}
            >
              <TbEdit />
            </Button>
          )}
          <h3>{children}</h3>
        </Group>
        {active !== null && (
          <span className={accordion_header_button}>
            {active ? <TbSquareMinus /> : <TbSquarePlus />}
          </span>
        )}
      </Group>
    </div>
  )
}

const Content: FC<ContentProps> = ({ children, active = false }) => {
  const content = useRef<HTMLDivElement | null>(null)

  return (
    <div
      className={clsx(accordion_body, { ['collapsed']: !active })}
      ref={content}
    >
      <div className={accordion_content}>{children}</div>
    </div>
  )
}

const Footer: FC<FooterProps> = ({ children }) => {
  return <div className={accordion_footer}>{children}</div>
}

const Accordion: FC<AccordionProps> & {
  Container: FC<ContainerProps>
  Header: FC<HeaderProps>
  Content: FC<ContentProps>
  Footer: FC<FooterProps>
} = ({ children, dataArray, setState, name }) => {
  const sensor = useSensors(
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 0,
      },
    }),
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: 300,
        tolerance: 0,
      },
    })
  )

  const onDragEnd = (event: DragEndEvent) => {
    console.log('dragging ended')
    const { active, over } = event
    if (active.id === over?.id) {
      console.log('same id')
      return
    }

    const oldIndex = (dataArray as []).findIndex(
      (item: any) => item.id === active.id
    )
    const newIndex = (dataArray as []).findIndex(
      (item: any) => item.id === over?.id
    )
    const newArray = arrayMove(dataArray as any[], oldIndex, newIndex)
    setState && setState({ target: { name: name, value: newArray } })
  }

  return (
    <div className={accordion}>
      <DndContext
        collisionDetection={closestCenter}
        sensors={sensor}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={dataArray as any[]}
          strategy={verticalListSortingStrategy}
        >
          {children}
        </SortableContext>
      </DndContext>
    </div>
  )
}

Accordion.Container = Container
Accordion.Header = Header
Accordion.Content = Content
Accordion.Footer = Footer

export default Accordion
