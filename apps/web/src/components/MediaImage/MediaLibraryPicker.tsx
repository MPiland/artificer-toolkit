import { Button, Loader, UnstyledButton } from '@mantine/core'
import { Images } from 'lucide-react'
import type {
  MediaLibraryItemDto,
  MediaProfileClass
} from '@artificer-toolkit/schema/api/mediaAssets'
import { useMediaLibrary, useMediaLibraryImage } from '#app/data/media'
import * as styles from './MediaImage.css'

interface MediaLibraryPickerProps {
  profileClass: MediaProfileClass
  selectedAssetId: string | null
  onSelect: (item: MediaLibraryItemDto) => void
}

function MediaLibraryTile({
  item,
  selected,
  onSelect
}: {
  item: MediaLibraryItemDto
  selected: boolean
  onSelect: (item: MediaLibraryItemDto) => void
}) {
  const preview = useMediaLibraryImage(item.assetId, 'THUMBNAIL')
  return (
    <UnstyledButton
      aria-label={item.originalFileName}
      aria-pressed={selected}
      className={styles.libraryTile}
      type='button'
      onClick={() => onSelect(item)}
    >
      {preview.data ? (
        <img alt='' className={styles.image} src={preview.data.url} />
      ) : (
        <Loader aria-hidden='true' size='xs' />
      )}
    </UnstyledButton>
  )
}

/** Picks one of the viewer's own ready images to reuse instead of uploading it again. */
export function MediaLibraryPicker({
  profileClass,
  selectedAssetId,
  onSelect
}: MediaLibraryPickerProps) {
  const library = useMediaLibrary(profileClass)
  if (library.status === 'LoadingFirstPage')
    return <p className={styles.liveMessage}>Loading your images&hellip;</p>
  if (library.results.length === 0)
    return (
      <div className={styles.libraryEmpty}>
        <Images aria-hidden='true' size={20} />
        <p className={styles.liveMessage}>
          Images you upload are saved here, so you can reuse them without uploading again.
        </p>
      </div>
    )
  return (
    <div className={styles.library}>
      <div aria-label='My images' className={styles.libraryGrid} role='group'>
        {library.results.map((item) => (
          <MediaLibraryTile
            key={item.assetId}
            item={item}
            selected={item.assetId === selectedAssetId}
            onSelect={onSelect}
          />
        ))}
      </div>
      {library.status === 'CanLoadMore' ? (
        <Button type='button' variant='subtle' onClick={() => library.loadMore(12)}>
          Show more images
        </Button>
      ) : null}
    </div>
  )
}
