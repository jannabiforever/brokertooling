import { Api } from "@template/api"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"

export const ProblemLayer = HttpApiBuilder.group(Api, "problem", (handlers) =>
  handlers.handleAll({
    // ponytail: placeholder so the api compiles; the multipart layer already
    // persists the upload to ctx.payload.file.path, parsing the hwpx goes here
    "upload-problem-hwpx": () => Effect.die("upload-problem-hwpx: not implemented"),
  }),
)
