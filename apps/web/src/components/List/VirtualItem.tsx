import { use, memo, useMemo } from 'react'
import Collapse from '~components/Collapse/Collapse'
import type { ListItemType, MetaDataType, Character } from '~types'
import { Link, useNavigate } from '@tanstack/react-router'
import { Pencil, ExternalLink } from 'lucide-react'
import { useFormStore } from '~store'
import { ListNavigationResult, useMetaData } from '~hooks'
import { FooterConfig } from './List.types'
import { footer_group, footer_item, sub as list_sub, item_link_icon, item_link } from './List.css'
import { ModalContext } from '~components/Modal'
import { UnstyledButton } from '@mantine/core'
import type { UseMutationResult } from '@tanstack/react-query'

type VirtualItemProps<K extends MetaDataType> = {
  view: 'grid' | 'list'
  item: ListItemType
  routeNav: ListNavigationResult
  footerConfigs?: FooterConfig<K>[]
  metaData?: K
  useDeleteItem: () => UseMutationResult<string, Error, string, unknown>
  setErrorMessage: (arg: string) => void
  sm: boolean
  sub?: boolean
}

const VirtualItem = <T extends MetaDataType>({
  view,
  item,
  routeNav,
  footerConfigs,
  sub = false,
  metaData,
  useDeleteItem,
  sm,
  setErrorMessage,
}: VirtualItemProps<T>) => {
  const navigate = useNavigate()
  const formStore = useFormStore((state) => state)
  const { getSourceText } = useMetaData({ metaData })
  const { showModal } = use(ModalContext)
  const { mutateAsync: deleteItem } = useDeleteItem()

  const itemNav = routeNav.forItem(item.id, item.label)

  const handleEdit = () => {
    formStore.reset()
    navigate({ to: itemNav.edit.to, params: itemNav.edit.params, mask: itemNav.edit.mask })
  }

  const handleDeleteConfirmed = async (id: ListItemType['id']) => {
    try {
      await deleteItem(id)
    } catch (err) {
      if (typeof err === 'object' && err !== null && 'data' in err) {
        if (typeof err.data === 'object' && err.data !== null && 'message' in err.data) {
          return setErrorMessage(err.data.message as string)
        }
      }
      return setErrorMessage('An unknown error occurred')
    }
  }

  const handleDelete = (label: ListItemType['label'], id: ListItemType['id']) => {
    showModal({
      type: 'delete',
      props: {
        label: label,
        onDelete: () => handleDeleteConfirmed(id),
      },
    })
  }

  const footerText = useMemo(() => {
    return footerConfigs?.map((footer, fIndex) => {
      const text = getSourceText({ footer, state: item })
      if (((footer.display === view && !sm) || !footer.display) && text !== '---') {
        return (
          <div className={footer_item} key={fIndex}>
            {footer.icon ?? footer.value}
            {text}
          </div>
        )
      }
    })
  }, [footerConfigs, item, sm, view, getSourceText])

  return (
    <Collapse
      disabled={view === 'grid' && true}
      className={sub ? list_sub : ''}
      props={{
        trigger: {
          title: `${item.label} ${(item as Exclude<ListItemType, Character>).ownerId === 'master' ? '(M)' : ''}`,
          titleRight: (
            <>
              <Link {...itemNav.view} onClick={(e) => e.stopPropagation()} className={item_link}>
                <ExternalLink className={item_link_icon} />
              </Link>
              {(item as Exclude<ListItemType, Character>).ownerId !== 'master' && (
                <UnstyledButton
                  onClick={async (e) => {
                    e.stopPropagation()
                    handleEdit()
                  }}
                  className={item_link}
                >
                  <Pencil className={item_link_icon} />
                </UnstyledButton>
              )}
            </>
          ),
          removeFn:
            (item as Exclude<ListItemType, Character>).ownerId !== 'master' ?
              () => handleDelete(item.label, item.id)
            : undefined,
          titleLeft: 'level' in item && (item.level || item.level === 0) && `(${item.level})`,
        },
        footer:
          footerConfigs ?
            {
              children: <div className={footer_group}>{footerText}</div>,
            }
          : undefined,
      }}
    >
      {item.desc}
    </Collapse>
  )
}

const MemoizedVirtualItem = memo(VirtualItem) as typeof VirtualItem

export default MemoizedVirtualItem
