import { fileURLToPath } from "node:url"

import * as AnthropicLanguageModel from "@effect/ai-anthropic/AnthropicLanguageModel"
import * as Api from "@personalos/api"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Multipart from "effect/http/Multipart"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

import * as Figure from "./figure.ts"
import { Hwpx } from "./hwpx.ts"
import * as Manuscript from "./manuscript.ts"

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

/** Loads a prompt from `apps/server/prompt/`, with any YAML frontmatter removed. */
const loadPrompt = (name: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const path = fileURLToPath(new URL(`../prompt/${name}`, import.meta.url))
    const raw = yield* fs.readFileString(path).pipe(Effect.orDie)
    return raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim()
  })

const Model = AnthropicLanguageModel.layer({ model: "claude-fable-5" })

// what the Anthropic vision API accepts; HEIC straight from an iPhone is not among them
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

/** Rejects what the vision model cannot read; the client's `accept` is only a hint. */
const checkImage = (image: Multipart.PersistedFile) =>
  IMAGE_TYPES.has(image.contentType)
    ? Effect.void
    : new Api.Problem.UnsupportedImageError({
        message: `지원하지 않는 이미지 형식입니다: ${image.contentType} (jpeg/png/webp/gif)`,
      })

/** The lint/format stage every model-written manuscript goes through. */
const finish = (text: string): Api.Problem.Manuscript => {
  const formatted = Manuscript.format(text)
  return { text: formatted, warnings: Manuscript.lint(formatted) }
}

// Services are resolved once when the group layer is built (construction-time
// requirements), so the store and WASM parser live for the whole process.
export const Live = HttpApiBuilder.group(Api.Api, "problem", (handlers) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const hwpx = yield* Hwpx
    const store = yield* Store
    const model = yield* LanguageModel.LanguageModel
    const solutionPrompt = yield* loadPrompt("solution.md")
    const transcribePrompt = yield* loadPrompt("transcribe.md")
    const figurePrompt = yield* loadPrompt("figure.md")

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
              { role: "system", content: solutionPrompt },
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
        return finish(response.text)
      }),
      transcribe_image: Effect.fnUntraced(function* ({
        payload: { image },
      }: {
        payload: { image: Multipart.PersistedFile }
      }) {
        yield* checkImage(image)
        const bytes = yield* fs.readFile(image.path).pipe(Effect.orDie)
        const response = yield* model
          .generateText({
            prompt: [
              { role: "system", content: transcribePrompt },
              {
                role: "user",
                content: [
                  { type: "file", mediaType: image.contentType, data: bytes },
                  { type: "text", text: "이 사진의 문제를 원고 형식으로 옮겨 적어라." },
                ],
              },
            ],
          })
          .pipe(
            Effect.mapError(
              (error) => new Api.Problem.TranscriptionError({ message: error.message }),
            ),
          )
        return finish(response.text)
      }),
      // One model call per `[그림: ...]` note, with the photo as the reference.
      generate_figures: Effect.fnUntraced(function* ({
        payload: { image, text },
      }: {
        payload: { image: Multipart.PersistedFile; text: string }
      }) {
        yield* checkImage(image)
        const notes = Figure.notes(text)
        if (notes.length === 0) return []
        const bytes = yield* fs.readFile(image.path).pipe(Effect.orDie)
        return yield* Effect.forEach(
          notes,
          Effect.fnUntraced(function* (note: string) {
            const response = yield* model
              .generateText({
                prompt: [
                  { role: "system", content: figurePrompt },
                  {
                    role: "user",
                    content: [
                      { type: "file", mediaType: image.contentType, data: bytes },
                      { type: "text", text: `문제 원고:\n${text}\n\n그릴 그림: ${note}` },
                    ],
                  },
                ],
              })
              .pipe(
                Effect.mapError(
                  (error) => new Api.Problem.FigureGenerationError({ message: error.message }),
                ),
              )
            const svg = Figure.svgFromResponse(response.text)
            if (svg === undefined) {
              return yield* new Api.Problem.FigureGenerationError({
                message: `SVG가 아닌 응답을 받았습니다: ${note}`,
              })
            }
            return { note, svg }
          }),
          { concurrency: 3 },
        )
      }),
      manuscript_to_hwpx: ({
        payload,
      }: {
        payload: { text: string; figures?: ReadonlyArray<Api.Problem.Figure> | undefined }
      }) => hwpx.fromManuscript(Manuscript.format(payload.text), payload.figures ?? []),
    })
  }),
).pipe(Layer.provide([Hwpx.layer, Store.layer, Model]))
