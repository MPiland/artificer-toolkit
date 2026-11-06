import { env } from 'cloudflare:workers'

import { assertNoLocalMarker } from './localMarkerGuard.js'

// Fails every test file at once, instead of each room test waiting for its timeout.
assertNoLocalMarker(env)
