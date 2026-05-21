type Row = Record<string, unknown>
type Filter = { column: string, op: string, value: unknown }

type ConflictMode = 'none' | 'doNothing' | 'doUpdateSet'

function cloneRows(rows: Row[]): Row[] {
  return rows.map((row) => ({ ...row }))
}

function matchesFilter(row: Row, filter: Filter): boolean {
  const rowValue = readColumnValue(row, filter.column)

  if (filter.op === 'in') {
    return Array.isArray(filter.value) && filter.value.includes(rowValue)
  }

  if (filter.op === 'is not') {
    return rowValue !== filter.value
  }

  return rowValue === filter.value
}

function readColumnValue(row: Row, column: string): unknown {
  if (column in row) return row[column]

  const unqualifiedColumn = column.split('.').pop()
  return unqualifiedColumn ? row[unqualifiedColumn] : undefined
}

function withQualifiedColumns(table: string, row: Row): Row {
  return Object.entries(row).reduce<Row>((next, [key, value]) => ({
    ...next,
    [key]: value,
    [`${table}.${key}`]: value
  }), {})
}

function projectSelectedColumns(row: Row, columns: string | string[]): Row {
  const columnList = Array.isArray(columns) ? columns : [columns]

  return columnList.reduce<Row>((next, columnExpression) => {
    const [rawColumn, rawAlias] = columnExpression.split(/\s+as\s+/i)
    const column = rawColumn?.trim() ?? ''
    const alias = rawAlias?.trim() ?? column.split('.').pop() ?? column

    return {
      ...next,
      [alias]: readColumnValue(row, column)
    }
  }, {})
}

class SelectBuilder {
  private readonly filters: Filter[] = []
  private rows: Row[]
  private orderByColumn: string | null = null
  private selectedColumns: string | string[] | null = null

  constructor(
    private readonly db: InMemoryDb,
    private readonly table: string
  ) {
    this.rows = db.readTable(table).map((row) => withQualifiedColumns(table, row))
  }

  select(columns: string | string[]) {
    this.selectedColumns = columns
    return this
  }

  selectAll() {
    this.selectedColumns = null
    return this
  }

  innerJoin(table: string, leftColumn: string, rightColumn: string) {
    const joinedRows = this.db.readTable(table)

    this.rows = this.rows.flatMap((leftRow) => {
      return joinedRows.flatMap((rightRow) => {
        const rightProjected = withQualifiedColumns(table, rightRow)
        const candidate = { ...leftRow, ...rightProjected }
        return readColumnValue(candidate, leftColumn) === readColumnValue(candidate, rightColumn)
          ? [candidate]
          : []
      })
    })

    return this
  }

  where(column: string, _op: string, value: unknown) {
    this.filters.push({ column, op: _op, value })
    return this
  }

  orderBy(column: string) {
    this.orderByColumn = column
    return this
  }

  forUpdate() {
    return this
  }

  async execute() {
    let rows = cloneRows(this.rows)

    for (const filter of this.filters) {
      rows = rows.filter((row) => matchesFilter(row, filter))
    }

    if (this.orderByColumn) {
      const column = this.orderByColumn
      rows.sort((left, right) => {
        const leftValue = readColumnValue(left, column) as number | string | null | undefined
        const rightValue = readColumnValue(right, column) as number | string | null | undefined
        if (leftValue === rightValue) return 0
        if (leftValue == null) return -1
        if (rightValue == null) return 1
        return leftValue < rightValue ? -1 : 1
      })
    }

    return this.selectedColumns ? rows.map((row) => projectSelectedColumns(row, this.selectedColumns!)) : rows
  }

  async executeTakeFirst() {
    return (await this.execute())[0]
  }
}

class DeleteBuilder {
  private readonly filters: Filter[] = []

  constructor(
    private readonly db: InMemoryDb,
    private readonly table: string
  ) {}

  where(column: string, _op: string, value: unknown) {
    this.filters.push({ column, op: _op, value })
    return this
  }

  async execute() {
    if (this.filters.length === 0) return
    this.db.deleteWhere(this.table, this.filters)
  }
}

class InsertBuilder {
  private rows: Row[] = []
  private conflictColumns = ['id']
  private conflictMode: ConflictMode = 'none'

  constructor(
    private readonly db: InMemoryDb,
    private readonly table: string
  ) {}

