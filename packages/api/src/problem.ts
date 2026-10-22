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

/**
 * One lint finding on a manuscript line; rule names match the skill's check.py.
 */
export const WarningSchema = Schema.Struct({
  line: Schema.Int,
  rule: Schema.String,
  text: Schema.String,
})
export type Warning = (typeof WarningSchema)["Type"]

/**
 * Manuscript text (one line = one paragraph, `$…$` = equation) after the
 * format pass, with the lint warnings the author should look at.
 */
export const ManuscriptSchema = Schema.Struct({
  text: Schema.String,
  warnings: Schema.Array(WarningSchema),
})
export type Manuscript = (typeof ManuscriptSchema)["Type"]

/**
 * The manuscript could not be turned into a .hwpx document.
 */
export class HwpxBuildError extends Schema.TaggedError<HwpxBuildError>()("HwpxBuildError", {
  message: Schema.String,
}) {}

/**
 * A figure for one `[그림: …]` line of a manuscript: the line itself (the key
 * the builder matches on) and SVG markup.
 */
export const FigureSchema = Schema.Struct({ note: Schema.String, svg: Schema.String })
export type Figure = (typeof FigureSchema)["Type"]

/**
 * The figure agent did not return usable SVG.
 */
export class FigureGenerationError extends Schema.TaggedError<FigureGenerationError>()(
  "FigureGenerationError",
  { message: Schema.String },
) {}
