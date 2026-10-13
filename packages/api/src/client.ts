import * as Context from "effect/Context"
import * as HttpApiClient from "effect/http-api/HttpApiClient"
import * as Layer from "effect/Layer"

import * as Api from "./api.ts"

/**
 * A type-safe client for {@link Api}, derived from the contract.
 *
 * Requires an `HttpClient` implementation (e.g. `FetchHttpClient.layer`).
 */
export class ApiClient extends Context.Service<ApiClient, HttpApiClient.ForApi<typeof Api.Api>>()(
  "@template/api/client/ApiClient",
) {
  /**
   * Builds the client layer.
   *
   * Omit `baseUrl` for relative requests (the browser case, where the Vite
   * dev proxy forwards API routes to the server); set it when calling from
   * another origin, e.g. `ApiClient.layer({ baseUrl: "http://localhost:3000" })`.
   */
  static readonly layer = (options?: { readonly baseUrl?: URL | string | undefined }) =>
    Layer.effect(ApiClient, HttpApiClient.make(Api.Api, options))
}
