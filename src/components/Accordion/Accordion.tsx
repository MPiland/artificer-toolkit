import type { ReactNode, ComponentProps } from 'react'
import { PlusIcon, Pencil, Trash2 } from 'lucide-react'
import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import clsx from 'clsx'
import { item, header, content, header_icon, header_icon_collapse } from './Accordion.css'
import { sprinkles } from '@/css/sprinkles.css'
import { Accordion, Group } from '@mantine/core'

export type AccordionItemProps = {
  itemId: string
  className?: string
  children?: ReactNode
  value: string
} & ComponentProps<typeof Accordion.Item>

const AccordionItem = ({ className, itemId, children, value, ...props }: AccordionItemProps) => {
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
    <Accordion.Item
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      value={value}
      {...props}
      className={clsx(item, className, { ['dragging']: isDragging }, 'item')}
    >
      {children}
    </Accordion.Item>
  )
}

type TriggerProps = {
  children?: ReactNode
  className?: string
  removeFn?: () => void
  editFn?: () => void
  title?: string
} & ComponentProps<typeof Accordion.Control>

const AccordionTrigger = ({ className, children, removeFn, editFn, title, ...props }: TriggerProps) => {
  return (
    <Accordion.Control className={clsx(header, className)} {...props} onClick={(e) => e.stopPropagation()}>
      <Group justify='flex-start'>
        <Group>
          <h3 className={sprinkles({ my: 'space-x' })}>{title}</h3>
          {editFn && (
            <Pencil
              className={header_icon}
              onClick={(e) => {
                e.stopPropagation()
                editFn()
              }}
            />
          )}
        </Group>
        {removeFn && (
          <Trash2
            className={header_icon}
            onClick={(e) => {
              e.stopPropagation()
              removeFn()
            }}
          />
        )}
      </Group>
      {children}
    </Accordion.Control>
  )
}

type AccordionContentProps = {
  className?: string
  children?: ReactNode
} & ComponentProps<typeof Accordion.Panel>

const AccordionContent = ({ className, children, ...props }: AccordionContentProps) => {
  return (
    <Accordion.Panel className={className} {...props}>
      {children}
    </Accordion.Panel>
  )
}

export type AccordionProps = {
  dataArray: unknown[]
  onChange: (arg: unknown[]) => void
  disableSort?: boolean
  children?: ReactNode
} & Omit<ComponentProps<typeof Accordion>, 'onChange'>

const AccordionBase = Object.assign(
  ({ onChange, disableSort, dataArray, children, ...props }: AccordionProps) => {
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
      onChange(newArray)
    }

    return (
      <Accordion
        chevron={<PlusIcon className={clsx(header_icon)} />}
        classNames={{ chevron: header_icon_collapse, content: content }}
        {...props}
      >
        <DndContext collisionDetection={closestCenter} sensors={sensor} onDragEnd={onDragEnd}>
          <SortableContext
            items={dataArray.map((_, dataIndex) => String(dataIndex))}
            disabled={disableSort}
            strategy={verticalListSortingStrategy}
          >
            {children}
          </SortableContext>
        </DndContext>
      </Accordion>
    )
  },
  {
    Item: AccordionItem,
    Trigger: AccordionTrigger,
    Content: AccordionContent,
  }
)

export default AccordionBase
