import { ReactNode, useCallback, useRef, use } from 'react'
import { TbSquarePlus, TbSquareMinus, TbEdit } from 'react-icons/tb'
import {
  accordion,
  accordion_remove_button,
  accordion_wrapper,
  accordion_content_wrapper,
  accordion_header,
  accordion_header_icon,
  accordion_content,
  accordion_footer,
} from './Accordion.css'
import Group from '../Group/Group'
import clsx from 'clsx'
import { sprinkles } from '../../css/sprinkles.css'
import Button from '../Button/Button'
import { TbX } from 'react-icons/tb'
import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { DeepKeyOf, UpdateState } from '../../types/form'
import { AccordionContext, AccordionOptions } from './AccordionContext'

interface FooterProps {
  children: ReactNode
}

interface AccordionProps<T> {
  dataArray: any[]
  children: ReactNode
  onChange: (state: UpdateState<T>) => void
  name?: DeepKeyOf<T>
  disableSort?: boolean
}

const Wrapper = ({ children, itemId }: { children: ReactNode; itemId: string }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
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
      className={clsx(accordion_wrapper, { ['dragging']: isDragging }, 'collapsed')}
    >
      {children}
    </div>
  )
}

const Header = ({
  children,
  handleRemove,
  handleEdit,
}: {
  children: ReactNode
  handleRemove?: () => void
  handleEdit?: () => void
}) => {
  const { activeHeader, setActiveHeader } = use(AccordionContext)

  const headerRef = useRef<HTMLDivElement>(null)

  const handleClick = useCallback(() => {
    // Find all other headers and collapse them
    const headers = Array.from(document.getElementsByClassName(`${accordion_header}`))
    headers.forEach((headerOther) => {
      if (headerOther !== headerRef.current) {
        headerOther.parentElement?.classList.add('collapsed')
      } else {
        headerRef.current?.parentElement?.classList?.toggle('collapsed')
        if (activeHeader === headerRef.current) {
          setActiveHeader(null)
        } else {
          setActiveHeader(headerRef.current)
        }
      }
    })
  }, [activeHeader, setActiveHeader])

  return (
    <div className={clsx(accordion_header)} ref={headerRef} onClick={handleClick}>
      <Group justifyContentVariant='spaceBetween' className={sprinkles({ width: 'size-full' })}>
        <Group>
          {handleRemove && (
            <Button
              style='unstyled'
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
              style='unstyled'
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
        <span className={accordion_header_icon}>
          {activeHeader === headerRef.current ? <TbSquareMinus /> : <TbSquarePlus />}
        </span>
      </Group>
    </div>
  )
}

const Content = ({ children }: { children: ReactNode }) => {
  const wrapperRef = useRef<HTMLDivElement>(null)

  return (
    <div className={clsx(accordion_content_wrapper)} ref={wrapperRef}>
      <div className={clsx(accordion_content)}>{children}</div>
    </div>
  )
}

const Footer = ({ children }: FooterProps) => {
  return <div className={accordion_footer}>{children}</div>
}

const Accordion = <T,>({ children, dataArray, onChange, name, disableSort = false }: AccordionProps<T>) => {
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
    onChange({ type: 'update', path: name, value: newArray })
  }

  const accordionOptions = AccordionOptions()

  return (
    <AccordionContext value={accordionOptions}>
      <div className={accordion}>
        <DndContext collisionDetection={closestCenter} sensors={sensor} onDragEnd={onDragEnd}>
          <SortableContext
            items={dataArray.map((_, dataIndex) => String(dataIndex))}
            disabled={disableSort}
            strategy={verticalListSortingStrategy}
          >
            {children}
          </SortableContext>
        </DndContext>
      </div>
    </AccordionContext>
  )
}

Accordion.Wrapper = Wrapper
Accordion.Header = Header
Accordion.Content = Content
Accordion.Footer = Footer

export default Accordion
