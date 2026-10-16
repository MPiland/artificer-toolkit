import { afterEach } from 'vitest'

import { clearRoomAlarms } from './roomTeardown.js'

afterEach(clearRoomAlarms)
