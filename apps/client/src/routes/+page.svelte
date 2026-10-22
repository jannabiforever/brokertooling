<script lang="ts">
  import type { Problem } from "@personalos/api"

  import { api } from "$lib/api.ts"

  let health = $state<"unknown" | "ok" | "down">("unknown")

  const checkHealth = async () => {
    try {
      await api((client) => client.health())
      health = "ok"
    } catch {
      health = "down"
    }
  }

  const describeError = (cause: unknown): string => {
    if (cause instanceof Error) return cause.message
    return String(cause)
  }

  // --- 해설 원고 생성 (hwpx → manuscript) ---

  type Stage = "idle" | "uploading" | "generating" | "done" | "error"

  let stage = $state<Stage>("idle")
  let dragging = $state(false)
  let fileName = $state("")
  let problemId = $state<Problem.Id | null>(null)
  let solution = $state<Problem.Manuscript | null>(null)
  let errorMessage = $state("")

  const solveFile = async (file: File) => {
    if (!/\.hwpx?$/i.test(file.name)) {
      stage = "error"
      errorMessage = `지원하지 않는 파일입니다: ${file.name} (.hwp / .hwpx 만 지원)`
      return
    }
    fileName = file.name
    solution = null
    errorMessage = ""
    problemId = null
    try {
      stage = "uploading"
      const formData = new FormData()
      formData.append("file", file)
      const id = await api((client) => client.problem.upload_problem_hwpx({ payload: formData }))
      problemId = id
      stage = "generating"
      solution = await api((client) =>
        client.problem.generate_solution_text({ params: { id } }),
      )
      stage = "done"
    } catch (cause) {
      stage = "error"
      errorMessage = describeError(cause)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    dragging = false
    const file = event.dataTransfer?.files[0]
    if (file) void solveFile(file)
  }

  const onPick = (event: Event) => {
    const input = event.currentTarget as HTMLInputElement
    const file = input.files?.[0]
    if (file) void solveFile(file)
    input.value = ""
  }

  const busy = $derived(stage === "uploading" || stage === "generating")

  // --- 문제 사진 → 원고 → hwpx ---

  let image = $state<File | null>(null)
  let transcribing = $state(false)
  let manuscript = $state("")
  let warnings = $state<ReadonlyArray<Problem.Warning>>([])
  let building = $state(false)
  let convertError = $state("")

  const transcribe = async () => {
    if (!image) return
    transcribing = true
    convertError = ""
    try {
      const formData = new FormData()
      formData.append("image", image)
      const result = await api((client) => client.problem.transcribe_image({ payload: formData }))
      manuscript = result.text
      warnings = result.warnings
    } catch (cause) {
      convertError = describeError(cause)
    } finally {
      transcribing = false
    }
  }

  const build = async () => {
    building = true
    convertError = ""
    try {
      const bytes = await api((client) =>
        client.problem.manuscript_to_hwpx({ payload: { text: manuscript } }),
      )
      const url = URL.createObjectURL(new Blob([bytes.slice()], { type: "application/hwp+zip" }))
      const a = document.createElement("a")
      a.href = url
      a.download = (image?.name ?? "manuscript").replace(/\.[^.]+$/, "") + ".hwpx"
      a.click()
      URL.revokeObjectURL(url)
    } catch (cause) {
      convertError = describeError(cause)
    } finally {
      building = false
    }
  }
</script>

{#snippet warningList(items: ReadonlyArray<Problem.Warning>)}
  {#if items.length > 0}
    <h4>손봐야 할 것 ({items.length})</h4>
    <ul class="warnings">
      {#each items as w (w.line + w.rule + w.text)}
        <li><code>L{w.line}</code> {w.rule}: <code>{w.text}</code></li>
      {/each}
    </ul>
  {:else}
    <p class="meta">형식 검사 통과</p>
  {/if}
{/snippet}

<main>
  <h1>PersonalOS</h1>
  <p>SvelteKit client for <code>@personalos/server</code>.</p>
  <button onclick={checkHealth}>Check server health</button>
  <p>
    Server status: <strong data-status={health}>{health}</strong>
  </p>

  <section>
    <h2>해설 원고 생성</h2>
    <p>HWP/HWPX 문제 파일을 떨어뜨리면 문제 본문을 추출해 해설 원고를 생성합니다.</p>

    <div
      class="dropzone"
      class:dragging
      role="button"
      tabindex="0"
      aria-label="HWP/HWPX 문제 파일 업로드"
      ondragover={(event) => {
        event.preventDefault()
        dragging = true
      }}
      ondragleave={() => (dragging = false)}
      ondrop={onDrop}
    >
      {#if busy}
        <p>
          {stage === "uploading" ? "업로드 및 문제 추출 중…" : "해설 원고 생성 중… (수십 초 걸릴 수 있음)"}
        </p>
      {:else}
        <p>여기에 .hwp / .hwpx 파일을 끌어다 놓거나</p>
        <label>
          파일 선택
          <input type="file" accept=".hwp,.hwpx" onchange={onPick} disabled={busy} />
        </label>
      {/if}
    </div>

    {#if fileName}
      <p class="meta">
        파일: <code>{fileName}</code>
        {#if problemId}
          · 문제 ID: <code>{problemId}</code>
        {/if}
      </p>
    {/if}

    {#if stage === "error"}
      <p class="error">{errorMessage}</p>
    {/if}

    {#if stage === "done" && solution}
      <h3>해설 원고</h3>
      <pre>{solution.text}</pre>
      {@render warningList(solution.warnings)}
    {/if}
  </section>

  <section>
    <h2>문제 사진 → hwpx</h2>
    <p>
      문제 사진을 원고(글 + <code>$수식$</code>)로 옮긴 뒤 형식 검사 결과를 보고 고쳐서 hwpx로
      내려받습니다.
    </p>
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      onchange={(e) => (image = e.currentTarget.files?.[0] ?? null)}
    />
    <button onclick={transcribe} disabled={!image || transcribing}>
      {transcribing ? "전사 중… (수십 초 걸릴 수 있음)" : "원고로 전사"}
    </button>

    {#if manuscript}
      <h3>원고</h3>
      <textarea bind:value={manuscript} rows="16" spellcheck="false"></textarea>
      {@render warningList(warnings)}
      <button onclick={build} disabled={building}>
        {building ? "변환 중…" : "hwpx로 변환"}
      </button>
    {/if}

    {#if convertError}
      <p class="error">{convertError}</p>
    {/if}
  </section>
</main>

<style>
  main {
    max-width: 40rem;
    margin: 4rem auto;
    padding: 0 1rem;
  }

  strong[data-status="ok"] {
    color: var(--color-ok);
  }

  strong[data-status="down"] {
    color: var(--color-down);
  }

  section {
    margin-top: 3rem;
  }

  .dropzone {
    border: 2px dashed color-mix(in srgb, currentColor 40%, transparent);
    border-radius: 0.5rem;
    padding: 2.5rem 1rem;
    text-align: center;
  }

  .dropzone.dragging {
    border-color: currentColor;
    background: color-mix(in srgb, currentColor 8%, transparent);
  }

  .dropzone label {
    cursor: pointer;
    text-decoration: underline;
  }

  .dropzone input[type="file"] {
    display: none;
  }

  .meta {
    font-size: 0.875rem;
  }

  .error {
    color: var(--color-down);
  }

  pre,
  textarea {
    width: 100%;
    box-sizing: border-box;
    font: 0.875rem/1.5 ui-monospace, monospace;
    white-space: pre-wrap;
    word-break: break-word;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    border-radius: 0.5rem;
    padding: 1rem;
    background: transparent;
    color: inherit;
  }

  .warnings {
    font-size: 0.875rem;
    padding-left: 1.25rem;
  }
</style>
