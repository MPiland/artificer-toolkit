import { v, type Validator } from 'convex/values'
import { zodToConvex } from 'convex-helpers/server/zod4'
import {
  characterSheetCommandInputDtoSchema,
  type CharacterSheetCommandInputDto
} from '@artificer-toolkit/schema/api/characterSheetCommands'

/**
 * The command union's Convex validator, converted member by member and annotated with the DTO type
 * it validates. Converting the whole union at once recurses once per member in the type system and
 * overflows the compiler's instantiation depth (TS2589) as commands are added.
 */
export const characterSheetCommandValidator: Validator<
  CharacterSheetCommandInputDto,
  'required',
  string
> = v.union(
  ...characterSheetCommandInputDtoSchema._zod.def.options.map((member) => zodToConvex(member))
)
