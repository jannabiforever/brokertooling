import { it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import { describe, expect } from "vitest"

import * as Figure from "./figure.ts"

describe("Figure", () => {
  it.effect("collects [그림: …] notes, not tables or prose", () =>
    Effect.gen(function* () {
      yield* Effect.void
      const manuscript = [
        "본문 [그림 1]과 같이",
        "  [그림 1: 포물선과 접선]  ",
        "[표: 2x3]",
        "[그림: 원과 현]",
        "[그림 1: 포물선과 접선]",
      ].join("\n")
      expect(Figure.notes(manuscript)).toEqual(["[그림 1: 포물선과 접선]", "[그림: 원과 현]"])
    }),
  )

  it.effect("accepts fenced static SVG and rejects anything that could run or load", () =>
    Effect.gen(function* () {
      yield* Effect.void
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3"/></svg>'
      expect(Figure.svgFromResponse("```svg\n" + svg + "\n```\n")).toBe(svg)
      expect(Figure.svgFromResponse("여기 그림입니다: " + svg)).toBeUndefined()
      expect(
        Figure.svgFromResponse(svg.replace("<rect", "<script>1</script><rect")),
      ).toBeUndefined()
      expect(
        Figure.svgFromResponse(svg.replace("<rect", '<image href="x.png"/><rect')),
      ).toBeUndefined()
      expect(Figure.svgFromResponse(svg.replace("<rect", '<rect onload="1"'))).toBeUndefined()
    }),
  )
})
