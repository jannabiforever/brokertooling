import { NodeHttpServer, NodeRuntime } from "@effect/platform-node"
import { Config, Layer } from "effect"
import { HttpRouter } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { createServer } from "node:http"
import { Api } from "@template/api"
import { SystemLayer } from "./system.ts"

// handler layers go in as an inline tuple literal: a named array widens to a
// union and loses the per-group types
const Server = HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }).pipe(
  HttpRouter.serve,
  Layer.provide([SystemLayer]),
  Layer.provide(
    NodeHttpServer.layerConfig(createServer, {
      port: Config.Port("PORT").pipe(Config.withDefault(3000)),
    }),
  ),
)

NodeRuntime.runMain(Layer.launch(Server))
