import { pipe } from "effect"
import * as Schema from "effect/Schema"

/**
 * A branded ProblemId schema
 */
export const IdSchema = pipe(Schema.String, Schema.brand("ProblemId"))
/**
 * A branded ProblemId type
 */
export type Id = (typeof IdSchema)["Type"]
