import type {
  LiveSessionCheckpointIo,
  LiveSessionCheckpointIoSection
} from '@artificer-toolkit/schema/api/liveSessionCheckpoint'
import type { MutationCtx } from '../_generated/server'

type Counters = Omit<LiveSessionCheckpointIo, 'sections'>

const empty = (): Counters => ({
  bytesRead: 0,
  bytesWritten: 0,
  documentsRead: 0,
  documentsWritten: 0
})

/**
 * Attributes the transaction's I/O to checkpoint sections (A35-S10a). `mark(section)` charges
 * everything since the previous mark to `section`, so the sections partition the transaction and
 * sum to its totals. Marking is a metrics syscall, not a database read.
 */
export function createCheckpointIoMeter(ctx: Pick<MutationCtx, 'meta'>) {
  const sections: Record<LiveSessionCheckpointIoSection, Counters> = {
    fence: empty(),
    records: empty(),
    scopes: empty(),
    holds: empty(),
    scenes: empty(),
    history: empty(),
    privateRolls: empty(),
    remainder: empty()
  }
  let last = empty()
  const mark = async (section: LiveSessionCheckpointIoSection) => {
    const { bytesRead, bytesWritten, documentsRead, documentsWritten } =
      await ctx.meta.getTransactionMetrics()
    const now = {
      bytesRead: bytesRead.used,
      bytesWritten: bytesWritten.used,
      documentsRead: documentsRead.used,
      documentsWritten: documentsWritten.used
    }
    const charged = sections[section]
    charged.bytesRead += now.bytesRead - last.bytesRead
    charged.bytesWritten += now.bytesWritten - last.bytesWritten
    charged.documentsRead += now.documentsRead - last.documentsRead
    charged.documentsWritten += now.documentsWritten - last.documentsWritten
    last = now
  }
  return {
    mark,
    /** The whole transaction, with the work since the last mark charged to `remainder`. */
    async finish(): Promise<LiveSessionCheckpointIo> {
      await mark('remainder')
      return { ...last, sections }
    }
  }
}

export type CheckpointIoMeter = ReturnType<typeof createCheckpointIoMeter>
