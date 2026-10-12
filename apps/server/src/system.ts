import { Api } from "@template/api"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"

export const SystemLayer = HttpApiBuilder.group(Api, "system", (handlers) =>
  handlers.handleAll({ health: () => Effect.void }),
)
