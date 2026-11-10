
"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
type Message = {
  role: "user" | "assistant";
  content: string;
};
type Chat = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

export default function Home() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
const [activeChatId, setActiveChatId] = useState<string | null>(null);
const [chatsLoaded, setChatsLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  useEffect(() => {
  bottomRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "end",
  });
}, [messages, answer]);

useEffect(() => {
  try {
    const savedChats = localStorage.getItem("sql-companion-chats");

    if (savedChats) {
      setChats(JSON.parse(savedChats));
    }
  } catch (error) {
    console.error("Could not load chat history:", error);
  } finally {
    setChatsLoaded(true);
  }
}, []);

useEffect(() => {
  if (!chatsLoaded) return;

  localStorage.setItem(
    "sql-companion-chats",
    JSON.stringify(chats)
  );
}, [chats, chatsLoaded]);

  async function askQuestion() {
  if (!question.trim() || loading) return;

  setLoading(true);
  setAnswer("");
  setError("");

  const updatedMessages: Message[] = [
    ...messages,
    { role: "user", content: question },
  ];
  const chatId = activeChatId ?? crypto.randomUUID();
setActiveChatId(chatId);
  setQuestion("");
  setMessages(updatedMessages);
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: question,
        messages: updatedMessages,
      }),
    });

    if (!response.ok || !response.body) {
      const data = await response.json();
      throw new Error(data.error || "Something went wrong.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullAnswer = "";

    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const content = line.slice(6).trim();

        if (content === "[DONE]") continue;

        try {
          const parsed = JSON.parse(content);
          const token = parsed.choices?.[0]?.delta?.content ?? "";

          fullAnswer += token;
          setAnswer(fullAnswer);
        } catch {
          // Ignore incomplete streaming chunks.
        }
      }
    }

    const completeMessages: Message[] = [
  ...updatedMessages,
  { role: "assistant", content: fullAnswer },
];

setMessages(completeMessages);

