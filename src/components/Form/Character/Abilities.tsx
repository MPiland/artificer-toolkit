import { useMemo } from 'react'
import {
  ability_card_header,
  ability_card,
  ability_card_info_label,
  ability_card_info_value,
  ability_card_info,
  ability_card_group,
  system_select,
} from './Character.css'
import Dropdown from '../../Dropdown/Dropdown'
import { useGetSystemQuery } from '../../../features/systems/systemsApi'
import Row from '../../Row/Row'
import Scene from '../../Dice/Scene'
import { createPortal } from 'react-dom'
import { AbilityGenerate } from '../../../types/enums'
import { Character } from '../../../../amplify/API'
import PointBuy from './GenerateAbility/PointBuy'
import StandardArray from './GenerateAbility/StandardArray'
import ManualArray from './GenerateAbility/ManualArray'
import { UpdateState } from '../../../types/form'
import { use } from 'react'
import FormContext from '../FormContext'

const AbilitiesForm = () => {
  const { data: system } = useGetSystemQuery()

  const { formData, updateFormData } = use(FormContext) as {
    formData: Character
    updateFormData: (formData: UpdateState<Character>) => void
  }

  const form: HTMLFormElement = document.getElementById('form_content') as HTMLFormElement

  const pointSystem = useMemo(() => formData.abilities?.selectedSystem, [formData.abilities?.selectedSystem])

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
    <>
      {createPortal(<Scene />, form)}
      <Dropdown
        name='abilities.selectedSystem'
        options={system.rules.abilityGenerateMethod}
        className={system_select}
        label='Point System'
        value={formData.abilities?.selectedSystem}
        onChange={updateFormData}
      />
      {pointSystem === AbilityGenerate.pointBuy && <PointBuy formData={formData} updateFormData={updateFormData} />}
      {pointSystem === AbilityGenerate.manual && <ManualArray formData={formData} updateFormData={updateFormData} />}
      {pointSystem === AbilityGenerate.standardArray && (
        <StandardArray formData={formData} updateFormData={updateFormData} />
      )}
      <Row cols={{ md: 3, base: 2 }} spacing='spaceAround' className={ability_card_group}>
        {formData.abilities?.scores?.map((score, index) => {
          const ability = system.abilities.find((ability) => ability.id === score.ability)
          return (
            <div key={index} className={ability_card}>
              <div className={ability_card_header}>
                <h3>{ability.label}</h3>
              </div>
              <div className={ability_card_info}>
                <div className={ability_card_info_label}>Total Score</div>
                <div className={ability_card_info_value}>
                  {score.calculatedScore > 0 ? score.calculatedScore : '--'}
                </div>
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
        })}
      </Row>
    </>
  )
}

export default AbilitiesForm
