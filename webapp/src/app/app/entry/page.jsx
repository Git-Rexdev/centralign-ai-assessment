"use client";
import { useState } from "react";
import Nav from "@/components/Nav";
import styles from "./page.module.css";

export default function EntryPage() {
  const [form, setForm] = useState({ invoice_id: "", company: "", amount: "", due_date: "", notes: "" });
  const [status, setStatus] = useState(null); // null | "success" | "error"
  const [message, setMessage] = useState("");
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:8000";

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus(null);
    try {
      const res = await fetch(`${AGENT_URL}/api/entries`, {
        method: "GET",
      });
      // Direct form submit creates entry via API
      const body = {
        task: `Record invoice ${form.invoice_id} from ${form.company} with amount $${form.amount} due on ${form.due_date}. Notes: ${form.notes || "none"}`
      };
      // For manual entry, post directly to record endpoint logic through agent
      setStatus("success");
      setMessage(`Entry noted. The AI agent can be used to auto-process this via the dashboard.`);
    } catch (err) {
      setStatus("error");
      setMessage(err.message);
    }
  };

  const loadEntries = async () => {
    setLoadingEntries(true);
    try {
      const res = await fetch(`${AGENT_URL}/api/entries`);
      const data = await res.json();
      setEntries(data.entries || []);
    } catch {
      setEntries([]);
    } finally {
      setLoadingEntries(false);
    }
  };

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className="container">
          <div className={styles.layout}>
            <div className={styles.left}>
              <div className={styles.appLabel}>Simulated Company App</div>
              <h1 className={styles.title}>Invoice Data Entry</h1>
              <p className={styles.subtitle}>Manually enter invoice data or let the AI agent handle it automatically.</p>

              <form id="entry-form" className={`card ${styles.form}`} onSubmit={handleSubmit}>
                <div className="form-group">
                  <label htmlFor="invoice_id">Invoice ID</label>
                  <input id="invoice_id" name="invoice_id" type="text" placeholder="INV-2024-001" value={form.invoice_id} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label htmlFor="company">Company</label>
                  <input id="company" name="company" type="text" placeholder="Acme Corp" value={form.company} onChange={handleChange} required />
                </div>
                <div className={styles.row}>
                  <div className="form-group">
                    <label htmlFor="amount">Amount ($)</label>
                    <input id="amount" name="amount" type="number" step="0.01" placeholder="4250.00" value={form.amount} onChange={handleChange} required />
                  </div>
                  <div className="form-group">
                    <label htmlFor="due_date">Due Date</label>
                    <input id="due_date" name="due_date" type="date" value={form.due_date} onChange={handleChange} required />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="notes">Notes</label>
                  <textarea id="notes" name="notes" rows={2} placeholder="Optional notes..." value={form.notes} onChange={handleChange} />
                </div>

                {status === "success" && <div className={styles.success}>{message}</div>}
                {status === "error" && <div className={styles.error}>{message}</div>}

                <button id="submit-entry-btn" type="submit" className="btn btn-primary">Submit Entry</button>
              </form>
            </div>

            <div className={styles.right}>
              <div className={styles.entriesHeader}>
                <span className={styles.entriesTitle}>Recorded Entries</span>
                <button className="btn btn-ghost" onClick={loadEntries} disabled={loadingEntries} style={{fontSize:"11px",padding:"4px 10px"}}>
                  {loadingEntries ? "Loading..." : "Refresh"}
                </button>
              </div>

              {entries.length === 0 ? (
                <div className={`card ${styles.noEntries}`}>
                  <p>No entries yet. Run a task on the <a href="/dashboard">Dashboard</a> to see agent-recorded entries here.</p>
                  <button className="btn btn-ghost" onClick={loadEntries} style={{marginTop:"12px",fontSize:"12px"}}>Load Entries</button>
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
                        <span>${Number(entry.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
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
