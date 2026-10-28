import type { AllUnionFields } from 'type-fest'
import type {
  ManifestOccupantConditionImmunityAuthored,
  ManifestOccupantSaveBonusAuthored
} from '#authored'
import { buildNodeMap, type NodeMap } from '#utils'

/** The D155 occupant aura options a zone component lends whoever stands inside it. */

type ManifestOccupantSaveBonusNode = AllUnionFields<ManifestOccupantSaveBonusAuthored>

const CODE_COLUMNS = ['id', 'label', 'description'] as const

const manifestOccupantSaveBonus = buildNodeMap<ManifestOccupantSaveBonusNode>()
const manifestOccupantConditionImmunity = buildNodeMap<ManifestOccupantConditionImmunityAuthored>()

export const MANIFEST_OCCUPANT_SAVE_BONUS_NODE_MAP: NodeMap<ManifestOccupantSaveBonusNode> =
  manifestOccupantSaveBonus.define('manifestOccupantSaveBonus', ({ map, nodes, cond, data }) => {
    const { text, number, selectSingle } = nodes
    const local = cond.local()
    const isAbilityModifier = local.field(['amountKind']).eq('SOURCE_ABILITY_MODIFIER')

    map
      .set('id', text(['id'], 'ID'))
      .set(
        'domain',
        selectSingle(
          ['domain'],
          'Applies To',
          {
            kind: 'INLINE_OPTIONS',
            options: [{ code: 'EVERY_SAVING_THROW', label: 'Every Saving Throw' }]
          },
          { requiredIf: true }
        )
      )
      .set(
        'amountKind',
        selectSingle(
          ['amountKind'],
          'Amount',
          {
            kind: 'INLINE_OPTIONS',
            options: [
              { code: 'FIXED', label: 'Fixed' },
              { code: 'SOURCE_ABILITY_MODIFIER', label: 'Source Ability Modifier' }
            ]
          },
          { requiredIf: true }
        )
      )
      .set(
        'amount',
        number(['amount'], 'Bonus', {
          requiredIf: true,
          showIf: local.field(['amountKind']).eq('FIXED'),
          constraints: { minimum: 1 }
        })
      )
      .set(
        'ability',
        selectSingle(
          ['ability'],
          'Ability',
          { kind: 'DATA', relationship: data.table('abilities', { selectColumns: CODE_COLUMNS }) },
          { requiredIf: true, showIf: isAbilityModifier }
        )
      )
      .set('minimum', number(['minimum'], 'Minimum Bonus', { showIf: isAbilityModifier }))
      .set(
        'dispositionFilter',
        selectSingle(
          ['dispositionFilter'],
          'Benefits',
          {
            kind: 'INLINE_OPTIONS',
            options: [{ code: 'ALLIES_AND_SOURCE', label: 'Source and Its Allies' }]
          },
          { requiredIf: true }
        )
      )
  })

export const MANIFEST_OCCUPANT_CONDITION_IMMUNITY_NODE_MAP: NodeMap<ManifestOccupantConditionImmunityAuthored> =
  manifestOccupantConditionImmunity.define(
    'manifestOccupantConditionImmunity',
    ({ map, nodes, data }) => {
      const { text, selectSingle, selectMulti } = nodes
      map
        .set('id', text(['id'], 'ID'))
        .set(
          'conditionTypeIds',
          selectMulti(
            ['conditionTypeIds'],
            'Conditions',
            {
              kind: 'DATA',
              relationship: data.table('condition_types', { selectColumns: CODE_COLUMNS })
            },
            { requiredIf: true }
          )
        )
        .set(
          'dispositionFilter',
          selectSingle(
            ['dispositionFilter'],
            'Benefits',
            {
              kind: 'INLINE_OPTIONS',
              options: [{ code: 'ALLIES_AND_SOURCE', label: 'Source and Its Allies' }]
            },
            { requiredIf: true }
          )
        )
    }
  )
