"use client";
import { useEffect } from "react";
import Nav from "@/components/Nav";
import logger from "@/lib/frontendLogger";
import { parseBackendError } from "@/lib/errorParser";
import ErrorBanner from "@/components/ErrorBanner";

export default function GlobalError({ error, reset }) {
  const parsed = parseBackendError(error, "Application");

  useEffect(() => {
    logger.error("RouteError", parsed.message, {
      category: parsed.category,
      action: parsed.action,
      raw: error?.stack || String(error),
    });
  }, [error, parsed]);

  return (
    <>
      <Nav />
      <main style={{ padding: "40px 0 80px" }}>
        <div className="container" style={{ maxWidth: "800px" }}>
          <ErrorBanner
            error={parsed}
            onRetry={reset}
          />
        </div>
      </main>
    </>
  );
}
