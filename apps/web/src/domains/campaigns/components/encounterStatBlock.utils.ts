import type { EncounterGmActorDto } from '@artificer-toolkit/schema/api/encounters'
import type { SystemAuthoredDto } from '@artificer-toolkit/schema/vocabulary/system'

type StatBlock = NonNullable<EncounterGmActorDto['statBlock']>
type QualifiedDefense = StatBlock['qualifiedDamageDefenses'][number]
type Vocabulary = Pick<SystemAuthoredDto, 'damageTypes' | 'conditionTypes'> | null | undefined

function labelFor(id: string, entries: readonly { id: string; label: string }[] | undefined) {
  return entries?.find((entry) => entry.id === id)?.label ?? id
}

function formatAndList(values: readonly string[]): string {
  if (values.length <= 2) return values.join(' and ')
  return `${values.slice(0, -1).join(', ')}, and ${values.at(-1)}`
}

/** "Bludgeoning, piercing, and slashing from nonmagical attacks that aren't silvered". */
function formatQualifiedDefense(defense: QualifiedDefense, vocabulary: Vocabulary): string {
  const damageTypes = formatAndList(
    defense.damageTypeIds.map((id) => labelFor(id, vocabulary?.damageTypes).toLowerCase())
  )
  const materials = defense.bypassedBy.flatMap((bypass) =>
    bypass === 'SILVERED' ? ['silvered'] : bypass === 'ADAMANTINE' ? ['adamantine'] : []
  )
  const text = `${damageTypes} from ${defense.bypassedBy.includes('MAGICAL') ? 'nonmagical ' : ''}attacks${
    materials.length > 0 ? ` that aren't ${materials.join(' or ')}` : ''
  }`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

/**
 * The stat block's defense rows with vocabulary labels. Plain damage types are comma-separated;
 * a qualified defense follows them after a semicolon, as SRD stat blocks write it.
 */
export function encounterStatBlockDefenses(
  statBlock: StatBlock,
  vocabulary: Vocabulary
): { label: string; value: string }[] {
  const qualified = (kind: QualifiedDefense['kind']) =>
    statBlock.qualifiedDamageDefenses
      .filter((defense) => defense.kind === kind)
      .map((defense) => formatQualifiedDefense(defense, vocabulary))
  const row = (label: string, plain: readonly string[], extra: readonly string[] = []) => ({
    label,
    value: [plain.join(', '), ...extra].filter((part) => part.length > 0).join('; ')
  })
  const damageLabels = (ids: readonly string[]) =>
    ids.map((id) => labelFor(id, vocabulary?.damageTypes))
  return [
    row('Vulnerable', damageLabels(statBlock.damageVulnerabilities)),
    row('Resistant', damageLabels(statBlock.damageResistances), qualified('RESISTANCE')),
    row('Immune', damageLabels(statBlock.damageImmunities), qualified('IMMUNITY')),
    row(
      'Condition immune',
      statBlock.conditionImmunities.map((id) => labelFor(id, vocabulary?.conditionTypes))
    )
  ].filter((entry) => entry.value.length > 0)
}
