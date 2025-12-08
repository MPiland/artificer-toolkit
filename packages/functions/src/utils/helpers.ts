import { Expression, sql } from 'kysely'

export function upper(expr: Expression<string>) {
  return sql<string>`upper(${expr})`
}

export function lower(expr: Expression<string>) {
  return sql<string>`lower(${expr})`
}

export function concat(...exprs: Expression<string>[]) {
  return sql.join<string>(exprs, sql`||`)
}
