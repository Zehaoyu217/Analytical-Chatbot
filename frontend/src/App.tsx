import { useState, useCallback, useRef } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LeftPanel } from "@/components/layout/LeftPanel";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { RightPanel } from "@/components/layout/RightPanel";

const queryClient = new QueryClient();

/** Draggable resize handle between panels */
function ResizeHandle({ onDrag }: { onDrag: (deltaX: number) => void }) {
  const dragging = useRef(false);
  const lastX = useRef(0);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragging.current = true;
      lastX.current = e.clientX;

      const onMouseMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        const delta = ev.clientX - lastX.current;
        lastX.current = ev.clientX;
        onDrag(delta);
      };

      const onMouseUp = () => {
        dragging.current = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [onDrag],
  );

  return (
    <div
      onMouseDown={onMouseDown}
      className="w-1 cursor-col-resize hover:bg-indigo-500/30 active:bg-indigo-500/50 transition-colors shrink-0 relative group"
    >
      <div className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  );
}

export default function App() {
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth, setRightWidth] = useState(340);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.min(400, Math.max(200, w + delta)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    // Negative delta = dragging left = making right panel wider
    setRightWidth((w) => Math.min(600, Math.max(280, w - delta)));
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div
        className="h-screen w-screen overflow-hidden relative"
        style={{
          background: "var(--surface-base)",
          display: "grid",
          gridTemplateColumns: `${leftWidth}px auto 1fr auto ${rightWidth}px`,
          gridTemplateRows: "100%",
        }}
      >
        <LeftPanel />
        <ResizeHandle onDrag={handleLeftResize} />
        <ChatContainer />
        <ResizeHandle onDrag={handleRightResize} />
        <RightPanel />
      </div>
    </QueryClientProvider>
  );
}
