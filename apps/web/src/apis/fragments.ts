export const SUBFEATURE_EXPERTISE = `
  id,
  subtypeId: subtype_id,
  attributeIds: subfeature_expertise_attributes(attribute_id),
  selectionCount: selection_count,
  
`

export const SUBFEATURE_SELECT = `
  modifiers:subfeature_modifiers(*),
  proficiencies:subfeature_proficiencies(*),
  expertise:subfeature_expertise(*),
  senses:subfeature_senses(*),
  spells:subfeature_spells(*)
` as const

export const FEATURE_SELECT = `
  *,
 ${SUBFEATURE_SELECT},
  options:subfeature_options(*,
    ${SUBFEATURE_SELECT}
  )
`
