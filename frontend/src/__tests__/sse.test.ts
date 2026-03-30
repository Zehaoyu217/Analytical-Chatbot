import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SSECallbacks } from "@/lib/sse";

// We test the SSE parsing logic by simulating the ReadableStream
// Since streamChat uses fetch internally, we mock fetch and test the callback dispatch

function createMockResponse(sseText: string): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(sseText));
      controller.close();
    },
  });

  return {
    ok: true,
    statusText: "OK",
    body: stream,
  } as unknown as Response;
}

describe("SSE streamChat", () => {
  let streamChat: typeof import("@/lib/sse").streamChat;

  beforeEach(async () => {
    // Re-import to get fresh module
    const mod = await import("@/lib/sse");
    streamChat = mod.streamChat;
  });

  it("dispatches progress events", async () => {
    const callbacks = createCallbacks();
    const sseText = `event: progress\ndata: {"id":"s1","label":"Analyzing...","status":"done","detail":"","started_at":1000,"finished_at":1001}\n\nevent: done\ndata: {"session_id":"abc"}\n\n`;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createMockResponse(sseText)));

    await streamChat("hello", null, null, null, callbacks);

    expect(callbacks.onProgress).toHaveBeenCalledWith(
      expect.objectContaining({ label: "Analyzing...", status: "done" }),
    );
    expect(callbacks.onDone).toHaveBeenCalledWith("abc");
  });

  it("dispatches artifact events", async () => {
    const callbacks = createCallbacks();
    const sseText = `event: artifact\ndata: {"id":"a1","type":"table","title":"Sales","content":"<table/>","format":"html","created_at":1000,"metadata":{}}\n\nevent: done\ndata: {"session_id":"abc"}\n\n`;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createMockResponse(sseText)));

    await streamChat("hello", null, null, null, callbacks);

    expect(callbacks.onArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a1", type: "table", title: "Sales" }),
    );
  });

  it("dispatches agent_status events", async () => {
    const callbacks = createCallbacks();
    const sseText = `event: agent_status\ndata: {"agent_name":"data_profiler","status":"started","task":"Profile data","agent_id":"p1"}\n\nevent: done\ndata: {"session_id":"abc"}\n\n`;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createMockResponse(sseText)));

    await streamChat("hello", null, null, null, callbacks);

    expect(callbacks.onAgentStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        agent_name: "data_profiler",
        status: "started",
      }),
    );
  });

  it("dispatches tool_start and tool_end events", async () => {
    const callbacks = createCallbacks();
    const sseText = [
      `event: tool_start\ndata: {"agent_id":"orchestrator","tool":"query_duckdb","args_preview":"SQL: SELECT..."}\n\n`,
      `event: tool_end\ndata: {"agent_id":"orchestrator","tool":"query_duckdb","elapsed_s":0.5}\n\n`,
      `event: done\ndata: {"session_id":"abc"}\n\n`,
    ].join("");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createMockResponse(sseText)));

    await streamChat("hello", null, null, null, callbacks);

    expect(callbacks.onToolStart).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "query_duckdb" }),
    );
    expect(callbacks.onToolEnd).toHaveBeenCalledWith(
      expect.objectContaining({ tool: "query_duckdb", elapsed_s: 0.5 }),
    );
  });

  it("handles optional callbacks gracefully", async () => {
    // Only provide required callbacks, omit A2A/A2UI ones
    const callbacks: SSECallbacks = {
      onUpdate: vi.fn(),
      onProgress: vi.fn(),
      onArtifact: vi.fn(),
      onDashboard: vi.fn(),
      onDone: vi.fn(),
      onError: vi.fn(),
      // No onAgentStatus, onToolStart, onToolEnd
    };

    const sseText = `event: agent_status\ndata: {"agent_name":"test","status":"started"}\n\nevent: done\ndata: {"session_id":"abc"}\n\n`;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createMockResponse(sseText)));

    // Should not throw even though onAgentStatus is undefined
    await expect(
      streamChat("hello", null, null, null, callbacks),
    ).resolves.not.toThrow();
  });

  it("skips malformed JSON", async () => {
    const callbacks = createCallbacks();
    const sseText = `event: progress\ndata: {invalid json}\n\nevent: done\ndata: {"session_id":"abc"}\n\n`;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createMockResponse(sseText)));

    await streamChat("hello", null, null, null, callbacks);

    expect(callbacks.onProgress).not.toHaveBeenCalled();
    expect(callbacks.onDone).toHaveBeenCalled();
  });

  it("calls onError for failed requests", async () => {
    const callbacks = createCallbacks();

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText: "Internal Server Error",
      }),
    );

    await streamChat("hello", null, null, null, callbacks);

    expect(callbacks.onError).toHaveBeenCalledWith(
      expect.stringContaining("Internal Server Error"),
    );
  });

  it("dispatches error events from SSE stream", async () => {
    const callbacks = createCallbacks();
    const sseText = `event: error\ndata: {"error":"LLM timeout"}\n\n`;

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createMockResponse(sseText)));

    await streamChat("hello", null, null, null, callbacks);

    expect(callbacks.onError).toHaveBeenCalledWith("LLM timeout");
  });
});

function createCallbacks(): Required<SSECallbacks> {
  return {
    onUpdate: vi.fn(),
    onProgress: vi.fn(),
    onArtifact: vi.fn(),
    onDashboard: vi.fn(),
    onDone: vi.fn(),
    onError: vi.fn(),
    onAgentStatus: vi.fn(),
    onToolStart: vi.fn(),
    onToolEnd: vi.fn(),
    onTokenDelta: vi.fn(),
    onThinking: vi.fn(),
    onSubagentStart: vi.fn(),
    onSubagentDelta: vi.fn(),
    onSubagentDone: vi.fn(),
    onSuggestions: vi.fn(),
    onThoughtStream: vi.fn(),
    onInlineComponent: vi.fn(),
  } as Required<SSECallbacks>;
}
