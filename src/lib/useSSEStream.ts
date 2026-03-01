"use client";

import { useState, useRef, useCallback } from "react";

interface SSEStreamOptions {
  onEvent: (eventName: string, data: unknown) => void;
  onError?: (error: string) => void;
  onDone?: () => void;
}

export function useSSEStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  const start = useCallback(
    async (url: string, body: Record<string, unknown>, options: SSEStreamOptions) => {
      // Clean up any previous stream
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setIsStreaming(true);
      setError(null);

      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "Request failed");
          let message = "Request failed";
          try {
            const parsed = JSON.parse(text);
            message = parsed.error || message;
          } catch {
            message = text || message;
          }
          setError(message);
          setIsStreaming(false);
          options.onError?.(message);
          return;
        }

        if (!res.body) {
          setError("No response stream");
          setIsStreaming(false);
          options.onError?.("No response stream");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let currentEvent = "message";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          // Keep the last potentially incomplete line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed === "") {
              // Empty line - reset event type
              currentEvent = "message";
              continue;
            }
            if (trimmed.startsWith("event:")) {
              currentEvent = trimmed.slice(6).trim();
            } else if (trimmed.startsWith("data:")) {
              const dataStr = trimmed.slice(5).trim();
              try {
                const data = JSON.parse(dataStr);
                options.onEvent(currentEvent, data);
              } catch {
                // Non-JSON data, pass as string
                options.onEvent(currentEvent, dataStr);
              }
            }
          }
        }

        setIsStreaming(false);
        options.onDone?.();
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled - not an error
          setIsStreaming(false);
          return;
        }
        const message = err instanceof Error ? err.message : "Stream failed";
        setError(message);
        setIsStreaming(false);
        options.onError?.(message);
      }
    },
    []
  );

  return { start, stop, isStreaming, error };
}
