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

/**
 * The uploaded file could not be parsed as an HWP/HWPX document, or it
 * contains no problem text.
 */
export class InvalidHwpxError extends Schema.TaggedError<InvalidHwpxError>()("InvalidHwpxError", {
  message: Schema.String,
}) {}

/**
 * No problem is stored under the requested id.
 */
export class NotFoundError extends Schema.TaggedError<NotFoundError>()("ProblemNotFoundError", {
  id: IdSchema,
}) {}

/**
 * The language model failed to produce a solution text.
 */
export class SolutionGenerationError extends Schema.TaggedError<SolutionGenerationError>()(
  "SolutionGenerationError",
  { message: Schema.String },
) {}