setChats((previousChats) => {
  const existingChat = previousChats.find(
    (chat) => chat.id === chatId
  );

  const updatedChat: Chat = {
    id: chatId,
    title: updatedMessages[0].content.slice(0, 50),
    messages: completeMessages,
    updatedAt: Date.now(),
  };

  if (existingChat) {
    return previousChats.map((chat) =>
      chat.id === chatId ? updatedChat : chat
    );
  }

  return [updatedChat, ...previousChats];
});

  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Something went wrong."
    );
  } finally {
    setLoading(false);
  }
}

  
return (
  <main className="h-screen bg-white text-gray-900">
    <div className="mx-auto flex h-full max-w-3xl flex-col px-5">

      {/* Header */}<header className="flex shrink-0 items-center justify-between border-b border-gray-100 py-5">
  <div>
    <div className="text-sm font-bold tracking-widest text-blue-600">
      SQL COMPANION
    </div>
    <p className="mt-1 text-xs text-gray-500">
      SQL, made understandable.
    </p>
  </div>

  <button
    onClick={() => {
      setMessages([]);
      setActiveChatId(null);
      setQuestion("");
      setAnswer("");
      setError("");
    }}
    disabled={loading}
    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
  >
    + New Question
  </button>
  <button
  onClick={() => setShowHistory((current) => !current)}
  disabled={loading}
  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40"
>
  History ({chats.length})
</button>
</header>
{showHistory && (
  <div className="shrink-0 border-b border-gray-100 py-4">
    <h2 className="mb-3 text-sm font-semibold text-gray-700">
      Recent conversations
    </h2>
    <input
  type="text"
  placeholder="Search conversations..."
  onChange={(e) => setHistorySearch(e.target.value)}
  className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
/>

    {chats.length === 0 ? (
      <p className="text-sm text-gray-500">
        No saved conversations yet.
      </p>
    ) : (
      <div className="max-h-60 space-y-2 overflow-y-auto">
        {chats
  .filter((chat) =>
    chat.title.toLowerCase().includes(historySearch.toLowerCase()) ||
    chat.messages.some((message) =>
      message.content.toLowerCase().includes(historySearch.toLowerCase())
    )
  )
  .map((chat) => (
          <button
            key={chat.id}
            onClick={() => {
              setActiveChatId(chat.id);
              setMessages(chat.messages);
              setQuestion("");
              setAnswer("");
              setError("");
              setShowHistory(false);
            }}
            className={`block w-full rounded-lg px-3 py-3 text-left text-sm transition hover:bg-gray-50 ${
              activeChatId === chat.id
                ? "bg-gray-50 font-medium"
                : ""
            }`}
          >
            <span className="block truncate">
              {chat.title}
            </span>
            <span className="mt-1 block text-xs text-gray-400">
              {new Date(chat.updatedAt).toLocaleString()}
            </span>
          </button>
        ))}
      </div>
    )}
  </div>
)}

      {/* Conversation */}
      <section className="flex-1 overflow-y-auto py-8">
        {messages.length === 0 && !answer && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <h1 className="text-3xl font-semibold tracking-tight">
              What can I help you with?
            </h1>
            <p className="mt-3 text-sm text-gray-500">
              Ask anything about PostgreSQL in plain English.
            </p>
          </div>
        )}

        <div className="space-y-10">
          {messages.map((msg, index) => (
            <div key={index}>
              {msg.role === "user" ? (
                <div className="flex justify-end">
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-gray-100 px-5 py-3 text-sm leading-7 text-gray-900">
                    {msg.content}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-xs font-semibold tracking-wide text-blue-600">
                    SQL COMPANION
                  </div>

                  <div className="space-y-5 text-[15px] leading-7 text-slate-700">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        h1: ({ ...props }) => (
                          <h1 className="text-2xl font-bold text-slate-900" {...props} />
                        ),
                        h2: ({ ...props }) => (
                          <h2 className="border-b border-slate-200 pb-2 text-xl font-semibold text-slate-900" {...props} />
                        ),
                        h3: ({ ...props }) => (
                          <h3 className="text-lg font-semibold text-slate-900" {...props} />
                        ),
                        p: ({ ...props }) => (
                          <p className="leading-7" {...props} />
                        ),
                        strong: ({ ...props }) => (
                          <strong className="font-semibold text-slate-900" {...props} />
                        ),
                        ul: ({ ...props }) => (
                          <ul className="list-disc space-y-2 pl-6" {...props} />
                        ),
                        ol: ({ ...props }) => (
                          <ol className="list-decimal space-y-2 pl-6" {...props} />
                        ),
                        li: ({ ...props }) => (
                          <li className="pl-1" {...props} />
                        ),
                        code: ({ className, children, ...props }) => (
                          <code
                            className={`rounded bg-slate-100 px-1.5 py-0.5 font-mono text-sm text-rose-700 ${className ?? ""}`}
                            {...props}
                          >
                            {children}
                          </code>
                        ),
                        pre: ({ ...props }) => (
                          <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 p-5 text-sm leading-6 text-slate-100 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-slate-100" {...props} />
                        ),
                        table: ({ ...props }) => (
                          <div className="overflow-x-auto rounded-xl border border-slate-200">
                            <table className="w-full text-left text-sm" {...props} />
                          </div>
                        ),
                        th: ({ ...props }) => (
                          <th className="bg-slate-100 px-4 py-3 font-semibold text-slate-800" {...props} />
                        ),
                        td: ({ ...props }) => (
                          <td className="border-t border-slate-200 px-4 py-3" {...props} />
                        ),
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Current streaming response */}
          {loading && (
            <div className="space-y-3">
              <div className="text-xs font-semibold tracking-wide text-blue-600">
                SQL COMPANION
              </div>

              {answer ? (
                <div className="space-y-5 text-[15px] leading-7 text-slate-700">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {answer}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="animate-pulse text-sm text-gray-400">
                  Thinking...
                </p>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}
        <div ref={bottomRef} />
      </section>

      {/* Input */}
      <footer className="shrink-0 border-t border-gray-100 bg-white py-4">
        <div className="flex items-end gap-3 rounded-2xl border border-gray-200 p-3 shadow-sm focus-within:border-blue-400">
          <textarea
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                askQuestion();
              }
            }}
            placeholder="Ask a follow-up question..."
            rows={2}
            className="max-h-40 min-h-12 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-gray-400"
          />

          <button
            onClick={askQuestion}
            disabled={!question.trim() || loading}
            className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "..." : "↑"}
          </button>
        </div>

        <p className="mt-2 text-center text-xs text-gray-400">
          Enter to send · Shift + Enter for a new line
        </p>
      </footer>

    </div>
  </main>
);

}
