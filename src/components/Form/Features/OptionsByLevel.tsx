import { Grid } from '@mantine/core'
import { withFieldGroup } from '@/components/Form'
import { useFieldUpdates } from '@/hooks'
import type { OptionsByLevelInput } from 'gql/types'

const OptionByLevel = withFieldGroup({
  defaultValues: {} as OptionsByLevelInput,
  props: {
    replaceAtLevel: false,
    index: 0,
  },
  render: function Render({ group, replaceAtLevel, index }) {
    const { AppField } = group

    const { fieldListeners, fieldValidators } = useFieldUpdates({ data: 'feature', path: `optionsByLevel[${index}]` })

    return (
      <Grid.Col>
        <Grid>
          <AppField
            name='level'
            validators={fieldValidators({
              onBlur: 'Please enter a level',
              onChange: { type: 'integer', name: 'Level', min: 1 },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col>
                <TextField />
              </Grid.Col>
            )}
          </AppField>
          <AppField
            name='count'
            validators={fieldValidators({
              onBlur: 'Please enter a count',
              onChange: { type: 'integer', name: 'Count', min: 1 },
            })}
            listeners={fieldListeners}
          >
            {({ TextField }) => (
              <Grid.Col>
                <TextField />
              </Grid.Col>
            )}
          </AppField>
          {replaceAtLevel && (
            <AppField
              name='replaceCount'
              validators={fieldValidators({
                onBlur: 'Please enter a number of replacements',
                onChange: { type: 'integer', name: 'Replacements', min: 1 },
              })}
              listeners={fieldListeners}
            >
              {({ TextField }) => (
                <Grid.Col>
                  <TextField />
                </Grid.Col>
              )}
            </AppField>
          )}
        </Grid>
      </Grid.Col>
    )
  },
})
export default OptionByLevel
