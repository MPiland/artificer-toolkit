import { v, type Validator } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  characterSheetCommandInputDtoSchema,
  type CharacterSheetCommandInputDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'

/**
 * The command union's Convex validator, converted member by member and annotated with the DTO type
 * it validates. Converting the whole union at once recurses once per member in the type system and
 * overflows the compiler's instantiation depth (TS2589) as commands are added. It is built on call,
 * inside a lazy `args`, because every module that imports it is evaluated on every call (PERF-6).
 */
export function characterSheetCommandValidator(): Validator<
  CharacterSheetCommandInputDto,
  'required',
  string
> {
  return v.union(
    ...characterSheetCommandInputDtoSchema._zod.def.options.map((member) => zodToConvex(member))
  )
}
