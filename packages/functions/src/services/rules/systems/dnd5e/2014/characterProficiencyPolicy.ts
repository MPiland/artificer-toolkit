const manualProficiencies =
  'proficiencyFacts == null ? [] : map(keys(proficiencyFacts.manualAdditions) as sequence, { kind: proficiencyFacts.manualAdditions[sequence].proficiencyKind == "LANGUAGE" ? "LANGUAGE" : "EQUIPMENT", subjectId: proficiencyFacts.manualAdditions[sequence].targetId, matchId: proficiencyFacts.manualAdditions[sequence].targetId, scaling: "FULL", source: proficiencyFacts.manualAdditions[sequence].source, acceptedProficiencyIndex: len(grantFold.proficiencies) + sequence })'

export const dnd5e2014CharacterProficiencyPolicyExpressions = [
  {
    id: 'resolved-proficiencies',
    key: 'resolvedProficiencies',
    value: `merge([grantFold.proficiencies, ${manualProficiencies}])`
  }
]

export const dnd5e2014CharacterProficiencyPolicyOutputExpression = {
  id: 'proficiencies',
  key: 'proficiencies',
  value:
    'map(resolvedProficiencies as proficiency, merge([{ kind: proficiency.kind, subjectId: proficiency.subjectId, scaling: proficiency.scaling, source: proficiency.source }, proficiency.category == null ? {} : { category: proficiency.category }, proficiency.grantId == null ? {} : { grantId: proficiency.grantId }]))'
}
