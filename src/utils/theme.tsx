import { createTheme, SimpleGrid, Paper } from '@mantine/core'

export const theme = createTheme({
  components: {
    SimpleGrid: SimpleGrid.extend({
      defaultProps: {
        cols: {
          base: 2,
          md: 4,
          lg: 5,
        },
        spacing: {
          base: 8
        }
      },
      styles: {
        root: {
          marginBottom: '1rem'
        }
      }
    }),
    Paper: Paper.extend({
      defaultProps: {
        withBorder: true
      }
    })
  },
})
