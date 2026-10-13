import { createServer } from "node:http"

import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import * as Api from "@personalos/api"
import * as Config from "effect/Config"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as HttpRouter from "effect/http/HttpRouter"
import * as Layer from "effect/Layer"

import * as Problem from "./problem.ts"
import * as System from "./system.ts"

const Server = HttpApiBuilder.layer(Api.Api, { openapiPath: "/openapi.json" }).pipe(
  Layer.provide([Problem.Live, System.Live]),
  HttpRouter.serve,
  Layer.provide(AnthropicClient.layerConfig({ apiKey: Config.Redacted("ANTHROPIC_API_KEY") })),
  Layer.provide(FetchHttpClient.layer),
  Layer.provide(
    NodeHttpServer.layerConfig(createServer, {
      port: Config.Port("PORT").pipe(Config.withDefault(3000)),
    }),
  ),
)

NodeRuntime.runMain(Layer.launch(Server))
