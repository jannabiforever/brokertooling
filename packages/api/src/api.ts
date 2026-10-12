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
  .prefix("/problem")
  .add(
    HttpApiEndpoint.post("upload-problem-hwpx", "/upload-hwpx", {
      payload: HttpApiSchema.asMultipart()(Schema.Struct({ file: Multipart.SingleFileSchema })),
      success: Problem.IdSchema,
    }),
  ) {}

// new domain = packages/api/src/<d>.ts + apps/server/src/<d>.ts + barrel line + Layer.provide entry
export class Api extends HttpApi.make("api").add(SystemApi).add(ProblemApi) {}
