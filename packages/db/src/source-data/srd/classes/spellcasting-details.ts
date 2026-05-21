import type { DetailAuthored } from '@artificer-toolkit/shared'

type SpellcastingDetailInput = {
  label: string
  description: string
}

export function classSpellcastingDetails(
  classIndex: number,
  details: readonly SpellcastingDetailInput[]
): DetailAuthored[] {
  return details.map((detail, index) => ({
    id: classSpellcastingDetailId(classIndex, index + 1),
    label: detail.label,
    description: detail.description,
    order: index + 1
  }))
}

function classSpellcastingDetailId(classIndex: number, entry: number): string {
  const xx = classIndex.toString(16).padStart(2, '0')
  const nn = entry.toString(16).padStart(2, '0')

  return `00000000-0000-0000-c0${xx}-61${nn}00000000`
}