  values(rows: Row | Row[]) {
    this.rows = Array.isArray(rows) ? rows : [rows]
    return this
  }

  onConflict(
    handler: (builder: {
      column: (column: string) => {
        doNothing: () => unknown
        doUpdateSet: (_factory: unknown) => unknown
      }
      columns: (columns: string[]) => {
        doNothing: () => unknown
        doUpdateSet: (_factory: unknown) => unknown
      }
    }) => unknown
  ) {
    const conflictHandler = (columns: string[]) => {
      this.conflictColumns = columns
      return {
        doNothing: () => {
          this.conflictMode = 'doNothing'
          return this
        },
        doUpdateSet: (_factory: unknown) => {
          this.conflictMode = 'doUpdateSet'
          return this
        }
      }
    }

    handler({
      column: (column: string) => conflictHandler([column]),
      columns: (columns: string[]) => conflictHandler(columns)
    })

    return this
  }

  returning(_columns: string | string[]) {
    return this
  }

  async execute() {
    for (const row of this.rows) {
      this.db.insertRow(this.table, row, this.conflictColumns, this.conflictMode)
    }
  }

  async executeTakeFirstOrThrow() {
    await this.execute()
    if (this.rows.length === 0) {
      throw new Error(`No rows inserted into ${this.table}.`)
    }

    return this.rows[0]
  }
}

class InMemoryTransaction {
  constructor(private readonly db: InMemoryDb) {}

  startTransaction(): { execute: () => Promise<InMemoryTransaction> } {
    return {
      execute: async () => this
    }
  }

  selectFrom(table: string) {
    return new SelectBuilder(this.db, table)
  }

  insertInto(table: string) {
    return new InsertBuilder(this.db, table)
  }

  deleteFrom(table: string) {
    return new DeleteBuilder(this.db, table)
  }

  commit() {
    return {
      execute: async () => undefined
    }
  }

  rollback() {
    return {
      execute: async () => undefined
    }
  }
}

export class InMemoryDb {
  private readonly tables = new Map<string, Row[]>()

  startTransaction(): { execute: () => Promise<InMemoryTransaction> } {
    return {
      execute: async () => new InMemoryTransaction(this)
    }
  }

  selectFrom(table: string) {
    return new SelectBuilder(this, table)
  }

  insertInto(table: string) {
    return new InsertBuilder(this, table)
  }

  deleteFrom(table: string) {
    return new DeleteBuilder(this, table)
  }

  readTable(table: string): Row[] {
    return this.tables.get(table) ?? []
  }

  snapshot(table: string): Row[] {
    return cloneRows(this.readTable(table))
  }

  insertRow(
    table: string,
    row: Row,
    conflictColumns: string[],
    conflictMode: ConflictMode
  ) {
    const rows = this.readTable(table)
    const nextRow = { ...row }
    const existingIndex = rows.findIndex(
      (candidate) => conflictColumns.every((column) => candidate[column] === nextRow[column])
    )

    if (existingIndex >= 0) {
      if (conflictMode === 'doNothing') {
        return
      }

      if (conflictMode === 'doUpdateSet') {
        const previous = rows[existingIndex]
        rows[existingIndex] = nextRow
        this.tables.set(table, rows)
        this.onRowUpdated(table, previous, nextRow)
        return
      }
    }

    rows.push(nextRow)
    this.tables.set(table, rows)
  }

  deleteWhere(
    table: string,
    columnOrFilters: string | Filter[],
    value?: unknown
  ) {
    const filters = Array.isArray(columnOrFilters)
      ? columnOrFilters
      : [{ column: columnOrFilters, op: '=', value }]
    const rows = this.readTable(table)
    const kept: Row[] = []
    const removed: Row[] = []

    for (const row of rows) {
      if (filters.every((filter) => matchesFilter(row, filter))) {
        removed.push(row)
      } else {
        kept.push(row)
      }
    }

    this.tables.set(table, kept)

    for (const row of removed) {
      this.onRowDeleted(table, row)
    }
  }

