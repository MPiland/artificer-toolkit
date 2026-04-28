import { createFileRoute } from '@tanstack/react-router'
import { AuthoredListPage, spellListFilters, spellListItems } from '#components/AuthoredList'

export const Route = createFileRoute('/_authed/spells/')({
  component: SpellsRoute
})

function SpellsRoute() {
  return (
    <AuthoredListPage
      title='Spells'
      summary='312 spells / 312 SRD / 0 homebrew'
      createLabel='Create Spell'
      items={spellListItems}
      filters={spellListFilters}
    />
  )
}
