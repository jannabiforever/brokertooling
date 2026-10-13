import { ApiClient } from "@personalos/api"
import type * as Effect from "effect/Effect"
import * as FetchHttpClient from "effect/http/FetchHttpClient"
import * as Layer from "effect/Layer"
import * as ManagedRuntime from "effect/ManagedRuntime"

// One app-wide runtime bridging Effect code and the Svelte UI. No baseUrl:
// requests stay relative so the Vite dev proxy forwards them to the server.
export const runtime = ManagedRuntime.make(
  ApiClient.layer().pipe(Layer.provide(FetchHttpClient.layer)),
)

/** Runs an {@link ApiClient} call and exposes it to the UI as a Promise. */
export const api = <A, E>(f: (client: ApiClient["Service"]) => Effect.Effect<A, E>): Promise<A> =>
  runtime.runPromise(ApiClient.use(f))
