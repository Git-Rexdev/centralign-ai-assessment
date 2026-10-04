"use client";
import { useState, useEffect } from "react";
import Nav from "@/components/Nav";
import logger from "@/lib/frontendLogger";
import { parseBackendError } from "@/lib/errorParser";
import styles from "./page.module.css";

export default function EntryPage() {
  const [form, setForm] = useState({ invoice_id: "", company: "", amount: "", due_date: "", notes: "" });
  const [status, setStatus] = useState(null); // null | "success" | "error"
  const [statusMessage, setStatusMessage] = useState("");
  const [errorDetails, setErrorDetails] = useState(null);
  const [showErrorRaw, setShowErrorRaw] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [entriesError, setEntriesError] = useState(null);

  const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    setErrorDetails(null);
    setShowErrorRaw(false);

    try {
      // Test connectivity to entries endpoint
      const res = await fetch(`${AGENT_URL}/api/entries`);
      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
      setStatus("success");
      setStatusMessage("Entry noted. The AI agent can process invoices autonomously via the dashboard.");
    } catch (err) {
      const parsed = parseBackendError(err, "Data Entry");
      logger.error("DataEntry", parsed.message, {
        category: parsed.category,
        action: parsed.action,
        raw: parsed.raw,
        url: `${AGENT_URL}/api/entries`,
      });
      setStatus("error");
      setStatusMessage(parsed.message);
      setErrorDetails(parsed);
    }
  };

  const loadEntries = async () => {
    setLoadingEntries(true);
    setEntriesError(null);

    // Try agent backend first, then fall back to local Next.js route
    let succeeded = false;
    let lastError = null;

    for (const url of [`${AGENT_URL}/api/entries`, "/api/entries"]) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setEntries(data.entries || []);
        succeeded = true;
        break;
      } catch (err) {
        lastError = err;
      }
    }

    if (!succeeded) {
      const parsed = parseBackendError(lastError, "Entries Store");
      logger.error("DataEntry", "Failed to retrieve recorded entries", {
        category: parsed.category,
        action: parsed.action,
        raw: parsed.raw,
      });
      setEntries([]);
      setEntriesError(parsed);
    }

    setLoadingEntries(false);
  };

  useEffect(() => {
    loadEntries();
  }, []);

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.layout}>
            <div className={styles.left}>
              <div className={styles.appLabel}>Simulated Company App</div>
              <h1 className={styles.title}>Invoice Data Entry</h1>
              <p className={styles.subtitle}>
                Manually enter invoice data or let the AI agent handle it automatically.
              </p>

              <form id="entry-form" className={`card ${styles.form}`} onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="invoice_id">Invoice ID</label>
                  <input
                    id="invoice_id"
                    name="invoice_id"
                    type="text"
                    placeholder="INV-2024-001"
                    value={form.invoice_id}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="company">Company</label>
                  <input
                    id="company"
                    name="company"
                    type="text"
                    placeholder="Acme Corp"
                    value={form.company}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className={styles.row}>
                  <div className="form-group">
                    <label htmlFor="amount">Amount ($)</label>
                    <input
                      id="amount"
                      name="amount"
                      type="number"
                      step="0.01"
                      placeholder="4250.00"
                      value={form.amount}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="due_date">Due Date</label>
                    <input
                      id="due_date"
                      name="due_date"
                      type="date"
                      value={form.due_date}
                      onChange={handleChange}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    placeholder="Optional notes..."
                    value={form.notes}
                    onChange={handleChange}
                  />
                </div>

                {status === "success" && <div className={styles.success}>{statusMessage}</div>}
                {status === "error" && (
                  <div className={styles.error}>
                    <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                      {errorDetails?.title || "Submission Error"}
                    </div>
                    <div>{statusMessage}</div>
                    {errorDetails?.action && (
                      <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--text-muted)" }}>
                        Tip: {errorDetails.action}
                      </div>
                    )}
                    {errorDetails?.raw && (
                      <div style={{ marginTop: "8px" }}>
                        <button
                          type="button"
                          onClick={() => setShowErrorRaw(!showErrorRaw)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            fontSize: "11px",
                            textDecoration: "underline",
                            cursor: "pointer",
                            padding: 0,
                          }}
                        >
                          {showErrorRaw ? "Hide technical error" : "View technical error"}
                        </button>
                        {showErrorRaw && (
                          <pre
                            style={{
                              marginTop: "6px",
                              padding: "6px 8px",
                              background: "var(--surface)",
                              borderRadius: "var(--radius)",
                              fontSize: "11px",
                              fontFamily: "var(--mono)",
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-all",
                              color: "var(--text-muted)",
                            }}
                          >
                            {errorDetails.raw}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <button id="submit-entry-btn" type="submit" className="btn btn-primary">
                  Submit Entry
                </button>
              </form>
            </div>

            <div className={styles.right}>
              <div className={styles.entriesHeader}>
                <span className={styles.entriesTitle}>Recorded Entries</span>
                <button
                  className="btn btn-ghost"
                  onClick={loadEntries}
                  disabled={loadingEntries}
                  style={{ fontSize: "11px", padding: "4px 10px" }}
                >
                  {loadingEntries ? "Loading..." : "Refresh"}
                </button>
              </div>

              {entriesError ? (
                <div className={`card ${styles.noEntries}`}>
                  <p style={{ color: "var(--error)", marginBottom: "6px" }}>
                    {entriesError.title}: {entriesError.message}
                  </p>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                    {entriesError.action}
                  </p>
                  <button
                    className="btn btn-ghost"
                    onClick={loadEntries}
                    style={{ marginTop: "12px", fontSize: "12px" }}
                  >
                    Retry
                  </button>
                </div>
              ) : entries.length === 0 ? (
                <div className={`card ${styles.noEntries}`}>
                  <p>
                    No entries yet. Run a task on the <a href="/dashboard">Dashboard</a> to see
                    agent-recorded entries here.
                  </p>
                  <button
                    className="btn btn-ghost"
                    onClick={loadEntries}
                    style={{ marginTop: "12px", fontSize: "12px" }}
                  >
                    Load Entries
                  </button>
                </div>
              ) : (
                <div className={styles.entriesList}>
                  {entries.map((entry) => (
                    <div key={entry.id} className={`card ${styles.entryCard}`}>
                      <div className={styles.entryTop}>
                        <span className={styles.entryId}>{entry.id}</span>
                        <span className="badge badge-processed">{entry.status}</span>
                      </div>
                      <div className={styles.entryCompany}>{entry.company}</div>
                      <div className={styles.entryDetails}>
                        <span>
                          ${Number(entry.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        <span>Due {entry.due_date}</span>
                      </div>
                      <div className={styles.entryMeta}>Invoice: {entry.invoice_id}</div>
                      {entry.notes && <div className={styles.entryNotes}>{entry.notes}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
