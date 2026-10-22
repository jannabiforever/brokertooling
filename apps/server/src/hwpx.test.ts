import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { describe, expect } from "vitest"

import * as Hwpx from "./hwpx.ts"

describe("Hwpx", () => {
  it.effect("turns $…$ spans into equation objects and the rest into text", () =>
    Effect.gen(function* () {
      yield* Effect.void
      let id = 7
      const xml = Hwpx.runs("함수 $f LEFT( x RIGHT)`$의 값은? <단>", () => id++)
      expect(xml).toMatch(/^<hp:t>함수 <\/hp:t><hp:equation id="7" /)
      expect(xml).toContain("<hp:script>f LEFT( x RIGHT)`</hp:script>")
      expect(xml).toMatch(/<hp:t>의 값은\? &lt;단&gt;<\/hp:t>$/)
      expect(Hwpx.runs("", () => id++)).toBe("")
    }),
  )

  it.effect("writes an OCF zip with a stored mimetype first", () =>
    Effect.gen(function* () {
      yield* Effect.void
      const bytes = Buffer.from(Hwpx.fromManuscript("1. $1+1$\n\n① $2$\n"))
      expect(bytes.subarray(0, 4).toString("latin1")).toBe("PK\x03\x04")
      expect(bytes.readUInt16LE(8)).toBe(0) // stored, not deflated
      expect(bytes.subarray(30, 38).toString()).toBe("mimetype")
      expect(bytes.subarray(38, 57).toString()).toBe("application/hwp+zip")
      expect(bytes.readUInt16LE(bytes.length - 12)).toBe(8) // 8 entries in the central directory
    }),
  )
})