  private onRowUpdated(table: string, previous: Row, next: Row) {
    if ('restriction_id' in previous || 'restriction_id' in next) {
      const previousRestrictionId = previous.restriction_id
      const nextRestrictionId = next.restriction_id

      if (previousRestrictionId && previousRestrictionId !== nextRestrictionId) {
        this.deleteWhere('facets', 'id', previousRestrictionId)
      }
    }

    if ('filter_id' in previous || 'filter_id' in next) {
      const previousFilterId = previous.filter_id
      const nextFilterId = next.filter_id

      if (previousFilterId && previousFilterId !== nextFilterId) {
        this.deleteWhere('facets', 'id', previousFilterId)
      }
    }

    if ('charge_id' in previous || 'charge_id' in next) {
      const previousChargeId = previous.charge_id
      const nextChargeId = next.charge_id

      if (previousChargeId && previousChargeId !== nextChargeId) {
        this.deleteWhere('charges', 'id', previousChargeId)
      }
    }

    if (table === 'backgrounds') {
      const previousStartingEquipmentId = previous.starting_equipment_id
      const nextStartingEquipmentId = next.starting_equipment_id

      if (
        previousStartingEquipmentId
        && previousStartingEquipmentId !== nextStartingEquipmentId
      ) {
        this.deleteWhere('starting_equipment', 'id', previousStartingEquipmentId)
      }
    }

    if (table === 'classes') {
      const previousStartingEquipmentId = previous.starting_equipment_id
      const nextStartingEquipmentId = next.starting_equipment_id

      if (
        previousStartingEquipmentId
        && previousStartingEquipmentId !== nextStartingEquipmentId
      ) {
        this.deleteWhere('starting_equipment', 'id', previousStartingEquipmentId)
      }
    }

    if (table === 'feats') {
      const previousChargeId = previous.charge_id
      const nextChargeId = next.charge_id
      const previousPrerequisiteId = previous.prerequisite_id
      const nextPrerequisiteId = next.prerequisite_id

      if (previousChargeId && previousChargeId !== nextChargeId) {
        this.deleteWhere('charges', 'id', previousChargeId)
      }

      if (previousPrerequisiteId && previousPrerequisiteId !== nextPrerequisiteId) {
        this.deleteWhere('facets', 'id', previousPrerequisiteId)
      }
    }

    if (table === 'equipment') {
      const previousChargeId = previous.charge_id
      const nextChargeId = next.charge_id

      if (previousChargeId && previousChargeId !== nextChargeId) {
        this.deleteWhere('charges', 'id', previousChargeId)
      }
    }

    if (table === 'features') {
      const previousChargeId = previous.charge_id
      const nextChargeId = next.charge_id

      if (previousChargeId && previousChargeId !== nextChargeId) {
        this.deleteWhere('charges', 'id', previousChargeId)
      }
    }

    if (table === 'options') {
      const previousChargeId = previous.charge_id
      const nextChargeId = next.charge_id

      if (previousChargeId && previousChargeId !== nextChargeId) {
        this.deleteWhere('charges', 'id', previousChargeId)
      }
    }
  }

