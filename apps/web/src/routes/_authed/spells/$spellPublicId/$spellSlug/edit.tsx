import { createFileRoute } from '@tanstack/react-router'
import { getSpellReferenceData } from '#app/data/spells/referenceData'
import { createServerApi } from '#app/lib/api'
import { SpellEditPage } from '#domains/spells'

export const Route = createFileRoute('/_authed/spells/$spellPublicId/$spellSlug/edit')({
  loader: ({ context }) => context.queryClient.ensureQueryData(getSpellReferenceData(createServerApi())),
  component: () => <SpellEditPage />
})
