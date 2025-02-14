import { GenericType, Scores } from '../../../../../amplify/gql/types'
import {
  ability_card_header,
  ability_card,
  ability_card_info_label,
  ability_card_info_value,
  ability_card_info,
} from '../Character.css'

const AbilityCard = ({ ability, score }: { ability: GenericType; score: Scores }) => {
  const calculateModifier = (score: number, type: 'bonus' | 'modifier') => {
    let scoreString: string = ''
    if (!score) {
      return '--'
    }
    if (type === 'bonus') {
      if (score > 0) {
        scoreString += '+'
      }
      if (score < 0) {
        scoreString += '-'
      }

      scoreString += `${score}`
    }
    if (type === 'modifier') {
      const subtracted = score - 10
      const modifier = Math.round(subtracted / 2)
      if (modifier > 0) {
        scoreString += '+'
      }
      if (modifier < 0) {
        scoreString += '-'
      }

      scoreString += `${Math.abs(modifier)}`
    }

    return scoreString
  }

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
