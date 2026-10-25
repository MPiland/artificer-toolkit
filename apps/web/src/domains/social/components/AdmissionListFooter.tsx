import { Button, Loader } from '@mantine/core'
import { admissionPageSize, type AdmissionPage } from '../hooks/admissionLists'

export function AdmissionListFooter({
  noun,
  pending,
  history
}: {
  noun: 'invitation' | 'application'
  pending: AdmissionPage<unknown>
  history: AdmissionPage<unknown>
}) {
  return (
    <>
      {pending.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => pending.loadMore(admissionPageSize)}>
          Load more pending {noun}s
        </Button>
      ) : null}
      {history.status === 'CanLoadMore' ? (
        <Button variant='subtle' onClick={() => history.loadMore(admissionPageSize)}>
          Load more {noun} history
        </Button>
      ) : null}
      {pending.status === 'LoadingMore' || history.status === 'LoadingMore' ? (
        <Loader aria-label={`Loading more ${noun}s`} size='sm' />
      ) : null}
    </>
  )
}
