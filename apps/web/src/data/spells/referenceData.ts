type SpellReferenceOption = {
  value: string
  label: string
}

export type SpellReferenceData = {
  systemId: string
  abilities: SpellReferenceOption[]
  magicSchools: SpellReferenceOption[]
  classes: SpellReferenceOption[]
  damageTypes: SpellReferenceOption[]
  conditionTypes: SpellReferenceOption[]
  skills: SpellReferenceOption[]
  speeds: SpellReferenceOption[]
  creatures: SpellReferenceOption[]
}

export type SpellDetailReferenceData = Pick<
  SpellReferenceData,
  'magicSchools' | 'classes' | 'damageTypes' | 'conditionTypes'
> & {
  abilities?: SpellReferenceOption[]
}
