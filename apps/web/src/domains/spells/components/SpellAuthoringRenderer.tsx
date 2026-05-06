import { createAuthoringFormRenderer } from '#forms'
import { createEmptySpell } from '../spellAuthoring.utils'

const spellRendererDefaults = createEmptySpell({ systemId: '' })

export const SpellAuthoringRenderer = createAuthoringFormRenderer({
  defaultValues: spellRendererDefaults
})
