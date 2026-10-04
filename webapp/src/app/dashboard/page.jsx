"use client";
import { useState, useRef, useEffect } from "react";
import Nav from "@/components/Nav";
import ErrorBanner from "@/components/ErrorBanner";
import logger from "@/lib/frontendLogger";
import { parseBackendError } from "@/lib/errorParser";
import styles from "./page.module.css";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

const PRESET_TASKS = [
  "Find the latest invoice from Acme Corp, extract the amount and due date, enter it into our internal system, and tell me once it is done.",
  "Find all pending invoices, process the one with the earliest due date, and verify it was recorded correctly.",
  "Look up invoice INV-2024-002 from TechFlow Ltd, extract the details, and record it in the accounting system.",
];

function LogEntry({ entry }) {
  const [showDetails, setShowDetails] = useState(false);

  const cls = {
    thinking: styles.logThinking,
    tool_call: styles.logTool,
    tool_result: entry.data?.success ? styles.logResultOk : styles.logResultFail,
    agent_response: styles.logResponse,
    error: styles.logError,
    task_complete: styles.logComplete,
    task_start: styles.logMuted,
    done: styles.logComplete,
  }[entry.type] || styles.logMuted;

  const renderContent = () => {
    switch (entry.type) {
      case "task_start":
        return <span>Task started: {entry.data?.model} ({entry.data?.provider || "agent"})</span>;
      case "thinking":
        return <span>Thinking... (step {entry.data?.iteration})</span>;
      case "tool_call":
        return (
          <span>
            <span className={styles.toolName}>{entry.data?.tool}</span>
            {"  "}
            <span className={styles.toolArgs}>{JSON.stringify(entry.data?.args)}</span>
          </span>
        );
      case "tool_result": {
        const isOk = entry.data?.success;
        const r = entry.data?.result;
        if (!isOk) {
          const errMsg =
            r?.error || r?.message || (typeof r === "string" ? r : "Action could not be completed");
          return (
            <div className={styles.logToolFailBlock}>
              <span className={styles.fail}>[FAIL]</span>
              {" "}
              <span className={styles.toolFailMsg}>
                Tool execution failed: {String(errMsg).slice(0, 120)}
              </span>
              <button
                type="button"
                className={styles.logDetailsBtn}
                onClick={() => setShowDetails((prev) => !prev)}
              >
                {showDetails ? "Hide Details" : "Details"}
              </button>
              {showDetails && (
                <pre className={styles.logRawError}>
                  {JSON.stringify(r, null, 2)}
                </pre>
              )}
            </div>
          );
        }
        const preview = JSON.stringify(r)?.slice(0, 180);
        return (
          <span>
            <span className={styles.ok}>[OK]</span>
            {"  "}
            {preview}
          </span>
        );
      }
      case "agent_response":
        return <span className={styles.finalResponse}>{entry.data?.text}</span>;
      case "error": {
        const parsed = parseBackendError(entry.data?.raw || entry.data?.message || entry.data);
        return (
          <div className={styles.logErrorBlock}>
            <div className={styles.logErrorSummary}>
              <span className={styles.logErrorTitle}>{parsed.title}:</span>
              <span className={styles.logErrorMessage}>{parsed.message}</span>
              <button
                type="button"
                className={styles.logDetailsBtn}
                onClick={() => setShowDetails((prev) => !prev)}
              >
                {showDetails ? "Hide Raw Error" : "View Raw Error"}
              </button>
            </div>
            {showDetails && (
              <pre className={styles.logRawError}>
                {parsed.raw || JSON.stringify(entry.data, null, 2)}
              </pre>
            )}
          </div>
        );
      }
      case "task_complete":
        return (
          <span>
            {entry.data?.success ? "Task completed" : "Task failed"} -{" "}
            {entry.data?.iterations} step{entry.data?.iterations !== 1 ? "s" : ""}
          </span>
        );
      default:
        return <span>{JSON.stringify(entry.data)}</span>;
    }
  };

  return (
    <div className={`${styles.logEntry} ${cls}`}>
      <span className={styles.logTime}>
        {new Date(entry.timestamp * 1000).toLocaleTimeString("en", { hour12: false })}
      </span>
      <span className={styles.logType}>[{entry.type}]</span>
      <span className={styles.logContent}>{renderContent()}</span>
    </div>
  );
}

