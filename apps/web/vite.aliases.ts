import { fileURLToPath } from 'node:url'
import type { AliasOptions } from 'vite'

const fromWebRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url))

export const webAliases: AliasOptions = [
  { find: '#css/foundations.css', replacement: fromWebRoot('./src/css/foundations.css.ts') },
  { find: '#css/layers.css', replacement: fromWebRoot('./src/css/layers.css.ts') },
  { find: '#css/main.css', replacement: fromWebRoot('./src/css/main.css') },
  { find: '#css/size.css', replacement: fromWebRoot('./src/css/size.css.ts') },
  { find: '#css/theme.css', replacement: fromWebRoot('./src/css/theme.css.ts') },
  { find: '#css/theme', replacement: fromWebRoot('./src/css/theme.ts') },
  { find: '#css/typography.css', replacement: fromWebRoot('./src/css/typography.css.ts') },
  { find: '#app', replacement: fromWebRoot('./src') },
  { find: '#forms', replacement: fromWebRoot('./src/forms') },
  { find: '#components', replacement: fromWebRoot('./src/components') },
  { find: '#ui', replacement: fromWebRoot('./src/ui') },
  { find: '#domains', replacement: fromWebRoot('./src/domains') },
  { find: '#lib', replacement: fromWebRoot('./src/lib') },
  { find: '#routes', replacement: fromWebRoot('./src/routes') },
  { find: '#assets', replacement: fromWebRoot('./src/assets') },
  { find: '#supabase', replacement: fromWebRoot('./src/supabase') },
  { find: '#test/msw/handlers', replacement: fromWebRoot('./src/test/msw/handlers.ts') },
  { find: '#test/msw/server', replacement: fromWebRoot('./src/test/msw/server.ts') },
  { find: '#test/renderWithAppProviders', replacement: fromWebRoot('./src/test/renderWithAppProviders.tsx') },
  { find: '#test', replacement: fromWebRoot('./src/test') },
  { find: '#auth', replacement: fromWebRoot('./src/auth/index.ts') }
]
