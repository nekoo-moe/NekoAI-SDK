# NekoAI SDK Architecture & Security Model

NekoAI provides an extensible, secure, multi-process plugin execution model designed to balance developer ergonomic freedom with strict end-user security.

---

## 1. Process Boundary & Isolation

Plugins in NekoAI do not execute inside the Electron main process directly. Instead, they run in dedicated, isolated worker threads or sandboxed runtimes.

```
┌─────────────────────────────────────────────────────────────┐
│                    Host Process (Electron)                  │
│                                                             │
│  ┌──────────────────────┐      ┌─────────────────────────┐  │
│  │ Permission Gate      │      │ Heartbeat Watchdog      │  │
│  │ - Validates manifest │      │ - 5s ping/pong monitor  │  │
│  │ - Blocks undeclared  │      │ - Crash circuit breaker │  │
│  └──────────┬───────────┘      └────────────┬────────────┘  │
│             │                               │               │
│             └───────────────┬───────────────┘               │
│                             │                               │
│                    Eventa IPC / RPC Channel                 │
└─────────────────────────────┼───────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────┐
│              Plugin Sandbox (node:worker_threads)           │
│                                                             │
│  ┌──────────────────────┐      ┌─────────────────────────┐  │
│  │ Plugin Context (ctx) │      │ Registered Tools        │  │
│  │ - tools.register()   │      │ - execute() handlers    │  │
│  │ - kits.use()         │      │ - Valibot schemas       │  │
│  └──────────────────────┘      └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Key Isolation Principles

1. **Memory & Thread Bounds**: Worker sandboxes are memory-capped. Heavy calculations or memory leaks do not crash the host desktop UI.
2. **Watchdog Heartbeat**: The host sends health pings every 5,000ms. If a plugin freezes the event loop for more than 10 seconds, the watchdog triggers a graceful termination.
3. **Crash Circuit Breaker**: If a plugin worker crashes repeatedly (default: 3 crashes within a 60-second window), the sandbox enters a degraded state and stops restarting automatically, preventing CPU exhaustion.

---

## 2. Eventa RPC Protocol

All inter-process communication between the host and the plugin worker uses `@moeru/eventa`, a lightweight, type-safe RPC abstraction.

- **RPC Invocations**: Host commands (e.g. `executeTool`, `startPlugin`, `stopPlugin`) are dispatched as strongly-typed events with automatic timeouts and stack trace serialization.
- **Bi-directional Streaming**: Kits (such as interactive mini-gamelets or sensor listeners) can stream continuous telemetry without message framing overhead.

---

## 3. Host Capabilities Gatekeeper

Whenever a plugin requests a capability (e.g. `system:resource-read`, `screen:capture`, `tamagotchi:widget-mount`):
1. **Static Validation**: At load time, the host checks whether the requested capability is declared in the plugin's `neko-plugin.json`.
2. **Dynamic Enforcement**: When the plugin attempts to execute a gated method (such as calling a system API or mounting a widget), the host verifies that permission tokens match the declared capabilities. Undeclared access throws a `SecurityError`.

---

## 4. Lifecycle Sequences

### Startup Sequence

1. Host discovers `neko-plugin.json` and parses requested capabilities.
2. Host spawns a `PluginSandbox` worker thread.
3. Worker imports the compiled entrypoint (`dist/index.mjs`) via cross-platform file URL resolution.
4. Worker invokes `plugin.setup(ctx)` and collects registered tools and kit handles.
5. Host acknowledges readiness and registers AI tool descriptions into the active character LLM prompt.

### Shutdown Sequence

1. Host emits a graceful `stop` command to the sandbox.
2. Sandbox runs all registered teardown hooks returned by `setup()`.
3. Sandbox disposes of all kit instances, event listeners, and timers.
4. Host destroys the worker thread and reclaims memory.
