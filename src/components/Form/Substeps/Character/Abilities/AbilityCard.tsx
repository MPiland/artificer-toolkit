import type { GenericType, Scores } from '@/types'
import {
  ability_card_header,
  ability_card,
  ability_card_info_label,
  ability_card_info_value,
  ability_card_info,
} from '../../../Character.css'
import { calculateModifier } from '../../../Form.utils'
import { Grid } from '@mantine/core'

const AbilityCard = ({ ability, score }: { ability: GenericType; score: Scores }) => {
  return (
    <Grid.Col span={{ sm: 12, md: 4 }} className={ability_card}>
      <div className={ability_card_header}>
        <h3>{ability.label}</h3>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Total Score</div>
        <div className={ability_card_info_value}>
          {score?.calculatedScore && score?.calculatedScore > 0 ? score.calculatedScore : '--'}
        </div>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Modifier</div>
        <div className={ability_card_info_value}>{calculateModifier(score?.calculatedScore || 0, 'modifier')}</div>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Base Score</div>
        <div className={ability_card_info_value}>
          {score?.baseScore && score?.baseScore > 0 ? score.baseScore : '--'}
        </div>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Racial Bonus</div>
        <div className={ability_card_info_value}>{calculateModifier(score?.raceScore || 0, 'bonus')}</div>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Modifier Bonus</div>
        <div className={ability_card_info_value}>{calculateModifier(score?.modifierScore || 0, 'bonus')}</div>
      </div>
      <div className={ability_card_info}>
        <div className={ability_card_info_label}>Ability Improvements</div>
        <div className={ability_card_info_value}>{calculateModifier(score?.classScore || 0, 'bonus')}</div>
      </div>
    </Grid.Col>
  )
}
export default AbilityCard
