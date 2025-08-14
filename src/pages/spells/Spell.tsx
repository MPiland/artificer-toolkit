import parse from 'html-react-parser'
import Detail, { DetailConfig } from '~/components/Detail'
import { Route } from '~/routes/_protected/spells/$spellId'
import { useGetSpell } from '~/apis'
import type { Spell } from '~/types'

const Spell = () => {
  const spellId = Route.useParams({ select: (r) => r.spellId })
  const { data: spell } = useGetSpell(spellId)

  const materialDesc = () => {
    if (spell && 'materialDesc' in spell && spell.materialDesc != null) {
      return '*' + spell.materialDesc
    } else return null
  }

  const detailConfigs: DetailConfig<Spell>[] = [
    { header: 'LEVEL', text: { path: 'level' } },
    {
      header: 'CASTING TIME',
      text: [
        [
          { path: 'actions.primary.amount' },
          { path: 'actions.primary.id', source: { type: 'system', path: 'actions' } },
        ],
        [
          { path: 'actions.secondary.amount' },
          { path: 'actions.secondary.id', source: { type: 'system', path: 'actions' } },
        ],
      ],
    },
    {
      header: 'RANGE/AREA',
      text: [
        [
          { path: 'range.id', source: { type: 'system', path: 'spells.ranges' } },
          [
            { path: 'range.minRange' },
            { path: 'range.unit', source: { type: 'system', path: 'rules', labelKey: 'short' } },
          ],
          [
            { path: 'range.maxRange' },
            { path: 'range.unit', source: { type: 'system', path: 'rules', labelKey: 'short' } },
          ],
        ],
        [
          { path: 'shape.id', source: { type: 'system', path: 'spells.shapes' } },
          { path: 'shape.size' },
          { path: 'shape.unit', source: { type: 'system', path: 'rules', labelKey: 'short' } },
        ],
      ],
    },
    {
      header: 'REQUIREMENTS',
      text: { path: 'requirements', source: { type: 'system', path: 'spells.requirements' } },
      truncate: 1,
    },
    {
      header: 'DURATION',
      text: [
        { path: 'duration.amount' },
        { path: 'duration.id', source: { type: 'system', path: 'spells.durations' } },
      ],
    },
    { header: 'SCHOOL', text: { path: 'school', source: { type: 'system', path: 'spells.schools' } } },
    {
      header: 'SAVE ABILITY',
      text: { path: 'saveAbility.id', source: { type: 'system', path: 'abilities' } },
      filter: ['isAttack', 'requireSave'],
    },
    {
      header: 'DAMAGE',
      text: [
        [
          { path: 'damage.primary.dieConfig' },
          { path: 'damage.primary.id', source: { type: 'system', path: 'damageTypes' } },
        ],
        [
          { path: 'damage.secondary.dieConfig' },
          { path: 'damage.secondary.id', source: { type: 'system', path: 'damageTypes' } },
        ],
        { path: 'conditions', source: { type: 'system', path: 'conditions' } },
      ],
    },
  ]

  const footer = materialDesc()

  return (
    <Detail detailConfigs={detailConfigs} footer={footer} item={spell!}>
      <div>{spell?.desc && parse(spell?.desc)}</div>
    </Detail>
  )
}

export default Spell
