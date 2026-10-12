import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/http-api"

export class SystemApi extends HttpApiGroup.make("system", { topLevel: true }).add(
  HttpApiEndpoint.get("health", "/health", { success: HttpApiSchema.NoContent }),
) {}

// new domain = packages/api/src/<d>.ts + apps/server/src/<d>.ts + barrel line + Layer.provide entry
export class Api extends HttpApi.make("api").add(SystemApi) {}
