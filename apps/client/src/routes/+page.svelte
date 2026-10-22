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

  type Stage = "idle" | "uploading" | "generating" | "done" | "error"

  let stage = $state<Stage>("idle")
  let dragging = $state(false)
  let fileName = $state("")
  let problemId = $state<Problem.Id | null>(null)
  let solution = $state("")
  let errorMessage = $state("")

  const describeError = (cause: unknown): string => {
    if (cause instanceof Error) return cause.message
    return String(cause)
  }

  const solveFile = async (file: File) => {
    if (!/\.hwpx?$/i.test(file.name)) {
      stage = "error"
      errorMessage = `지원하지 않는 파일입니다: ${file.name} (.hwp / .hwpx 만 지원)`
      return
    }
    fileName = file.name
    solution = ""
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
</script>

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

    {#if stage === "done"}
      <h3>해설 원고</h3>
      <pre>{solution}</pre>
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

  pre {
    white-space: pre-wrap;
    word-break: break-word;
    border: 1px solid color-mix(in srgb, currentColor 25%, transparent);
    border-radius: 0.5rem;
    padding: 1rem;
  }
</style>
