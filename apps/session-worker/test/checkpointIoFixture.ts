import type { LiveSessionCheckpointIo } from '@artificer-toolkit/schema/api/liveSessionCheckpoint'

const none = { bytesRead: 0, bytesWritten: 0, documentsRead: 0, documentsWritten: 0 }

/** The metrics of a checkpoint that did no database work, as every section reports them. */
export const NO_CHECKPOINT_IO: LiveSessionCheckpointIo = {
  ...none,
  sections: {
    fence: none,
    records: none,
    scopes: none,
    holds: none,
    scenes: none,
    history: none,
    privateRolls: none,
    remainder: none
  }
}
