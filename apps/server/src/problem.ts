import * as AnthropicClient from "@effect/ai-anthropic/AnthropicClient"
import * as Api from "@personalos/api"
import * as Effect from "effect/Effect"
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder"
import * as Multipart from "effect/http/Multipart"

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

export const Live = HttpApiBuilder.group(Api.Api, "problem", (handlers) =>
  handlers.handleAll({
    "upload-problem-hwpx": UploadProblemHwpx,
    "generate-solution-text": GenerateSolutionText,
  }),
)
