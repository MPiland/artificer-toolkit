import type { ReactNode, ComponentProps } from 'react'
import { PlusIcon, Pencil, Trash2 } from 'lucide-react'
import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DeepKeyOf, OnChange } from '@/types'
import clsx from 'clsx'
import {
  accordion_item,
  accordion_header,
  accordion_content,
  accordion_header_icon,
  accordion_header_icon_collapse,
} from './Accordion.css'
import { sprinkles } from '@/css/sprinkles.css'
import { Accordion, Group } from '@mantine/core'

type AccordionItemProps = {
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
      className={clsx(accordion_item, className, { ['dragging']: isDragging }, 'item')}
    >
      {children}
    </Accordion.Item>
  )
}

type TriggerProps = {
  children: ReactNode
  className?: string
  removeFn?: () => void
  editFn?: () => void
} & ComponentProps<typeof Accordion.Control>

const AccordionTrigger = ({ className, children, removeFn, editFn, ...props }: TriggerProps) => {
  return (
    <Accordion.Control className={clsx(accordion_header, className)} {...props}>
      <Group justify='space -between' grow>
        <Group>
          <h3 className={sprinkles({ me: 'space-2' })}>{children}</h3>
          {editFn && (
            <Pencil
              className={accordion_header_icon}
              onClick={(e) => {
                e.stopPropagation()
                editFn()
              }}
            />
          )}
        </Group>
        {removeFn && (
          <Trash2
            className={accordion_header_icon}
            onClick={(e) => {
              e.stopPropagation()
              removeFn()
            }}
          />
        )}
      </Group>
    </Accordion.Control>
  )
}

type AccordionContentProps = {
  className?: string
  children?: ReactNode
} & ComponentProps<typeof Accordion.Panel>

const AccordionContent = ({ className, children, ...props }: AccordionContentProps) => {
  return (
    <Accordion.Panel className={clsx(accordion_content, className)} {...props}>
      {children}
    </Accordion.Panel>
  )
}

type AccordionProps<T> = {
  dataArray: any[]
  updateFn: {
    updateField: OnChange<T>['updateField']
  }
  name?: DeepKeyOf<T>
  disableSort?: boolean
  children?: ReactNode
} & ComponentProps<typeof Accordion>

const AccordionBase = Object.assign(
  <T,>({ name, updateFn, disableSort, dataArray, children, ...props }: AccordionProps<T>) => {
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
      if (name) {
        updateFn.updateField({ path: name, value: newArray })
      }
    }

    return (
      <Accordion
        chevron={<PlusIcon className={clsx(accordion_header_icon)} />}
        classNames={{ chevron: accordion_header_icon_collapse }}
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
