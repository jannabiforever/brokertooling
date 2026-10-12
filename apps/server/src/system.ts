import { Effect } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "@template/api"

export const SystemLayer = HttpApiBuilder.group(Api, "system", (handlers) =>
  handlers.handleAll({ health: () => Effect.void }),
)
