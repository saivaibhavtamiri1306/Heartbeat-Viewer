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
    <div className="flex flex-col h-full overflow-y-auto gap-3 pr-1">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex flex-col gap-1 ${msg.role === "candidate" ? "items-end" : "items-start"}`}
        >
          {msg.role === "system" ? (
            <div className="w-full text-center">
              <span className="text-xs font-mono text-yellow-400/80 bg-yellow-400/10 border border-yellow-400/20 rounded px-3 py-1 uppercase tracking-widest">
                {msg.text}
              </span>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5">
                {msg.role === "avatar" && (
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                )}
                <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">
                  {msg.avatarName || (msg.role === "avatar" ? "HOLO-AI" : "YOU")}
                </span>
                {msg.flagged && (
                  <span className="text-xs bg-red-500/20 text-red-400 border border-red-400/30 rounded px-1.5 font-mono uppercase tracking-widest">
                    ⚠ Bluff
                  </span>
                )}
              </div>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                  msg.role === "avatar"
                    ? "bg-cyan-500/10 border border-cyan-500/30 text-cyan-100"
                    : "bg-purple-500/10 border border-purple-500/30 text-purple-100"
                }`}
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
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">HOLO-AI</span>
          </div>
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-2">
            <div className="flex gap-1 items-center">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-cyan-400"
                  style={{
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
