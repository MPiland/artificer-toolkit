import { useMemo } from 'react'
import Dropdown from '@/components/Dropdown'
import { Scene } from '@/components/Dice'
import { createPortal } from 'react-dom'
import { AbilityGenMethods } from '@/enums'
import PointBuy from '../Substeps/Character/Abilities/PointBuy'
import StandardArray from '../Substeps/Character/Abilities/StandardArray'
import ManualArray from '../Substeps/Character/Abilities/ManualArray'
import { use } from 'react'
import { FormContext } from '../FormContext'
import AbilityCard from '../Substeps/Character/Abilities/AbilityCard'
import Grid from '@/components/Grid'
import Input from '@/components/Input'
import Collapse from '@/components/Collapse'
import { useSystemData } from '@/hooks'
import type { OnChange, Character } from '@/types'
import type { FormStore } from '@/store'

const AbilitiesStep = () => {
  const {
    rules,
    abilities: { findAbility },
  } = useSystemData()
  const { formStore } = use(FormContext) as {
    formStore: FormStore<Character>
  }

  const {
    data,
    updateField,
    removeField,
  }: {
    data: Character
    updateField: OnChange<Character>['updateField']
    removeField: OnChange<Character>['removeField']
  } = formStore

  const form: HTMLFormElement = document.getElementById('form-content') as HTMLFormElement

  const pointSystem = useMemo(() => data.abilities?.selectedSystem, [data.abilities?.selectedSystem])

  return (
    <Grid>
      {form && createPortal(<Scene />, form)}
      <Grid.Item>
        <Grid>
          <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
            <Dropdown
              name='abilities.selectedSystem'
              options={rules.abilityGenerateMethod}
              label='Point System'
              value={data.abilities?.selectedSystem}
              onChange={{ updateField, removeField }}
            />
          </Grid.Item>
          {pointSystem === AbilityGenMethods.MANUAL && (
            <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
              <Input
                name='abilities.manualRolled.configuration'
                value={data?.abilities?.manualRolled?.configuration}
                label='Dice Count'
                type='roll'
                onChange={{ updateField }}
              />
            </Grid.Item>
          )}
        </Grid>
      </Grid.Item>
      {pointSystem === AbilityGenMethods.POINT_BUY && <PointBuy formStore={formStore} />}
      {pointSystem === AbilityGenMethods.MANUAL && <ManualArray formStore={formStore} />}
      {pointSystem === AbilityGenMethods.STANDARD_ARRAY && <StandardArray formStore={formStore} />}
      <Grid.Item>
        <Collapse>
          <Collapse.Header title='Abilities' startOpened={true} />
          <Collapse.Body>
            <Grid>
              {data.abilities?.scores?.map((score, index) => {
                const ability = findAbility(score.ability)
                if (ability) {
                  return <AbilityCard key={index} score={score} ability={ability} />
                }
              })}
            </Grid>
          </Collapse.Body>
        </Collapse>
      </Grid.Item>
    </Grid>
  )
}

export default AbilitiesStep
