import { createServer } from "node:http"

import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Api } from "@template/api"
import * as Config from "effect/Config"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"

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
