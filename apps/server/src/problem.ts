import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as Api from "@personalos/api"
import * as rhwp from "@rhwp/core"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Multipart from "effect/http/Multipart"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

declare global {
  /** rhwp's WASM calls back into this host hook to measure text runs. */
  // eslint-disable-next-line no-var
  var measureTextWidth: ((font: string, text: string) => number) | undefined
}

/**
 * `getStructure` returns JSON whose `preamble` field holds the paragraphs
 * before the first recognized structure node — for a problem file, that is the
 * problem text itself.
 */
const StructureSchema = Schema.fromJsonString(
  Schema.Struct({ preamble: Schema.Array(Schema.String) }),
)

const decodeStructure = Schema.decodeUnknownEffect(StructureSchema)

/**
 * Wraps the `@rhwp/core` WASM parser. The layer initializes the WASM module
 * once per process; rhwp is browser-first, so a crude `measureTextWidth` stub
 * is installed — layout fidelity is irrelevant for text extraction.
 */
class Hwpx extends Context.Service<
  Hwpx,
  {
    /** Parses HWP/HWPX bytes and returns the structure preamble as one text. */
    readonly extractPreamble: (
      bytes: Uint8Array,
    ) => Effect.Effect<string, Api.Problem.InvalidHwpxError>
  }
>()("@personalos/server/problem/Hwpx") {
  static readonly layer = Layer.effect(
    Hwpx,
    Effect.gen(function* () {
      globalThis.measureTextWidth ??= (_font, text) => text.length * 8

      const require = createRequire(import.meta.url)
      const wasmPath = join(dirname(require.resolve("@rhwp/core")), "rhwp_bg.wasm")
      const fs = yield* FileSystem.FileSystem
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

      return { extractPreamble }
    }),
  )
}

/**
 * In-memory problem store: upload extracts the problem text once and keeps it
 * until the process restarts.
 */
class Store extends Context.Service<
  Store,
  {
    readonly save: (problemText: string) => Effect.Effect<Api.Problem.Id>
    readonly get: (id: Api.Problem.Id) => Effect.Effect<string, Api.Problem.NotFoundError>
  }
>()("@personalos/server/problem/Store") {
  static readonly layer = Layer.sync(Store, () => {
    const problems = new Map<Api.Problem.Id, string>()
    const decodeId = Schema.decodeUnknownSync(Api.Problem.IdSchema)
    return {
      save: (problemText) =>
        Effect.sync(() => {
          const id = decodeId(crypto.randomUUID())
          problems.set(id, problemText)
          return id
        }),
      get: (id) => {
        const problemText = problems.get(id)
        return problemText === undefined
          ? Effect.fail(new Api.Problem.NotFoundError({ id }))
          : Effect.succeed(problemText)
      },
    }
  })
}

const PROMPT_PATH = fileURLToPath(new URL("../prompt/solution.md", import.meta.url))

/** Loads the solution-writing skill prompt, with its YAML frontmatter removed. */
const loadSystemPrompt = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem
  const raw = yield* fs.readFileString(PROMPT_PATH).pipe(Effect.orDie)
  return raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim()
})

const SolutionModel = AnthropicLanguageModel.layer({ model: "claude-fable-5" })

// Services are resolved once when the group layer is built (construction-time
// requirements), so the store and WASM parser live for the whole process.
export const Live = HttpApiBuilder.group(Api.Api, "problem", (handlers) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const hwpx = yield* Hwpx
    const store = yield* Store
    const model = yield* LanguageModel.LanguageModel
    const systemPrompt = yield* loadSystemPrompt

    return handlers.handleAll({
      upload_problem_hwpx: Effect.fnUntraced(function* ({
        payload,
      }: {
        payload: { file: Multipart.PersistedFile }
      }) {
        const bytes = yield* fs.readFile(payload.file.path).pipe(Effect.orDie)
        const problemText = yield* hwpx.extractPreamble(bytes)
        return yield* store.save(problemText)
      }),
      generate_solution_text: Effect.fnUntraced(function* ({
        params,
      }: {
        params: { id: Api.Problem.Id }
      }) {
        const problemText = yield* store.get(params.id)
        const response = yield* model
          .generateText({
            prompt: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content:
                  "다음 문제의 해설 원고를 써줘. 파일 전송 도구가 없는 환경이니 「전달」 단계는 생략하고, 완성된 원고 본문만 응답으로 그대로 출력해줘. 안내문이나 요약 등 다른 말은 붙이지 마.\n\n" +
                  problemText,
              },
            ],
          })
          .pipe(
            Effect.mapError(
              (error) => new Api.Problem.SolutionGenerationError({ message: error.message }),
            ),
          )
        return response.text
      }),
    })
  }),
).pipe(Layer.provide([Hwpx.layer, Store.layer, SolutionModel]))
