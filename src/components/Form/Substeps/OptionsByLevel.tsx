import { z } from 'zod/v4'
import { Grid } from '@mantine/core'
import { OptionsByLevelInputSchema } from '@/schemas'
import { withFieldGroup } from '../utils/factory'

const defaultValues: z.input<typeof OptionsByLevelInputSchema> = OptionsByLevelInputSchema.parse({})

const OptionsByLevel = withFieldGroup({
  defaultValues,
  props: {
    replaceAtLevel: false,
  },
  render: function Render({ group, replaceAtLevel }) {
    const { AppField } = group
    return (
      <Grid.Col>
        <Grid>
          <AppField
            name='level'
            validators={{
              onSubmit: ({ value }) => !value && 'Please enter a level',
              onChange: z.int('Level must be a whole number').gte(1, 'Level must be greater than 0'),
            }}
          >
            {({ TextField }) => (
              <Grid.Col>
                <TextField />
              </Grid.Col>
            )}
          </AppField>
          <AppField
            name='count'
            validators={{
              onSubmit: ({ value }) => !value && 'Please enter a count',
              onChange: z.int('Count must be a whole number').gte(1, 'Count must be greater than 0'),
            }}
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
              validators={{
                onSubmit: ({ value }) => !value && 'Please enter a number of replacements',
                onChange: z
                  .int('Replacement count must be a whole number')
                  .gte(1, 'Replacement count must be greater than 0'),
              }}
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
export default OptionsByLevel
