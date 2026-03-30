import { describe, it, expect, beforeEach } from "vitest";
import { useChatStore } from "@/stores/chatStore";

describe("chatStore", () => {
  beforeEach(() => {
    // Reset store to initial state
    useChatStore.setState({
      messages: [],
      sessionId: null,
      isStreaming: false,
      progressSteps: [],
      artifacts: [],
      dashboardComponents: [],
      activeAgents: [],
    });
  });

  describe("addAgentStatus", () => {
    it("creates a running progress step when agent starts", () => {
      useChatStore.getState().addAgentStatus({
        agent_name: "data_profiler",
        agent_id: "profiler_abc",
        parent_agent_id: "orchestrator",
        status: "started",
        task: "Profile the sales dataset",
      });

      const steps = useChatStore.getState().progressSteps;
      expect(steps).toHaveLength(1);
      expect(steps[0].label).toBe("Agent: data_profiler");
      expect(steps[0].status).toBe("running");
      expect(steps[0].detail).toBe("Profile the sales dataset");
    });

    it("updates progress step to done when agent completes", () => {
      const store = useChatStore.getState();

      store.addAgentStatus({
        agent_name: "data_profiler",
        agent_id: "profiler_abc",
        status: "started",
        task: "Test",
      });

      store.addAgentStatus({
        agent_name: "data_profiler",
        agent_id: "profiler_abc",
        status: "completed",
        tool_calls: 3,
        elapsed_s: 2.5,
      });

      const steps = useChatStore.getState().progressSteps;
      expect(steps).toHaveLength(1);
      expect(steps[0].status).toBe("done");
      expect(steps[0].detail).toContain("3 tool calls");
    });

    it("updates progress step to error when agent fails", () => {
      const store = useChatStore.getState();

      store.addAgentStatus({
        agent_name: "visualizer",
        agent_id: "viz_123",
        status: "started",
        task: "Create chart",
      });

      store.addAgentStatus({
        agent_name: "visualizer",
        agent_id: "viz_123",
        status: "failed",
        error: "LLM timeout",
      });

      const steps = useChatStore.getState().progressSteps;
      expect(steps).toHaveLength(1);
      expect(steps[0].status).toBe("error");
      expect(steps[0].detail).toBe("LLM timeout");
    });

    it("tracks active agents", () => {
      const store = useChatStore.getState();

      store.addAgentStatus({
        agent_name: "data_profiler",
        agent_id: "profiler_abc",
        status: "started",
        task: "Profile",
      });

      expect(useChatStore.getState().activeAgents).toHaveLength(1);

      store.addAgentStatus({
        agent_name: "data_profiler",
        agent_id: "profiler_abc",
        status: "completed",
      });

      expect(useChatStore.getState().activeAgents).toHaveLength(0);
    });
  });

  describe("addToolEvent", () => {
    it("creates running progress step on tool_start", () => {
      useChatStore.getState().addToolEvent(
        {
          agent_id: "orchestrator",
          tool: "query_duckdb",
          args_preview: "SQL: SELECT COUNT(*) FROM sales",
        },
        "start",
      );

      const steps = useChatStore.getState().progressSteps;
      expect(steps).toHaveLength(1);
      expect(steps[0].label).toBe("query_duckdb");
      expect(steps[0].status).toBe("running");
      expect(steps[0].detail).toContain("SQL:");
    });

    it("updates step to done on tool_end", () => {
      const store = useChatStore.getState();

      store.addToolEvent(
        { agent_id: "orchestrator", tool: "query_duckdb", args_preview: "SQL: ..." },
        "start",
      );

      store.addToolEvent(
        { agent_id: "orchestrator", tool: "query_duckdb", elapsed_s: 0.5 },
        "end",
      );

      const steps = useChatStore.getState().progressSteps;
      expect(steps).toHaveLength(1);
      expect(steps[0].status).toBe("done");
      expect(steps[0].detail).toBe("0.5s");
    });
  });

  describe("clearAgents", () => {
    it("resets active agents", () => {
      useChatStore.getState().addAgentStatus({
        agent_name: "data_profiler",
        agent_id: "p1",
        status: "started",
        task: "t",
      });

      useChatStore.getState().clearAgents();
      expect(useChatStore.getState().activeAgents).toHaveLength(0);
    });
  });

  describe("existing functionality preserved", () => {
    it("adds and clears messages", () => {
      const store = useChatStore.getState();
      store.addMessage({
        id: "1",
        role: "user",
        content: "Hello",
        timestamp: new Date(),
      });

      expect(useChatStore.getState().messages).toHaveLength(1);

      store.clearMessages();
      expect(useChatStore.getState().messages).toHaveLength(0);
      expect(useChatStore.getState().activeAgents).toHaveLength(0);
    });

    it("adds progress steps", () => {
      useChatStore.getState().addProgressStep({
        id: "s1",
        label: "Analyzing intent...",
        status: "done",
        detail: "",
        started_at: 1000,
        finished_at: 1001,
      });

      expect(useChatStore.getState().progressSteps).toHaveLength(1);
    });

    it("adds artifacts", () => {
      useChatStore.getState().addArtifact({
        id: "a1",
        type: "table",
        title: "Test table",
        content: "<table></table>",
        format: "html",
        created_at: Date.now(),
        metadata: {},
      });

      expect(useChatStore.getState().artifacts).toHaveLength(1);
    });
  });

  describe("addInlineComponents", () => {
    it("attaches inline component group to current streaming assistant message", () => {
      const store = useChatStore.getState();

      // Add a streaming assistant message
      store.addMessage({
        id: "msg-1",
        role: "assistant",
        content: "",
        timestamp: new Date(),
        isStreaming: true,
      });

      store.addInlineComponents({
        title: "Macro Snapshot",
        components: [
          { type: "metric", title: "GDP", value: "3.2%" },
          { type: "alert", severity: "info", title: "Note", content: "Q3 2024 data." },
        ],
      });

      const messages = useChatStore.getState().messages;
      const assistantMsg = messages.find((m) => m.role === "assistant");
      expect(assistantMsg?.inlineComponentGroups).toHaveLength(1);
      expect(assistantMsg?.inlineComponentGroups?.[0].title).toBe("Macro Snapshot");
      expect(assistantMsg?.inlineComponentGroups?.[0].components).toHaveLength(2);
      expect(assistantMsg?.inlineComponentGroups?.[0].id).toBeTruthy();
    });

    it("does not attach if no streaming assistant message exists", () => {
      const store = useChatStore.getState();

      // No messages at all
      store.addInlineComponents({
        title: "Orphan group",
        components: [{ type: "metric", title: "X", value: "0" }],
      });

      // Should not throw; messages array remains empty
      expect(useChatStore.getState().messages).toHaveLength(0);
    });
  });
});
