import { ComponentProps } from 'react'
import { Root, Item, Header, Trigger, Content } from '@radix-ui/react-accordion'
import { ChevronDownIcon } from 'lucide-react'
import { closestCenter, DndContext, MouseSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { DeepKeyOf, OnChange } from '@/types'
import { cn } from '@/components/lib/utils'

interface AccordionProps<T> {
  dataArray: any[]
  onChange: {
    updateField: OnChange<T>['updateField']
  }
  name?: DeepKeyOf<T>
  disableSort?: boolean
}

const Accordion = <T,>({
  name,
  onChange,
  disableSort,
  dataArray,
  ...props
}: AccordionProps<T> & ComponentProps<typeof Root>) => {
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
      onChange.updateField({ path: name, value: newArray })
    }
  }

  return (
    <Root data-slot='accordion' {...props}>
      <DndContext collisionDetection={closestCenter} sensors={sensor} onDragEnd={onDragEnd}>
        <SortableContext
          items={dataArray.map((_, dataIndex) => String(dataIndex))}
          disabled={disableSort}
          strategy={verticalListSortingStrategy}
        >
          {props.children}
        </SortableContext>
      </DndContext>
    </Root>
  )
}

function AccordionItem({ className, itemId, ...props }: ComponentProps<typeof Item> & { itemId: string }) {
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
    <Item
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      data-slot='accordion-item'
      className={cn('border-b last:border-b-0', className, { ['dragging']: isDragging })}
      {...props}
    />
  )
}

function AccordionTrigger({ className, children, ...props }: ComponentProps<typeof Trigger>) {
  return (
    <Header className='flex'>
      <Trigger
        data-slot='accordion-trigger'
        className={cn(
          'focus-visible:border-ring focus-visible:ring-ring/50 flex flex-1 items-start justify-between gap-4 rounded-md py-4 text-left text-sm font-medium transition-all outline-none hover:underline focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 [&[data-state=open]>svg]:rotate-180',
          className
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon className='text-muted-foreground pointer-events-none size-4 shrink-0 translate-y-0.5 transition-transform duration-200' />
      </Trigger>
    </Header>
  )
}

function AccordionContent({ className, children, ...props }: ComponentProps<typeof Content>) {
  return (
    <Content
      data-slot='accordion-content'
      className='data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down overflow-hidden text-sm'
      {...props}
    >
      <div className={cn('pt-0 pb-4', className)}>{children}</div>
    </Content>
  )
}

Accordion.Item = AccordionItem
Accordion.Trigger = AccordionTrigger
Accordion.Content = AccordionContent
export default Accordion
