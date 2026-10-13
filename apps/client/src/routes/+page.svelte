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
</script>

<main>
  <h1>PersonalOS</h1>
  <p>SvelteKit client for <code>@personalos/server</code>.</p>
  <button onclick={checkHealth}>Check server health</button>
  <p>
    Server status: <strong data-status={health}>{health}</strong>
  </p>
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
</style>
