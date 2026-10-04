"use client";
import { useState, useRef, useEffect } from "react";
import Nav from "@/components/Nav";
import styles from "./page.module.css";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

const PRESET_TASKS = [
  "Find the latest invoice from Acme Corp, extract the amount and due date, enter it into our internal system, and tell me once it is done.",
  "Find all pending invoices, process the one with the earliest due date, and verify it was recorded correctly.",
  "Look up invoice INV-2024-002 from TechFlow Ltd, extract the details, and record it in the accounting system.",
];

function LogEntry({ entry }) {
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
        return <span>Task started &mdash; {entry.data?.model}</span>;
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
        const r = entry.data?.result;
        const preview = JSON.stringify(r)?.slice(0, 180);
        return (
          <span>
            <span className={entry.data?.success ? styles.ok : styles.fail}>
              {entry.data?.success ? "[OK]" : "[FAIL]"}
            </span>
            {"  "}
            {preview}
          </span>
        );
      }
      case "agent_response":
        return <span className={styles.finalResponse}>{entry.data?.text}</span>;
      case "error":
        return <span>Error: {entry.data?.message}</span>;
      case "task_complete":
        return (
          <span>
            {entry.data?.success ? "Task completed" : "Task failed"} &mdash;{" "}
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
  const logEndRef = useRef(null);
  const esRef = useRef(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  const runTask = async () => {
    if (!task.trim() || running) return;
    setRunning(true);
    setStatus("running");
    setLog([]);

    try {
      const res = await fetch(`${AGENT_URL}/api/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            if (event.type === "done") {
              setStatus("done");
              break;
            }
            setLog((prev) => [...prev, event]);
          } catch {}
        }
      }
    } catch (err) {
      setLog((prev) => [
        ...prev,
        { type: "error", data: { message: err.message }, timestamp: Date.now() / 1000 },
      ]);
      setStatus("error");
    } finally {
      setRunning(false);
    }
  };

  const clearLog = () => {
    setLog([]);
    setStatus("idle");
    setTask("");
  };

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.header}>
            <div>
              <h1 className={styles.title}>Agent Dashboard</h1>
              <p className={styles.subtitle}>Submit a natural language task and watch the agent execute it in real time.</p>
            </div>
            <div className={styles.statusPill} data-status={status}>
              <span className={styles.statusDot} />
              {status === "idle" ? "Ready" : status === "running" ? "Running" : status === "done" ? "Complete" : "Error"}
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
                    onClick={() => setTask(pt)}
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
