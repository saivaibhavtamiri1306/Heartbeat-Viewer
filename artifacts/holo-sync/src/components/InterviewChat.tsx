import { useEffect, useRef } from "react";

export interface ChatMessage {
  id: string;
  role: "avatar" | "candidate" | "system";
  text: string;
  timestamp: number;
  avatarName?: string;
  flagged?: boolean;
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
          {msg.role === "system" ? (
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
                  <div className="w-1 h-1 rounded-full" style={{ background: "#00d4ff", boxShadow: "0 0 4px #00d4ff" }} />
                )}
                <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: "rgba(120, 140, 170, 0.6)" }}>
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
                    ? "linear-gradient(135deg, rgba(0, 212, 255, 0.06), rgba(0, 150, 200, 0.04))"
                    : "linear-gradient(135deg, rgba(119, 0, 255, 0.06), rgba(168, 85, 247, 0.04))",
                  border: `1px solid ${msg.role === "avatar" ? "rgba(0, 212, 255, 0.12)" : "rgba(168, 85, 247, 0.12)"}`,
                  color: msg.role === "avatar" ? "rgba(180, 225, 255, 0.85)" : "rgba(210, 180, 255, 0.85)",
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
            <div className="w-1 h-1 rounded-full" style={{ background: "#00d4ff", boxShadow: "0 0 4px #00d4ff" }} />
            <span className="text-[10px] font-mono uppercase tracking-[0.15em]" style={{ color: "rgba(120, 140, 170, 0.6)" }}>HOLO-AI</span>
          </div>
          <div
            className="rounded-xl px-3.5 py-2.5"
            style={{
              background: "linear-gradient(135deg, rgba(0, 212, 255, 0.06), rgba(0, 150, 200, 0.04))",
              border: "1px solid rgba(0, 212, 255, 0.12)",
            }}
          >
            <div className="flex gap-1.5 items-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: "#00d4ff",
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
