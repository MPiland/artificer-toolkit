import { createFileRoute, redirect } from '@tanstack/react-router'
import { LibraryImportPage } from '#app/imports/LibraryImportPage'

export const Route = createFileRoute('/_authed/library/import')({
  beforeLoad: ({ context }) => {
    if (!context.featureFlags?.libraryImportEnabled) throw redirect({ to: '/home' })
  },
  component: LibraryImportPage
})
