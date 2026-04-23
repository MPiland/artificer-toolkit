import { globalStyle, assignVars } from '@vanilla-extract/css'
import { app } from './layers.css'
import {
  darkFoundationTokens,
  foundationVars,
  lightFoundationTokens,
  sharedFoundationTokens,
} from './foundations.css'

globalStyle(':root', {
  '@layer': {
    [app]: {
      vars: {
        ...assignVars(foundationVars.font, sharedFoundationTokens.font),
        ...assignVars(foundationVars.size, sharedFoundationTokens.size),
        ...assignVars(foundationVars.space, sharedFoundationTokens.space),
        ...assignVars(foundationVars.radius, sharedFoundationTokens.radius),
        ...assignVars(foundationVars.shadow, sharedFoundationTokens.shadow),
        ...assignVars(foundationVars.motion, sharedFoundationTokens.motion),
      },
    },
  },
})

globalStyle(':root, :root[data-mantine-color-scheme="light"]', {
  '@layer': {
    [app]: {
      vars: assignVars(foundationVars.color, lightFoundationTokens.color),
    },
  },
})

globalStyle(':root[data-mantine-color-scheme="dark"]', {
  '@layer': {
    [app]: {
      vars: assignVars(foundationVars.color, darkFoundationTokens.color),
    },
  },
})
