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

/**
 * The uploaded image is not a type the vision model accepts.
 */
export class UnsupportedImageError extends Schema.TaggedError<UnsupportedImageError>()(
  "UnsupportedImageError",
  { message: Schema.String },
) {}

/**
 * The vision model failed to transcribe the problem photo, or the transcript
 * could not be turned into a document.
 */
export class TranscriptionError extends Schema.TaggedError<TranscriptionError>()(
  "TranscriptionError",
  { message: Schema.String },
) {}