export default function DashboardPage() {
  const [task, setTask] = useState("");
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [errorInfo, setErrorInfo] = useState(null);
  const logEndRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const runTask = async () => {
    if (!task.trim() || running) return;
    setErrorInfo(null);
    setRunning(true);
    setStatus("running");
    setLog([]);

    logger.info("Dashboard", "Starting task execution", { task });

    try {
      const res = await fetch(`${AGENT_URL}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });

      if (!res.ok) {
        let errDetails = "";
        try {
          const errJson = await res.json();
          errDetails = errJson.detail || errJson.error || JSON.stringify(errJson);
        } catch {
          errDetails = await res.text().catch(() => "");
        }
        const errorObj = {
          status: res.status,
          message: errDetails || `Server responded with status code ${res.status}`,
        };
        throw errorObj;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let hasEncounteredError = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop();

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const event = JSON.parse(raw);

            if (event.type === "error") {
              hasEncounteredError = true;
              const parsed = parseBackendError(event.data?.message || event.data);
              setErrorInfo(parsed);
              setStatus("error");
              logger.error("AgentAPI", parsed.message, {
                category: parsed.category,
                action: parsed.action,
                raw: parsed.raw,
                statusCode: parsed.statusCode,
                url: `${AGENT_URL}/api/run`,
              });
              setLog((prev) => [
                ...prev,
                {
                  ...event,
                  data: {
                    ...event.data,
                    message: parsed.message,
                    raw: parsed.raw,
                    title: parsed.title,
                  },
                },
              ]);
              continue;
            }

            if (event.type === "task_complete" && !event.data?.success) {
              hasEncounteredError = true;
              setStatus("error");
              const parsed = parseBackendError(
                event.data?.summary || "Agent task did not complete successfully"
              );
              setErrorInfo((current) => current || parsed);
              logger.error("AgentAPI", "Task failed to complete", {
                category: parsed.category,
                summary: event.data?.summary,
                iterations: event.data?.iterations,
              });
            }

            if (event.type === "done") {
              if (!hasEncounteredError) {
                setStatus("done");
                logger.info("Dashboard", "Task completed successfully");
              }
              break;
            }

            setLog((prev) => [...prev, event]);
          } catch (parseErr) {
            logger.warn("Dashboard", "Failed to parse SSE line", { raw, parseErr: String(parseErr) });
          }
        }
      }
    } catch (err) {
      const parsed = parseBackendError(err);
      setErrorInfo(parsed);
      setStatus("error");

      logger.error("Dashboard", parsed.message, {
        category: parsed.category,
        action: parsed.action,
        raw: parsed.raw,
        statusCode: parsed.statusCode,
        url: `${AGENT_URL}/api/run`,
      });

      setLog((prev) => [
        ...prev,
        {
          type: "error",
          data: {
            message: parsed.message,
            title: parsed.title,
            raw: parsed.raw,
            category: parsed.category,
          },
          timestamp: Date.now() / 1000,
        },
      ]);
    } finally {
      setRunning(false);
    }
  };

  const clearLog = () => {
    setErrorInfo(null);
    setLog([]);
    setStatus("idle");
    setTask("");
    logger.debug("Dashboard", "Cleared execution log");
  };

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Agent Dashboard</h1>
              <p className={styles.subtitle}>
                Submit a natural language task and watch the agent execute it in real time.
              </p>
            </div>
            <div className={styles.statusPill} data-status={status}>
              <span className={styles.statusDot} />
              {status === "idle"
                ? "Ready"
                : status === "running"
                ? "Running"
                : status === "done"
                ? "Complete"
                : "Error"}
            </div>
          </div>

          <div className={styles.inputSection}>
            <textarea
              id="task-input"
              className={styles.taskInput}
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder='e.g. "Find the latest invoice from Acme Corp, extract the amount and due date, enter it into our internal system."'
              rows={3}
              disabled={running}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runTask();
              }}
            />
            <div className={styles.inputActions}>
              <div className={styles.presets}>
                {PRESET_TASKS.map((pt, i) => (
                  <button
                    key={i}
                    className={`btn btn-ghost ${styles.presetBtn}`}
                    onClick={() => {
                      setTask(pt);
                      setErrorInfo(null);
                    }}
                    disabled={running}
                  >
                    Preset {i + 1}
                  </button>
                ))}
              </div>
              <div className={styles.actionBtns}>
                <button className="btn btn-ghost" onClick={clearLog} disabled={running}>
                  Clear
                </button>
                <button
                  id="run-task-btn"
                  className="btn btn-primary"
                  onClick={runTask}
                  disabled={running || !task.trim()}
                >
                  {running ? "Running..." : "Run Task"}
                </button>
              </div>
            </div>
          </div>

          {errorInfo && (
            <ErrorBanner
              error={errorInfo}
              onRetry={runTask}
              onDismiss={() => setErrorInfo(null)}
            />
          )}

          <div className={styles.logPanel}>
            <div className={styles.logHeader}>
              <span className={styles.logTitle}>Execution Log</span>
              <span className={styles.logCount}>{log.length} events</span>
            </div>
            <div className={styles.logBody}>
              {log.length === 0 && (
                <div className={styles.logEmpty}>
                  No events yet. Submit a task to start.
                </div>
              )}
              {log.map((entry, i) => (
                <LogEntry key={i} entry={entry} />
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          {status === "done" && (
            <div className={styles.successBanner}>
              Task completed. Check the{" "}
              <a href="/app/entry">Data Entry</a> page to confirm the recorded entry.
            </div>
          )}
        </div>
      </main>
    </>
  );
}
