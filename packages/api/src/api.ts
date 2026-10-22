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
    HttpApiEndpoint.get("generate_solution_text", "/:id/generate-solution-text", {
      params: { id: Problem.IdSchema },
      success: Schema.String,
      error: [
        Problem.NotFoundError.pipe(HttpApiSchema.status("NotFound")),
        Problem.SolutionGenerationError.pipe(HttpApiSchema.status("BadGateway")),
      ],
    }),
  )
  // `prefix` only applies to endpoints added before it is called.
  .prefix("/problem") {}

export class Api extends HttpApi.make("api").add(SystemApi).add(ProblemApi) {}
