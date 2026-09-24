import { useCallback, useState } from 'react'
import { useConvex } from 'convex/react'
import { notifications } from '@mantine/notifications'
import type { AuthoredSubjectKindDto } from '@artificer-toolkit/schema/api/content'
import { exportAuthoredContent } from '#app/data/imports/importClient'
import type { AuthoredDetailAction } from './AuthoredDetail.types'

export function useAuthoredExportAction({
  canExport,
  id,
  label,
  subjectKind,
  view
}: {
  canExport: boolean
  id: string
  label: string
  subjectKind: AuthoredSubjectKindDto
  view: 'active' | 'draft'
}): AuthoredDetailAction | null {
  const client = useConvex()
  const [loading, setLoading] = useState(false)

  const onExport = useCallback(async () => {
    setLoading(true)
    try {
      const content = await exportAuthoredContent({ id, subjectKind, view }, client)
      const blob = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' })
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.download = `${toFileName(label)}.artificer.json`
      anchor.href = href
      anchor.click()
      URL.revokeObjectURL(href)
    } catch {
      notifications.show({ color: 'red', message: 'Could not export that item yet.' })
    } finally {
      setLoading(false)
    }
  }, [client, id, label, subjectKind, view])

  if (!canExport) return null

  return {
    label: 'Export JSON',
    loading,
    onClick: () => void onExport(),
    tone: 'secondary'
  }
}

function toFileName(label: string): string {
  const name = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
  return name || 'artificer-content'
}
