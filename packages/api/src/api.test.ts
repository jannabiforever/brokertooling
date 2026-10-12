import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { describe, expect } from "vitest"

import { Api } from "./api.ts"

describe("Api", () => {
  it.effect("exposes the system group", () =>
    Effect.gen(function* () {
      yield* Effect.void
      expect(Object.keys(Api.groups)).toContain("system")
    }),
  )
})
