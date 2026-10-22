import { fileURLToPath } from "node:url"

import * as Api from "@personalos/api"
import * as rhwp from "@rhwp/core"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

declare global {
  /** rhwp's WASM calls back into this host hook to measure text runs. */
  // eslint-disable-next-line no-var
  var measureTextWidth: ((font: string, text: string) => number) | undefined
}

/**
 * `getStructure` returns JSON whose `preamble` field holds the paragraphs
 * before the first recognized structure node -- for a problem file, that is the
 * problem text itself.
 */
const StructureSchema = Schema.fromJsonString(
  Schema.Struct({ preamble: Schema.Array(Schema.String) }),
)

const decodeStructure = Schema.decodeUnknownEffect(StructureSchema)

/** rhwp edit calls return JSON; `{"ok":false,...}` is a soft failure. */
const check = (result: string): void => {
  if (result.startsWith('{"ok":false')) throw new Error(result)
}

/**
 * Manuscript -> document: one line = one paragraph, `$...$` = equation object
 * (script in 한글 수식 편집기 syntax). Same convention as the 해설 원고 files.
 */
const buildDocument = (manuscript: string): Uint8Array => {
  const doc = rhwp.HwpDocument.createEmpty()
  try {
    // Hancom's bundled blank template: carries the section/column definitions
    // that `createEmpty` leaves out and Hancom insists on.
    doc.createBlankDocument()
    const lines = manuscript
      .replace(/^```[^\n]*\n|\n```\s*$/g, "") // models sometimes fence the output
      .trimEnd()
      .split(/\r?\n/)
    lines.forEach((line, para) => {
      if (para > 0) check(doc.insertParagraph(0, para))
      // Equations anchor to a text offset, and text inserted at that offset lands
      // in front of them -- so write the whole text first, then place equations.
      const equations: Array<readonly [offset: number, script: string]> = []
      let text = ""
      line.split("$").forEach((piece, i) => {
        if (i % 2 === 1) equations.push([text.length, piece.trim()])
        else text += piece
      })
      if (text !== "") check(doc.insertText(0, para, 0, text))
      for (const [offset, script] of equations) {
        check(doc.insertEquation(0, para, offset, script, 1000, 0)) // 10pt, black
      }
    })
    return doc.exportHwpx()
  } finally {
    doc.free()
  }
}

const fromManuscript = (manuscript: string) =>
  Effect.try({
    try: () => buildDocument(manuscript),
    catch: (cause) =>
      new Api.Problem.TranscriptionError({
        message: `hwpx 생성에 실패했습니다: ${String(cause)}`,
      }),
  })

/**
 * Wraps the `@rhwp/core` WASM document engine. The layer initializes the WASM
 * module once per process; rhwp is browser-first, so a crude `measureTextWidth`
 * stub is installed -- layout fidelity is irrelevant for text extraction, and
 * Hancom re-lays out the files we write.
 */
export class Hwpx extends Context.Service<
  Hwpx,
  {
    /** Parses HWP/HWPX bytes and returns the structure preamble as one text. */
    readonly extractPreamble: (
      bytes: Uint8Array,
    ) => Effect.Effect<string, Api.Problem.InvalidHwpxError>
    /** Builds a .hwpx from a manuscript: one line = one paragraph, `$...$` = equation. */
    readonly fromManuscript: (
      manuscript: string,
    ) => Effect.Effect<Uint8Array, Api.Problem.TranscriptionError>
  }
>()("@personalos/server/hwpx") {
  static readonly layer = Layer.effect(
    Hwpx,
    Effect.gen(function* () {
      globalThis.measureTextWidth ??= (_font, text) => text.length * 8

      const fs = yield* FileSystem.FileSystem
      const wasmPath = fileURLToPath(import.meta.resolve("@rhwp/core/rhwp_bg.wasm"))
      const wasmBytes = yield* fs.readFile(wasmPath).pipe(Effect.orDie)
      // A failed WASM init is a startup defect, not a recoverable error.
      yield* Effect.promise(() => rhwp.default({ module_or_path: wasmBytes }))

      const extractPreamble = Effect.fnUntraced(function* (bytes: Uint8Array) {
        const structureJson = yield* Effect.try({
          try: () => {
            const doc = new rhwp.HwpDocument(bytes)
            try {
              return doc.getStructure("auto")
            } finally {
              doc.free()
            }
          },
          catch: (cause) =>
            new Api.Problem.InvalidHwpxError({
              message: `문서를 파싱하지 못했습니다: ${String(cause)}`,
            }),
        })
        const structure = yield* decodeStructure(structureJson).pipe(
          Effect.mapError(
            (error) =>
              new Api.Problem.InvalidHwpxError({
                message: `구조 분석 결과를 해석하지 못했습니다: ${error.message}`,
              }),
          ),
        )
        const preamble = structure.preamble.map((line) => line.trim()).filter((line) => line !== "")
        if (preamble.length === 0) {
          return yield* new Api.Problem.InvalidHwpxError({
            message: "문서 구조의 preamble에서 문제 본문을 찾지 못했습니다.",
          })
        }
        return preamble.join("\n")
      })

      return { extractPreamble, fromManuscript }
    }),
  )
}