  private onRowDeleted(table: string, row: Row) {
    switch (table) {
      case 'background_details':
        this.deleteWhere('details', 'id', row.detail_id)
        break

      case 'background_features':
        this.deleteWhere('features', 'id', row.feature_id)
        break

      case 'background_proficiency_grants':
        this.deleteWhere('proficiency_grants', 'id', row.proficiency_grant_id)
        break

      case 'class_details':
        this.deleteWhere('details', 'id', row.detail_id)
        break

      case 'class_proficiency_grants':
        this.deleteWhere('proficiency_grants', 'id', row.proficiency_grant_id)
        break

      case 'class_features':
        this.deleteWhere('features', 'id', row.feature_id)
        break

      case 'class_resources':
        this.deleteWhere('charges', 'id', row.charge_id)
        break

      case 'class_spellcasting':
        this.deleteWhere('charges', 'id', row.charge_id)
        this.deleteWhere('class_spellcasting_attributes', 'spellcasting_id', row.id)
        this.deleteWhere('class_spellcasting_details', 'spellcasting_id', row.id)
        this.deleteWhere('class_spellcasting_prepare_limit', 'spellcasting_id', row.id)
        this.deleteWhere('class_spellcasting_prepare_limit_methods', 'spellcasting_id', row.id)
        this.deleteWhere('class_spellcasting_prepare_limit_levels', 'spellcasting_id', row.id)
        this.deleteWhere('class_spell_limits', 'spellcasting_id', row.id)
        break

      case 'class_spellcasting_details':
        this.deleteWhere('details', 'id', row.detail_id)
        break

      case 'class_spell_limits':
        this.deleteWhere('class_spell_slots', 'spell_limit_id', row.id)
        break

      case 'class_multiclass':
        this.deleteWhere('class_multiclass_requirement_groups', 'multiclass_id', row.id)
        this.deleteWhere('class_multiclass_proficiency_grants', 'multiclass_id', row.id)
        break

      case 'class_multiclass_requirement_groups':
        this.deleteWhere('class_multiclass_requirements', 'requirement_group_id', row.id)
        break

      case 'class_multiclass_proficiency_grants':
        this.deleteWhere('proficiency_grants', 'id', row.proficiency_grant_id)
        break

      case 'creature_details':
        this.deleteWhere('details', 'id', row.detail_id)
        break

      case 'creature_features':
        this.deleteWhere('features', 'id', row.feature_id)
        break

      case 'creature_proficiency_grants':
        this.deleteWhere('proficiency_grants', 'id', row.proficiency_grant_id)
        break

      case 'creatures':
        this.deleteWhere('creature_details', 'creature_id', row.id)
        this.deleteWhere('creature_features', 'creature_id', row.id)
        this.deleteWhere('creature_proficiency_grants', 'creature_id', row.id)
        this.deleteWhere('creature_speeds', 'creature_id', row.id)
        this.deleteWhere('creature_actions', 'creature_id', row.id)
        this.deleteWhere('creature_damage_resistances', 'creature_id', row.id)
        this.deleteWhere('creature_damage_immunities', 'creature_id', row.id)
        this.deleteWhere('creature_damage_vulnerabilities', 'creature_id', row.id)
        this.deleteWhere('creature_condition_immunities', 'creature_id', row.id)
        break

      case 'features':
        if (row.charge_id) {
          this.deleteWhere('charges', 'id', row.charge_id)
        }
        if (row.restriction_id) {
          this.deleteWhere('facets', 'id', row.restriction_id)
        }
        this.deleteWhere('feature_attributes', 'feature_id', row.id)
        this.deleteWhere('feature_details', 'feature_id', row.id)
        this.deleteWhere('feature_effects', 'feature_id', row.id)
        this.deleteWhere('feature_feat_grants', 'feature_id', row.id)
        this.deleteWhere('feature_modifier_grants', 'feature_id', row.id)
        this.deleteWhere('feature_proficiency_grants', 'feature_id', row.id)
        this.deleteWhere('feature_sense_grants', 'feature_id', row.id)
        this.deleteWhere('feature_spell_grants', 'feature_id', row.id)
        this.deleteWhere('feature_options', 'feature_id', row.id)
        this.deleteWhere('feature_option_levels', 'feature_id', row.id)
        break

      case 'feature_details':
        this.deleteWhere('details', 'id', row.detail_id)
        break

      case 'feature_feat_grants':
        this.deleteWhere('feat_grants', 'id', row.feat_grant_id)
        break

      case 'feature_modifier_grants':
        this.deleteWhere('modifier_grants', 'id', row.modifier_grant_id)
        break

      case 'feature_proficiency_grants':
        this.deleteWhere('proficiency_grants', 'id', row.proficiency_grant_id)
        break

      case 'feature_sense_grants':
        this.deleteWhere('sense_grants', 'id', row.sense_grant_id)
        break

      case 'feature_spell_grants':
        this.deleteWhere('spell_grants', 'id', row.spell_grant_id)
        break

      case 'feature_effects':
        this.deleteWhere('effects', 'id', row.effect_id)
        break

      case 'effects':
        this.deleteWhere('effect_invocations', 'effect_id', row.id)
        this.deleteWhere('effect_paths', 'effect_id', row.id)
        break

      case 'saving_throws':
        this.deleteWhere('saving_throw_dc_bonuses', 'saving_throw_id', row.id)
        break

      case 'effect_invocations':
        if (row.range_characteristic_id) {
          this.deleteWhere('characteristics', 'id', row.range_characteristic_id)
        }
        if (row.shape_characteristic_id) {
          this.deleteWhere('characteristics', 'id', row.shape_characteristic_id)
        }
        if (row.saving_throw_id) {
          this.deleteWhere('saving_throws', 'id', row.saving_throw_id)
        }
        break

      case 'effect_paths':
        this.deleteWhere('effect_path_choice_options', 'path_id', row.id)
        this.deleteWhere('effect_path_roll_table_rows', 'path_id', row.id)
        if (row.result_block_id) {
          this.deleteWhere('effect_result_blocks', 'id', row.result_block_id)
        }
        if (row.range_override_characteristic_id) {
          this.deleteWhere('characteristics', 'id', row.range_override_characteristic_id)
        }
        break

      case 'effect_path_choice_options':
        this.deleteWhere('effect_result_blocks', 'id', row.result_block_id)
        break

      case 'effect_path_roll_table_rows':
        this.deleteWhere('effect_result_blocks', 'id', row.result_block_id)
        break

      case 'effect_result_blocks':
        this.deleteWhere('effect_result_block_outcomes', 'result_block_id', row.id)
        if (row.duration_id) {
          this.deleteWhere('characteristics', 'id', row.duration_id)
        }
        break

      case 'effect_result_block_outcomes':
        if (row.effect_kind === 'DAMAGE') {
          this.deleteWhere('damages', 'id', row.outcome_id)
        } else if (row.effect_kind === 'CONDITION') {
          this.deleteWhere('conditions', 'id', row.outcome_id)
        } else {
          this.deleteWhere('effect_generic_outcomes', 'id', row.outcome_id)
        }
        break

      case 'feature_options':
        this.deleteWhere('options', 'id', row.option_id)
        break

      case 'race_details':
        this.deleteWhere('details', 'id', row.detail_id)
        break

      case 'race_features':
        this.deleteWhere('features', 'id', row.feature_id)
        break

      case 'race_ancestries':
        this.deleteWhere('race_ancestry_options', 'ancestry_id', row.id)
        break

      case 'race_ancestry_options':
        this.deleteWhere('race_ancestry_option_features', 'ancestry_option_id', row.id)
        break

      case 'race_ancestry_option_features':
        this.deleteWhere('features', 'id', row.feature_id)
        break

      case 'feat_proficiency_grants':
        this.deleteWhere('proficiency_grants', 'id', row.proficiency_grant_id)
        break

      case 'feat_sense_grants':
        this.deleteWhere('sense_grants', 'id', row.sense_grant_id)
        break

      case 'feat_spell_grants':
        this.deleteWhere('spell_grants', 'id', row.spell_grant_id)
        break

      case 'feat_modifier_grants':
        this.deleteWhere('modifier_grants', 'id', row.modifier_grant_id)
        break

      case 'feat_effects':
        this.deleteWhere('effects', 'id', row.effect_id)
        break

      case 'feat_details':
        this.deleteWhere('details', 'id', row.detail_id)
        break

      case 'feat_features':
        this.deleteWhere('features', 'id', row.feature_id)
        break

      case 'feats':
        if (row.charge_id) {
          this.deleteWhere('charges', 'id', row.charge_id)
        }
        if (row.prerequisite_id) {
          this.deleteWhere('facets', 'id', row.prerequisite_id)
        }
        this.deleteWhere('feat_proficiency_grants', 'feat_id', row.id)
        this.deleteWhere('feat_details', 'feat_id', row.id)
        this.deleteWhere('feat_sense_grants', 'feat_id', row.id)
        this.deleteWhere('feat_spell_grants', 'feat_id', row.id)
        this.deleteWhere('feat_modifier_grants', 'feat_id', row.id)
        this.deleteWhere('feat_effects', 'feat_id', row.id)
        this.deleteWhere('feat_features', 'feat_id', row.id)
        break

      case 'spell_effects':
        this.deleteWhere('effects', 'id', row.effect_id)
        break

      case 'equipment_effects':
        this.deleteWhere('effects', 'id', row.effect_id)
        break

      case 'equipment_modifier_grants':
        this.deleteWhere('modifier_grants', 'id', row.modifier_grant_id)
        break

      case 'facets':
        this.deleteWhere('facet_groups', 'facet_id', row.id)
        break

      case 'facet_groups':
        this.deleteWhere('facet_contexts', 'facet_group_id', row.id)
        break

      case 'facet_contexts':
        this.deleteWhere('facet_context_bodies', 'facet_context_id', row.id)
        break

      case 'facet_context_bodies':
        this.deleteWhere('facet_bodies', 'id', row.facet_body_id)
        break

      case 'facet_bodies':
        this.deleteWhere('facet_body_selections', 'facet_body_id', row.id)
        this.deleteWhere('facet_body_selection_items', 'facet_body_id', row.id)
        this.deleteWhere('facet_body_groups', 'facet_body_id', row.id)
        break

      case 'facet_body_groups':
        this.deleteWhere('facet_conditions', 'facet_body_group_id', row.id)
        break

      case 'facet_conditions':
        if (row.where_facet_body_id) {
          this.deleteWhere('facet_bodies', 'id', row.where_facet_body_id)
        }
        this.deleteWhere('facet_exists_selections', 'facet_condition_id', row.id)
        this.deleteWhere('facet_exists_selection_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_selectables', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_numeric_ranges', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_ranges', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_durations', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_range_kind_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_duration_kind_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_equipment_categories', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_proficiency_levels', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_ability_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_equipment_property_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_skill_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_language_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_magic_school_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_damage_type_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_condition_type_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_subclass_specialization_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_size_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_charge_limit_kind_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_charge_reset_kind_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_spell_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_feat_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_heritage_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_feature_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_option_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_equipment_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_creature_record_kind_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_creature_category_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_vehicle_category_items', 'facet_condition_id', row.id)
        this.deleteWhere('facet_predicate_creature_type_items', 'facet_condition_id', row.id)
        break

      case 'equipment_features':
        this.deleteWhere('features', 'id', row.feature_id)
        break

      case 'equipment':
        if (row.charge_id) {
          this.deleteWhere('charges', 'id', row.charge_id)
        }
        if (row.restriction_id) {
          this.deleteWhere('facets', 'id', row.restriction_id)
        }
        this.deleteWhere('equipment_attributes', 'equipment_id', row.id)
        this.deleteWhere('equipment_properties', 'equipment_id', row.id)
        this.deleteWhere('equipment_effects', 'equipment_id', row.id)
        this.deleteWhere('equipment_modifier_grants', 'equipment_id', row.id)
        this.deleteWhere('equipment_features', 'equipment_id', row.id)
        this.deleteWhere('equipment_contains', 'equipment_id', row.id)
        break

      case 'vehicle_details':
        this.deleteWhere('details', 'id', row.detail_id)
        break

      case 'vehicle_features':
        this.deleteWhere('features', 'id', row.feature_id)
        break

      case 'vehicles':
        this.deleteWhere('vehicle_details', 'vehicle_id', row.id)
        this.deleteWhere('vehicle_features', 'vehicle_id', row.id)
        break

      case 'options':
        if (row.charge_id) {
          this.deleteWhere('charges', 'id', row.charge_id)
        }
        if (row.restriction_id) {
          this.deleteWhere('facets', 'id', row.restriction_id)
        }
        this.deleteWhere('option_attributes', 'option_id', row.id)
        this.deleteWhere('option_details', 'option_id', row.id)
        this.deleteWhere('option_effects', 'option_id', row.id)
        this.deleteWhere('option_feat_grants', 'option_id', row.id)
        this.deleteWhere('option_modifier_grants', 'option_id', row.id)
        this.deleteWhere('option_proficiency_grants', 'option_id', row.id)
        this.deleteWhere('option_sense_grants', 'option_id', row.id)
        this.deleteWhere('option_spell_grants', 'option_id', row.id)
        break

      case 'option_feat_grants':
        this.deleteWhere('feat_grants', 'id', row.feat_grant_id)
        break

      case 'option_modifier_grants':
        this.deleteWhere('modifier_grants', 'id', row.modifier_grant_id)
        break

      case 'option_proficiency_grants':
        this.deleteWhere('proficiency_grants', 'id', row.proficiency_grant_id)
        break

      case 'option_sense_grants':
        this.deleteWhere('sense_grants', 'id', row.sense_grant_id)
        break

      case 'option_spell_grants':
        this.deleteWhere('spell_grants', 'id', row.spell_grant_id)
        break

      case 'option_effects':
        this.deleteWhere('effects', 'id', row.effect_id)
        break

      case 'option_details':
        this.deleteWhere('details', 'id', row.detail_id)
        break

      case 'proficiency_grants':
        if (row.restriction_id) {
          this.deleteWhere('facets', 'id', row.restriction_id)
        }
        this.deleteWhere('proficiency_grant_skills', 'proficiency_grant_id', row.id)
        this.deleteWhere('proficiency_grant_save_abilities', 'proficiency_grant_id', row.id)
        this.deleteWhere('proficiency_grant_languages', 'proficiency_grant_id', row.id)
        this.deleteWhere('proficiency_grant_equipment', 'proficiency_grant_id', row.id)
        this.deleteWhere('proficiency_grant_equipment_filter_properties', 'proficiency_grant_id', row.id)
        this.deleteWhere('proficiency_grant_equipment_filters', 'proficiency_grant_id', row.id)
        this.deleteWhere('proficiency_grant_equipment_properties', 'proficiency_grant_id', row.id)
        this.deleteWhere('proficiency_grant_equipment_property_filters', 'proficiency_grant_id', row.id)
        break

      case 'starting_equipment':
        this.deleteWhere('starting_equipment_sets', 'starting_equipment_id', row.id)
        break

      case 'starting_equipment_sets':
        this.deleteWhere('starting_equipment_groups', 'equipment_set_id', row.id)
        break

      case 'starting_equipment_groups':
        this.deleteWhere('starting_equipment_options', 'equipment_group_id', row.id)
        break

      case 'starting_equipment_options':
        this.deleteWhere('starting_equipment_option_items', 'equipment_option_id', row.id)
        break

      case 'starting_equipment_option_items':
        this.deleteWhere('starting_equipment_option_item_equipment', 'option_item_id', row.id)
        this.deleteWhere('starting_equipment_option_item_properties', 'option_item_id', row.id)
        this.deleteWhere('starting_equipment_currencies', 'option_item_id', row.id)
        break

      case 'feat_grant_scaling_levels':
        this.deleteWhere('feat_grant_scaling_level_feats', 'scaling_level_id', row.id)
        break

      case 'feat_grants':
        if (row.charge_id) {
          this.deleteWhere('charges', 'id', row.charge_id)
        }
        if (row.restriction_id) {
          this.deleteWhere('facets', 'id', row.restriction_id)
        }
        this.deleteWhere('feat_grant_feats', 'feat_grant_id', row.id)
        this.deleteWhere('feat_grant_scaling_levels', 'feat_grant_id', row.id)
        break

      case 'sense_grant_scaling_levels':
        this.deleteWhere('sense_grant_scaling_level_senses', 'scaling_level_id', row.id)
        break

      case 'sense_grants':
        if (row.charge_id) {
          this.deleteWhere('charges', 'id', row.charge_id)
        }
        if (row.restriction_id) {
          this.deleteWhere('facets', 'id', row.restriction_id)
        }
        this.deleteWhere('sense_grant_senses', 'sense_grant_id', row.id)
        this.deleteWhere('sense_grant_scaling_levels', 'sense_grant_id', row.id)
        break

      case 'spell_grant_scaling_levels':
        this.deleteWhere('spell_grant_scaling_level_spells', 'scaling_level_id', row.id)
        break

      case 'spell_grants':
        if (row.charge_id) {
          this.deleteWhere('charges', 'id', row.charge_id)
        }
        if (row.restriction_id) {
          this.deleteWhere('facets', 'id', row.restriction_id)
        }
        if (row.filter_id) {
          this.deleteWhere('facets', 'id', row.filter_id)
        }
        this.deleteWhere('spell_grant_attributes', 'spell_grant_id', row.id)
        this.deleteWhere('spell_grant_spells', 'spell_grant_id', row.id)
        this.deleteWhere('spell_grant_scaling_levels', 'spell_grant_id', row.id)
        break

      case 'modifier_grants':
        if (row.restriction_id) {
          this.deleteWhere('facets', 'id', row.restriction_id)
        }
        this.deleteWhere('modifier_grant_domain_params', 'modifier_grant_id', row.id)
        this.deleteWhere('modifier_grant_payloads', 'modifier_grant_id', row.id)
        this.deleteWhere('modifier_grant_optional_abilities', 'modifier_grant_id', row.id)
        this.deleteWhere('modifier_grant_charge_levels', 'modifier_grant_id', row.id)
        break

      case 'modifier_grant_payloads':
        this.deleteWhere('modifier_grant_charge_levels', 'modifier_grant_id', row.modifier_grant_id)
        break

      case 'charges':
        this.deleteWhere('charge_limits', 'charge_id', row.id)
        this.deleteWhere('charge_scaling_levels', 'charge_id', row.id)
        this.deleteWhere('charge_bonuses', 'charge_id', row.id)
        break
    }
  }
}
