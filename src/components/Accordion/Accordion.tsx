import { ReactNode, useRef, memo } from 'react'
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
  itemId: string
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
  dataArray: any[]
  children: ReactNode
  setState?: (arg: ReducerActionType) => void
  name?: string
  disableSort?: boolean
}

const Container = memo(({ children, itemId }: ContainerProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: itemId,
    disabled: !itemId,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={clsx(accordion_container, { ['dragging']: isDragging })}
    >
      {children}
    </div>
  )
})

Container.displayName = 'Container'

const Header = ({
  children,
  handleClick,
  active,
  handleRemove,
  handleEdit,
}: HeaderProps) => {
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

const Content = ({ children, active = false }: ContentProps) => {
  const content = useRef<HTMLDivElement | null>(null)

  return (
    <div
      className={clsx(accordion_body, { ['collapsed']: !active })}
      ref={content}
    >
      <div className={clsx(accordion_content, { ['collapsed']: !active })}>
        {children}
      </div>
    </div>
  )
}

const Footer = ({ children }: FooterProps) => {
  return <div className={accordion_footer}>{children}</div>
}

const Accordion = ({
  children,
  dataArray,
  setState,
  name,
  disableSort = false,
}: AccordionProps) => {
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
    const { active, over } = event
    if (active.id === over?.id) {
      return
    }

    const oldArray = JSON.parse(JSON.stringify(dataArray))

    const oldIndex = Number(active.id)
    const newIndex = Number(over?.id)
    const newArray = arrayMove(oldArray, oldIndex, newIndex)
    if (setState) {
      setState({ target: { name: name, value: newArray } })
    }
  }

  return (
    <div className={accordion}>
      <DndContext
        collisionDetection={closestCenter}
        sensors={sensor}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={dataArray.map((_, dataIndex) => String(dataIndex))}
          disabled={disableSort}
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
