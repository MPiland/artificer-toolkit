import { foundationVars } from '#css/foundations.css'

interface SpellSchoolAccent {
  color: string
  label: string
}

const spellSchoolAccents: Record<string, SpellSchoolAccent> = {
  abjuration: { color: foundationVars.color.school.abjuration, label: 'Abjuration school' },
  conjuration: { color: foundationVars.color.school.conjuration, label: 'Conjuration school' },
  divination: { color: foundationVars.color.school.divination, label: 'Divination school' },
  enchantment: { color: foundationVars.color.school.enchantment, label: 'Enchantment school' },
  evocation: { color: foundationVars.color.school.evocation, label: 'Evocation school' },
  illusion: { color: foundationVars.color.school.illusion, label: 'Illusion school' },
  necromancy: { color: foundationVars.color.school.necromancy, label: 'Necromancy school' },
  transmutation: { color: foundationVars.color.school.transmutation, label: 'Transmutation school' }
}

export function getSpellSchoolAccent(school: string | undefined): SpellSchoolAccent | undefined {
  if (!school) return undefined

  return spellSchoolAccents[school.trim().toLowerCase()]
}
