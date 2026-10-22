<script lang="ts">
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

  let image = $state<File | null>(null)
  let converting = $state(false)
  let error = $state("")

  const convert = async () => {
    if (!image) return
    const file = image
    converting = true
    error = ""
    try {
      const form = new FormData()
      form.append("image", file)
      const bytes = await api((client) => client.problem["image-to-hwpx"]({ payload: form }))
      const url = URL.createObjectURL(new Blob([bytes.slice()], { type: "application/hwp+zip" }))
      const a = document.createElement("a")
      a.href = url
      a.download = file.name.replace(/\.[^.]+$/, "") + ".hwpx"
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      error = e instanceof Error ? e.message : String(e)
    } finally {
      converting = false
    }
  }
</script>

<main>
  <h1>PersonalOS</h1>
  <p>SvelteKit client for <code>@personalos/server</code>.</p>
  <button onclick={checkHealth}>Check server health</button>
  <p>
    Server status: <strong data-status={health}>{health}</strong>
  </p>

  <section>
    <h2>문제 사진 → hwpx</h2>
    <p>문제 사진을 올리면 본문은 글, 수식은 한글 수식 개체로 옮긴 hwpx를 내려받습니다.</p>
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      onchange={(e) => (image = e.currentTarget.files?.[0] ?? null)}
    />
    <button onclick={convert} disabled={!image || converting}>
      {converting ? "변환 중…" : "hwpx로 변환"}
    </button>
    {#if error}
      <p class="error">{error}</p>
    {/if}
  </section>
</main>

<style>
  main {
    max-width: 40rem;
    margin: 4rem auto;
    padding: 0 1rem;
  }

  section {
    margin-top: 3rem;
  }

  strong[data-status="ok"] {
    color: var(--color-ok);
  }

  strong[data-status="down"] {
    color: var(--color-down);
  }

  .error {
    color: var(--color-down);
  }
</style>
