import * as HttpApi from "effect/http-api/HttpApi"
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiSchema from "effect/http-api/HttpApiSchema"
import * as Multipart from "effect/http/Multipart"
import * as Schema from "effect/Schema"

import * as Problem from "./problem.ts"

export class SystemApi extends HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", { success: HttpApiSchema.NoContent }),
) {}

export class ProblemApi extends HttpApiGroup.make("problem")
  .add(
    HttpApiEndpoint.post("upload_problem_hwpx", "/upload-hwpx", {
      payload: HttpApiSchema.asMultipart()(Schema.Struct({ file: Multipart.SingleFileSchema })),
      success: Problem.IdSchema,
      error: Problem.InvalidHwpxError.pipe(HttpApiSchema.status("UnprocessableEntity")),
    }),
    /** 해설 원고 for a stored problem, formatted and linted. */
    HttpApiEndpoint.get("generate_solution_text", "/:id/generate-solution-text", {
      params: { id: Problem.IdSchema },
      success: Problem.ManuscriptSchema,
      error: [
        Problem.NotFoundError.pipe(HttpApiSchema.status("NotFound")),
        Problem.SolutionGenerationError.pipe(HttpApiSchema.status("BadGateway")),
      ],
    }),
    /**
     * Photo of a problem (jpeg/png/webp/gif) -> manuscript: text as lines, math
     * as `$...$` in 한글 수식 syntax, formatted and linted.
     */
    HttpApiEndpoint.post("transcribe_image", "/transcribe-image", {
      payload: HttpApiSchema.asMultipart({ maxFileSize: "20 MiB" })(
        Schema.Struct({ image: Multipart.SingleFileSchema }),
      ),
      success: Problem.ManuscriptSchema,
      error: [
        Problem.UnsupportedImageError.pipe(HttpApiSchema.status("UnprocessableEntity")),
        Problem.TranscriptionError.pipe(HttpApiSchema.status("BadGateway")),
      ],
    }),
    /** Manuscript text -> .hwpx with one paragraph per line and 한글 equation objects. */
    HttpApiEndpoint.post("manuscript_to_hwpx", "/manuscript-to-hwpx", {
      payload: Schema.Struct({ text: Schema.String }),
      success: Schema.Uint8Array.pipe(
        HttpApiSchema.asUint8Array({ contentType: "application/hwp+zip" }),
      ),
      error: Problem.HwpxBuildError.pipe(HttpApiSchema.status("InternalServerError")),
    }),
  )
  // `prefix` only applies to endpoints added before it is called.
  .prefix("/problem") {}

export class Api extends HttpApi.make("api").add(SystemApi).add(ProblemApi) {}
