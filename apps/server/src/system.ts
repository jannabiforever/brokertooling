import * as Api from "@personalos/api"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"

export const Live = HttpApiBuilder.group(Api.Api, "system", (handlers) =>
  handlers.handleAll({ health: () => Effect.void }),
)
