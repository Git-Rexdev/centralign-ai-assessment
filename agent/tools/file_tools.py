"""
File system tools for the agent: read/write invoice data and audit log.
"""
import json
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "data")
INVOICES_FILE = os.path.join(DATA_DIR, "invoices.json")
ENTRIES_FILE = os.path.join(DATA_DIR, "entries.json")
AUDIT_FILE = os.path.join(DATA_DIR, "audit_log.json")


def _read_json(path: str, default=None):
    if default is None:
        default = []
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: str, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def list_invoices(company_filter: str = "") -> dict:
    """List invoices from the inbox, optionally filtered by company name."""
    invoices = _read_json(INVOICES_FILE)
    if company_filter:
        invoices = [
            inv for inv in invoices
            if company_filter.lower() in inv.get("company", "").lower()
        ]
    return {"success": True, "invoices": invoices, "count": len(invoices)}


def get_invoice(invoice_id: str) -> dict:
    """Get a specific invoice by ID."""
    invoices = _read_json(INVOICES_FILE)
    for inv in invoices:
        if inv.get("id") == invoice_id:
            return {"success": True, "invoice": inv}
    return {"success": False, "error": f"Invoice {invoice_id} not found"}


def get_latest_invoice(company: str) -> dict:
    """Get the most recent invoice from a specific company."""
    invoices = _read_json(INVOICES_FILE)
    matches = [
        inv for inv in invoices
        if company.lower() in inv.get("company", "").lower()
    ]
    if not matches:
        return {"success": False, "error": f"No invoices found for company: {company}"}
    # Sort by received_date descending
    matches.sort(key=lambda x: x.get("received_date", ""), reverse=True)
    return {"success": True, "invoice": matches[0]}


def record_entry(invoice_id: str, amount: float, due_date: str, company: str, notes: str = "") -> dict:
    """Record an invoice entry into the internal system."""
    entries = _read_json(ENTRIES_FILE)
    entry = {
        "id": f"ENTRY-{len(entries) + 1:04d}",
        "invoice_id": invoice_id,
        "company": company,
        "amount": amount,
        "due_date": due_date,
        "notes": notes,
        "recorded_at": datetime.now().isoformat(),
        "status": "recorded"
    }
    entries.append(entry)
    _write_json(ENTRIES_FILE, entries)

    # Update invoice status
    invoices = _read_json(INVOICES_FILE)
    for inv in invoices:
        if inv.get("id") == invoice_id:
            inv["status"] = "processed"
            break
    _write_json(INVOICES_FILE, invoices)

    entry_id = entry["id"]
    return {"success": True, "entry": entry, "message": f"Invoice {invoice_id} recorded as entry {entry_id}"}


def verify_entry(invoice_id: str) -> dict:
    """Verify that an invoice has been recorded in the internal system."""
    entries = _read_json(ENTRIES_FILE)
    matches = [e for e in entries if e.get("invoice_id") == invoice_id]
    if matches:
        return {"success": True, "verified": True, "entry": matches[-1]}
    return {"success": True, "verified": False, "message": f"No entry found for invoice {invoice_id}"}


def append_audit(event: str, details: dict):
    """Append an event to the audit log (internal, not an agent tool)."""
    log = _read_json(AUDIT_FILE)
    log.append({
        "timestamp": datetime.now().isoformat(),
        "event": event,
        "details": details
    })
    _write_json(AUDIT_FILE, log)
