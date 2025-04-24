import Collapse from '@/components/Collapse'
import Dropdown from '@/components/Dropdown'
import Input from '@/components/Input'
import { Attributes } from '@/enums'
import Grid from '@/components/Grid'
import { useSystemData } from '@/hooks'
import type { OnChange, Class } from '@/types'

const Multiclass = ({
  formStore: { data, updateField, removeField },
}: {
  formStore: {
    data: Class
    updateField: OnChange<Class>['updateField']
    removeField: OnChange<Class>['removeField']
  }
}) => {
  const { abilities } = useSystemData()

  return (
    <Grid.Item>
      <Collapse>
        <Collapse.Header title={'Multiclass Ability Requirements'} startOpened={data.id == null} />
        <Collapse.Body>
          <Grid>
            {data?.attributes?.some((attribute) => attribute === Attributes.PRIMARY_ABILITY) && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='multiclass.primaryAbility.id'
                    label='Primary Ability'
                    value={data?.multiclass?.primaryAbility?.id}
                    options={abilities
                      .filter((ability) => ability.id !== data.multiclass?.secondaryAbility?.id)
                      .filter((ability) => ability.id !== data.multiclass?.optionalAbility?.id)}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='multiclass.primaryAbility.minAmount'
                    autoComplete='off'
                    label='Primary Score'
                    required={true}
                    value={data?.multiclass?.primaryAbility?.minAmount}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={{ updateField }}
                  />
                </Grid.Item>
              </>
            )}
            {data?.attributes?.some((attribute) => attribute === Attributes.SECONDARY_ABILITY) && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='multiclass.secondaryAbility.id'
                    label='Secondary Ability'
                    value={data?.multiclass?.secondaryAbility?.id}
                    options={abilities
                      .filter((ability) => ability.id !== data.multiclass?.primaryAbility?.id)
                      .filter((ability) => ability.id !== data.multiclass?.optionalAbility?.id)}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='multiclass.secondaryAbility.minAmount'
                    autoComplete='off'
                    label='Secondary Score'
                    required={true}
                    value={data?.multiclass?.secondaryAbility?.minAmount}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={{ updateField }}
                  />
                </Grid.Item>
              </>
            )}
            {data?.attributes?.some((attribute) => attribute === Attributes.OPTIONAL_ABILITY) && (
              <>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Dropdown
                    name='multiclass.optionalAbility.id'
                    label='Optional Ability'
                    value={data?.multiclass?.optionalAbility?.id}
                    options={abilities
                      .filter((ability) => ability.id !== data.multiclass?.primaryAbility?.id)
                      .filter((ability) => ability.id !== data.multiclass?.secondaryAbility?.id)}
                    required={true}
                    onChange={{ updateField, removeField }}
                  />
                </Grid.Item>
                <Grid.Item colSpan={{ sm: 6, md: 4, lg: 2 }}>
                  <Input
                    name='multiclass.optionalAbility.minAmount'
                    autoComplete='off'
                    label='Optional Score'
                    required={true}
                    value={data?.multiclass?.optionalAbility?.minAmount}
                    validation='num'
                    errorMsg='Must contain whole numbers only'
                    onChange={{ updateField }}
                  />
                </Grid.Item>
              </>
            )}
          </Grid>
        </Collapse.Body>
      </Collapse>
    </Grid.Item>
  )
}

export default Multiclass
