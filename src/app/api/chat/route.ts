import { NextRequest, NextResponse } from "next/server";
import { searchSqlReference } from "@/lib/sql-reference";

export async function POST(request: NextRequest) {
  try {
    const { message, messages = [] } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Please provide a question." },
        { status: 400 }
      );
    }

    const relevantEntries = searchSqlReference(message, 8);

    const knowledgeContext = relevantEntries
      .map(
        (entry) => `
Category: ${entry.category}
Type: ${entry.type}
Keyword: ${entry.keyword}
Description: ${entry.description}
Example: ${entry.example}
`
      )
      .join("\n---\n");

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:3001",
          "X-Title": "SQL Companion",
        },
        body: JSON.stringify({
          model: "openrouter/free",
          stream: true,
          messages: [
  {
    role: "system",
    content: `
You are SQL Companion, an expert PostgreSQL assistant.

Use the supplied knowledge base as your primary reference.

Rules:
1. Prefer information from the supplied knowledge base.
2. Never invent knowledge-base entries.
3. Use general PostgreSQL knowledge when needed.
4. Generate syntactically correct PostgreSQL queries.
5. Explain queries clearly and concisely.
6. Format SQL using Markdown code blocks.
7. Understand and answer follow-up questions using conversation history.
8. Ask for clarification when a question is ambiguous.
    `,
  },
  ...messages.map((msg: { role: string; content: string }) => ({
    role: msg.role,
    content: msg.role === "user" && msg === messages[messages.length - 1]
      ? `${msg.content}

RELEVANT ENTRIES FROM MY SQL KNOWLEDGE BASE:
${knowledgeContext || "No matching entries were found."}`
      : msg.content,
  })),
],
        }),
      }
    );

    if (!response.ok || !response.body) {
      const errorText = await response.text();

      return NextResponse.json(
        { error: errorText || "OpenRouter request failed." },
        { status: response.status }
      );
    }

    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}