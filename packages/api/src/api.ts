import * as HttpApi from "effect/http-api/HttpApi"
import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint"
import * as HttpApiError from "effect/http-api/HttpApiError"
import * as HttpApiGroup from "effect/http-api/HttpApiGroup"
import * as HttpApiSchema from "effect/http-api/HttpApiSchema"
import * as Multipart from "effect/http/Multipart"
import * as Schema from "effect/Schema"

import * as Problem from "./problem.ts"

export class SystemApi extends HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", { success: HttpApiSchema.NoContent }),
) {}

export class ProblemApi extends HttpApiGroup.make("problem")
  .prefix("/problem")
  .add(
    HttpApiEndpoint.post("upload-problem-hwpx", "/upload-hwpx", {
      payload: HttpApiSchema.asMultipart()(Schema.Struct({ file: Multipart.SingleFileSchema })),
      success: Problem.IdSchema,
    }),
    HttpApiEndpoint.get("generate-solution-text", "/:id/generate-solution-text", {
      params: { id: Problem.IdSchema },
      success: Schema.String,
    }),
    /**
     * Photo of a problem (jpeg/png/webp/gif) -> .hwpx with the text as paragraphs
     * and the math as 한글 equation objects.
     * 422: unsupported image type · 500: the vision model call failed.
     */
    HttpApiEndpoint.post("image-to-hwpx", "/image-to-hwpx", {
      payload: HttpApiSchema.asMultipart({ maxFileSize: "20 MiB" })(
        Schema.Struct({ image: Multipart.SingleFileSchema }),
      ),
      success: Schema.Uint8Array.pipe(
        HttpApiSchema.asUint8Array({ contentType: "application/hwp+zip" }),
      ),
      error: Schema.Union([HttpApiError.UnprocessableEntity, HttpApiError.InternalServerError]),
    }),
  ) {}

export class Api extends HttpApi.make("api").add(SystemApi).add(ProblemApi) {}
