import { readFileSync } from "node:fs"

import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as Api from "@personalos/api"
import * as LanguageModel from "effect/ai/LanguageModel"
import * as Effect from "effect/Effect"
import * as FileSystem from "effect/FileSystem"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as HttpApiError from "effect/http-api/HttpApiError"
import * as Multipart from "effect/http/Multipart"

import * as Hwpx from "./hwpx.ts"

const UploadProblemHwpx = Effect.fnUntraced(function* ({
  payload,
}: {
  payload: { file: Multipart.PersistedFile }
}) {
  return yield* Effect.die(`Not implemented: ${payload.file.path}`)
})

const GenerateSolutionText = Effect.fnUntraced(function* ({ params }: { params: { id: string } }) {
  yield* AnthropicClient.AnthropicClient
  return yield* Effect.die(`Not implemented: ${params.id}`)
})

// what the Anthropic vision API accepts; HEIC from iPhones is not among them
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"])

// edit the prompt next to this file; it is read once at startup
const TRANSCRIBE_PROMPT = readFileSync(new URL("./transcribe-prompt.md", import.meta.url), "utf8")

const ImageToHwpx = Effect.fnUntraced(function* ({
  payload: { image },
}: {
  payload: { image: Multipart.PersistedFile }
}) {
  if (!IMAGE_TYPES.has(image.contentType)) {
    return yield* new HttpApiError.UnprocessableEntity()
  }
  const fs = yield* FileSystem.FileSystem
  const bytes = yield* Effect.orDie(fs.readFile(image.path))
  const response = yield* LanguageModel.generateText({
    prompt: [
      { role: "system", content: TRANSCRIBE_PROMPT },
      {
        role: "user",
        content: [
          { type: "file", mediaType: image.contentType, data: bytes },
          { type: "text", text: "이 사진의 문제를 원고 형식으로 옮겨 적어라." },
        ],
      },
    ],
  }).pipe(
    Effect.tapError((error) => Effect.logError("image-to-hwpx: model call failed", error)),
    Effect.mapError(() => new HttpApiError.InternalServerError()),
  )
  return Hwpx.fromManuscript(response.text)
})

export const Live = HttpApiBuilder.group(Api.Api, "problem", (handlers) =>
  handlers.handleAll({
    "upload-problem-hwpx": UploadProblemHwpx,
    "generate-solution-text": GenerateSolutionText,
    "image-to-hwpx": ImageToHwpx,
  }),
)
