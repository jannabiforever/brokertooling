import { inflateRawSync } from "node:zlib"

import * as NodeServices from "@effect/platform-node/NodeServices"
import { layer } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import { expect } from "vitest"

import { Hwpx } from "./hwpx.ts"

/** Reads one entry of a zip by walking its central directory. */
const zipEntry = (zip: Uint8Array, name: string): string => {
  const buf = Buffer.from(zip)
  let pos = buf.readUInt32LE(buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06])) + 16)
  while (buf.readUInt32LE(pos) === 0x02014b50) {
    const nameLength = buf.readUInt16LE(pos + 28)
    if (buf.toString("utf8", pos + 46, pos + 46 + nameLength) === name) {
      const method = buf.readUInt16LE(pos + 10)
      const size = buf.readUInt32LE(pos + 20)
      const local = buf.readUInt32LE(pos + 42)
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
      const data = buf.subarray(start, start + size)
      return (method === 8 ? inflateRawSync(data) : data).toString("utf8")
    }
    pos += 46 + nameLength + buf.readUInt16LE(pos + 30) + buf.readUInt16LE(pos + 32)
  }
  throw new Error(`${name} not in zip`)
}

/** Text and equation scripts of a paragraph, in document order. */
const inline = (paragraph: string): Array<string> =>
  Array.from(
    paragraph.matchAll(/<hp:t>([^<]*)<\/hp:t>|<hp:script>([^<]*)<\/hp:script>/g),
    (m) => m[1] ?? m[2] ?? "",
  ).filter((s) => s !== "")

layer(Hwpx.layer.pipe(Layer.provide(NodeServices.layer)))("Hwpx", (it) => {
  it.effect("writes one paragraph per line, equations interleaved at their text offsets", () =>
    Effect.gen(function* () {
      const hwpx = yield* Hwpx
      const bytes = yield* hwpx.fromManuscript(
        "12. [3점]\n함수 $f LEFT( x RIGHT)`$의 값은? $cdots$ ㉠\n\n① $-2$",
      )
      expect(zipEntry(bytes, "mimetype")).toBe("application/hwp+zip")
      const paragraphs = zipEntry(bytes, "Contents/section0.xml").split("<hp:p ").slice(1)
      expect(paragraphs.map(inline)).toEqual([
        ["12. [3점]"],
        ["함수 ", "f LEFT( x RIGHT)`", "의 값은? ", "cdots", " ㉠"],
        [],
        ["① ", "-2"],
      ])
      expect(paragraphs[0]).toContain("<hp:secPr ") // Hancom needs the section definition
    }),
  )

  it.effect("swaps a [그림: …] line for its figure, rasterized and anchored in the text", () =>
    Effect.gen(function* () {
      const hwpx = yield* Hwpx
      const svg =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect width="400" height="200" fill="white"/><circle cx="200" cy="100" r="50"/></svg>'
      const bytes = yield* hwpx.fromManuscript("앞\n[그림: 원]\n뒤", [{ note: "[그림: 원]", svg }])
      const paragraphs = zipEntry(bytes, "Contents/section0.xml").split("<hp:p ").slice(1)
      expect(paragraphs.map(inline)).toEqual([["앞"], [], ["뒤"]])
      expect(paragraphs[1]).toMatch(/<hp:pic .*treatAsChar="1"/)
      expect(zipEntry(bytes, "BinData/image1.png").slice(1, 4)).toBe("PNG")
    }),
  )
})
