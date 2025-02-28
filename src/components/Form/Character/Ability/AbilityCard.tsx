import { GenericType, Scores } from '../../../../../amplify/gql/types'
import {
  ability_card_header,
  ability_card,
  ability_card_info_label,
  ability_card_info_value,
  ability_card_info,
} from '../Character.css'
import { calculateModifier } from '../../../../utils/form'

const AbilityCard = ({ ability, score }: { ability: GenericType; score: Scores }) => {
  return (
    <div className={ability_card}>
      <div className={ability_card_header}>
        <h3>{ability.label}</h3>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Total Score</div>
        <div className={ability_card_info_value}>{score.calculatedScore > 0 ? score.calculatedScore : '--'}</div>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Modifier</div>
        <div className={ability_card_info_value}>{calculateModifier(score.calculatedScore, 'modifier')}</div>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Base Score</div>
        <div className={ability_card_info_value}>{score.baseScore > 0 ? score.baseScore : '--'}</div>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Racial Bonus</div>
        <div className={ability_card_info_value}>{calculateModifier(score.raceScore, 'bonus')}</div>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Modifier Bonus</div>
        <div className={ability_card_info_value}>{calculateModifier(score.modifierScore, 'bonus')}</div>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Ability Improvements</div>
        <div className={ability_card_info_value}>{calculateModifier(score.classScore, 'bonus')}</div>
      </div>
    </div>
  )
}
export default AbilityCard
