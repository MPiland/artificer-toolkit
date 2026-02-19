import type { Database } from '@artificer-toolkit/db/types'
import type { Kysely, Transaction } from 'kysely'

export type DB = Kysely<Database>

export type DBLike = Kysely<Database> | Transaction<Database>
