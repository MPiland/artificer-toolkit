import { useEffect } from 'react'
import { ReducerActionType } from '../../../utils/types'
import { useGetBuildersQuery } from '../../../features/builders/buildersApi'
import Row from '../../Row/Row'
import Dropdown from '../../Dropdown/Dropdown'
import Input from '../../Input/Input'
import { sprinkles } from '../../../css/sprinkles.css'
import { useForm } from '../../../hooks/UseForm'
import Collapse from '../../Collapse/Collapse'
import Table from '../../Table/Table'

const LimitUse = ({ state, setState }: { state: any; setState: (arg: ReducerActionType) => void }) => {
  const { context } = useForm()

  const { data: builders } = useGetBuildersQuery()

  //Add/remove Limit Use table
  useEffect(() => {
    if (
      !state.charge?.level &&
      state?.charge?.limit?.name === 'level' &&
      state.attribute?.some((attributeItem: any) => attributeItem.name === 'limitUse')
    ) {
      setState({
        type: 'added',
        target: { name: `charge.level` },
      })
    }
    if (!(state.charge?.limit?.name === 'level') && state.charge?.level) {
      setState({
        type: 'removed',
        target: { name: `charge.level` },
      })
    }
    if (!state.attribute?.some((attributeItem: any) => attributeItem?.name === 'limitUse') && state.charge) {
      setState({
        type: 'removed',
        target: {
          name: `charge`,
        },
      })
    }
  }, [state, setState])

  return (
    state?.attribute?.some((attributeItem: any) => attributeItem?.name === 'limitUse') && (
      <>
        <Row className={sprinkles({ mb: 'space-3' })}>
          <Dropdown
            name={`charge.limit`}
            label='Limit Option'
            value={state?.charge?.limit}
            options={[].concat(
              builders.features.charge.limit,
              context.title && builders.features[context.title]?.charge?.limit
            )}
            required={true}
            onChange={setState}
          />
          {state?.charge?.limit?.name === 'ability' ? (
            <>
              <Dropdown
                name={`charge.ability.type`}
                label='Ability'
                value={state?.charge?.ability?.type}
                options={builders.abilities.type}
                required={true}
                onChange={setState}
              />
            </>
          ) : state.charge?.limit?.name === 'skill' ? (
            <Dropdown
              name={`charge.skill.type`}
              label='Skill'
              value={state?.charge?.skill?.type}
              options={builders.skills.type}
              required={true}
              onChange={setState}
            />
          ) : state.charge?.limit?.name === 'setValue' ? (
            <Input
              validation='num'
              type='text'
              name={`charge.setValue`}
              errorMsg='Must contain only numbers'
              label='Use Amount'
              value={state?.charge?.setValue}
              required={true}
              onChange={setState}
            />
          ) : (
            state.charge?.limit?.name === 'resourcePoints' && (
              <Input
                validation='num'
                type='text'
                name={`charge.resourcePoints`}
                errorMsg='Must contain only numbers'
                label='Use Amount'
                value={state?.charge?.resourcePoints}
                required={true}
                onChange={setState}
              />
            )
          )}
          {state?.charge?.limit &&
            state.charge?.limit?.name !== 'setValue' &&
            state.charge?.limit?.name !== 'level' &&
            state?.charge?.limit?.name !== 'resourcePoints' && (
              <>
                <Input
                  name={`charge.multiplier`}
                  autoComplete='off'
                  validation='num'
                  errorMsg='Must contain whole numbers only'
                  label='Multiplier'
                  value={state?.charge?.multiplier}
                  onChange={setState}
                />
                <>
                  <Input
                    name={`charge.addValue`}
                    autoComplete='off'
                    label='Additional Amount'
                    value={state?.charge?.addValue}
                    onChange={setState}
                  />
                  <Input
                    name={`charge.minValue`}
                    autoComplete='off'
                    label='Min. Value'
                    value={state?.charge?.minValue}
                    onChange={setState}
                  />
                </>
              </>
            )}
          {state?.charge?.limit?.name !== 'resourcePoints' && (
            <Dropdown
              name={`charge.reset`}
              label='Reset Option'
              value={state?.charge?.reset}
              options={builders.features.charge.reset}
              required={true}
              onChange={setState}
            />
          )}
        </Row>
        {state.attribute?.some((attributeItem: any) => attributeItem?.name === 'limitUse') && (
          <>
            <Collapse>
              <Collapse.Header title={'Limit Use Table'} />
              <Collapse.Body>
                <Table
                  rows={{
                    inputs: [
                      {
                        name: 'value',
                        errorMsg: 'Must contain only numbers',
                        validation: 'num',
                      },
                      {
                        name: 'useNum',
                        errorMsg: 'Must contain only numbers',
                        validation: 'num',
                      },
                    ],
                    headers: [
                      {
                        value: 'Level',
                      },
                      {
                        value: 'Uses',
                      },
                    ],
                  }}
                  name={`charge.level`}
                  value={state?.charge?.level}
                  onChange={setState}
                  addRow={true}
                />
              </Collapse.Body>
            </Collapse>
          </>
        )}
      </>
    )
  )
}

export default LimitUse
