import { useEffect, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "avatar" | "candidate" | "system" | "evaluation";
  text: string;
  timestamp: number;
  avatarName?: string;
  flagged?: boolean;
  evalScore?: number;
}

interface InterviewChatProps {
  messages: ChatMessage[];
  isTyping: boolean;
}

export default function InterviewChat({ messages, isTyping }: InterviewChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  return (
    <div className="flex flex-col h-full overflow-y-auto gap-3 p-3">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col gap-1 ${msg.role === "candidate" ? "items-end" : "items-start"}`}
        >
          {msg.role === "evaluation" ? (
            <div className="w-full">
              <div className="rounded-xl px-3.5 py-2.5 text-[12px] leading-relaxed"
                style={{
                  background: (msg.evalScore ?? 5) >= 7
                    ? "linear-gradient(135deg, rgba(0, 200, 120, 0.08), rgba(0, 180, 100, 0.04))"
                    : (msg.evalScore ?? 5) >= 5
                    ? "linear-gradient(135deg, rgba(255, 200, 50, 0.08), rgba(200, 160, 40, 0.04))"
                    : "linear-gradient(135deg, rgba(255, 100, 80, 0.08), rgba(200, 80, 60, 0.04))",
                  border: `1px solid ${(msg.evalScore ?? 5) >= 7
                    ? "rgba(0, 200, 120, 0.2)"
                    : (msg.evalScore ?? 5) >= 5
                    ? "rgba(255, 200, 50, 0.2)"
                    : "rgba(255, 100, 80, 0.2)"}`,
                }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em]"
                    style={{ color: (msg.evalScore ?? 5) >= 7 ? "#00c878" : (msg.evalScore ?? 5) >= 5 ? "#ffaa00" : "#ff6450" }}>
                    {(msg.evalScore ?? 5) >= 7 ? "✓ Good Answer" : (msg.evalScore ?? 5) >= 5 ? "◐ Partial" : "✗ Needs Work"}
                  </span>
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                    style={{
                      background: (msg.evalScore ?? 5) >= 7 ? "rgba(0,200,120,0.15)" : (msg.evalScore ?? 5) >= 5 ? "rgba(255,200,50,0.15)" : "rgba(255,100,80,0.15)",
                      color: (msg.evalScore ?? 5) >= 7 ? "#00c878" : (msg.evalScore ?? 5) >= 5 ? "#ffaa00" : "#ff6450",
                    }}>
                    {msg.evalScore}/10
                  </span>
                </div>
                <div style={{ color: "rgba(180, 210, 230, 0.75)" }}>{msg.text}</div>
              </div>
            </div>
          ) : msg.role === "system" ? (
            <div className="w-full text-center">
              <span
                className="text-[10px] font-mono uppercase tracking-[0.15em] rounded-full px-3 py-1"
                style={{
                  color: "rgba(255, 200, 50, 0.7)",
                  background: "rgba(255, 200, 50, 0.06)",
                  border: "1px solid rgba(255, 200, 50, 0.15)",
                }}
              >
                {msg.text}
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                {msg.role === "avatar" && (
                  <div className="w-1 h-1 rounded-full" style={{ background: "#4ecdc4", boxShadow: "0 0 4px rgba(78,205,196,0.6)" }} />
                )}
                <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: "rgba(120, 155, 185, 0.5)" }}>
                  {msg.avatarName || (msg.role === "avatar" ? "HOLO-AI" : "YOU")}
                </span>
                {msg.flagged && (
                  <span
                    className="text-[10px] font-mono uppercase tracking-[0.1em] rounded-full px-1.5 py-0.5"
                    style={{ color: "#ff4444", background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.15)" }}
                  >
                    Bluff
                  </span>
                )}
              </div>
              <div
                className="max-w-[88%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                style={{
                  background: msg.role === "avatar"
                    ? "linear-gradient(135deg, rgba(78, 205, 196, 0.05), rgba(60, 160, 155, 0.03))"
                    : "linear-gradient(135deg, rgba(167, 139, 250, 0.05), rgba(140, 110, 220, 0.03))",
                  border: `1px solid ${msg.role === "avatar" ? "rgba(78, 205, 196, 0.1)" : "rgba(167, 139, 250, 0.1)"}`,
                  color: msg.role === "avatar" ? "rgba(180, 215, 230, 0.8)" : "rgba(200, 185, 240, 0.8)",
                }}
              >
                {msg.text}
              </div>
            </>
          )}
        </div>
      ))}

      {isTyping && (
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full" style={{ background: "#4ecdc4", boxShadow: "0 0 4px rgba(78,205,196,0.6)" }} />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: "rgba(120, 155, 185, 0.5)" }}>HOLO-AI</span>
          </div>
          <div
            className="rounded-xl px-3.5 py-2.5"
            style={{
              background: "linear-gradient(135deg, rgba(78, 205, 196, 0.05), rgba(60, 160, 155, 0.03))",
              border: "1px solid rgba(78, 205, 196, 0.1)",
            }}
          >
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "#4ecdc4",
                    animation: `pulse 1s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
