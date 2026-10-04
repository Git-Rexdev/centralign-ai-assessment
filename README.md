# Autonomous AI Task Worker

A prototype of an autonomous AI agent that accepts natural language tasks and executes them end-to-end — using LLM reasoning, browser automation, file tools, and a simulated company application.

## Architecture

```
webapp/          Next.js app (dashboard UI + simulated company app)
  src/app/
    page.jsx         Home page
    dashboard/       Agent dashboard with live execution log
    app/invoices/    Simulated invoice inbox
    app/entry/       Simulated data entry form
    api/             Next.js API routes (invoices, entries)

agent/           Python AI agent
  agent.py         Core agent loop (Gemini + tool execution)
  server.py        FastAPI server with SSE streaming
  tools/
    browser_tools.py  Playwright browser automation
    file_tools.py     File-based invoice/entry data access
    tool_definitions.py  Gemini function calling schemas

data/            JSON data store
  invoices.json    Invoice inbox seed data
  entries.json     Recorded entries (auto-created)
  audit_log.json   Agent audit trail (auto-created)
```

## How It Works

1. User submits a natural language task (e.g. _"Find the latest invoice from Acme Corp, extract the amount and due date, enter it into our internal system"_)
2. The **FastAPI server** receives the task and streams events back via Server-Sent Events
3. The **Gemini agent** reasons about the task, calls tools (file lookup, browser navigation, form filling)
4. Each tool action is observed; the agent decides the next step
5. On failure, the agent retries or tries an alternative
6. After recording, the agent **verifies** the entry exists
7. A final summary with evidence is returned to the dashboard

## Stack

- **LLM**: Cerebras Cloud (`llama3.1-8b` ~1,800 tokens/sec, with Groq & Gemini fallbacks)
- **Browser**: Playwright (Python, Chromium headless)
- **Agent API**: FastAPI + Server-Sent Events
- **Frontend**: Next.js (App Router, JSX, vanilla CSS)
- **Data**: JSON files (no database required)

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Cerebras API key (free at [cloud.cerebras.ai](https://cloud.cerebras.ai)), Groq API key, or Google Gemini key

### 1. Configure the agent

```bash
cd agent
copy .env.example .env    # or cp .env .env.local on Mac/Linux
# Edit .env and set CEREBRAS_API_KEY=csk-... (or GROQ_API_KEY / GEMINI_API_KEY)
```

### 2. Install Python dependencies

```bash
cd agent
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Mac/Linux
pip install -r requirements.txt
playwright install chromium
```

### 3. Install Node dependencies

```bash
cd webapp
npm install
```

### 4. Run both servers

**Terminal 1 — Agent API:**
```bash
cd agent
.venv\Scripts\activate
python server.py
# Runs on http://localhost:8000
```

**Terminal 2 — Web App:**
```bash
cd webapp
npm run dev
# Runs on http://localhost:3000
```

### 5. Open the dashboard

Go to [http://localhost:3000/dashboard](http://localhost:3000/dashboard), enter a task, and watch the agent execute it.

## Example Tasks

- `Find the latest invoice from Acme Corp, extract the amount and due date, enter it into our internal system, and tell me once it is done.`
- `Find all pending invoices and process the one with the earliest due date.`
- `Look up invoice INV-2024-002 from TechFlow Ltd and record it in the accounting system.`

## CLI Usage

```bash
cd agent
.venv\Scripts\activate
python agent.py "Find the latest invoice from Acme Corp and record it in the system"
```

## Evaluation Notes

| Criterion | Implementation |
|-----------|----------------|
| **Autonomy** | Agent determines all steps from a single natural language goal |
| **Execution** | Real Playwright browser automation + file reads/writes |
| **Reliability** | Retry logic on tool failure; alternative strategies |
| **Verification** | `verify_entry` tool confirms recording after completion |
| **Generalization** | Tool system is task-agnostic; new tools can be added without changing agent loop |
| **Engineering Quality** | Clean separation of concerns: tools / agent loop / API / UI |
| **Product Thinking** | Focused on user goal (invoice processed + confirmed), not individual steps |

## Known Limitations

- Supports invoice processing domain only (intentional narrow scope)
- No persistent memory across sessions
- Browser automation is Chromium-only
- No real OCR — invoice data comes from structured JSON

## What I Would Build Next

- Vision-based document reading (real invoice PDFs with OCR)
- Persistent memory store (SQLite or Redis)
- Multi-task parallelization
- Human-in-the-loop approval flow for high-value invoices
- Evaluation harness with automated pass/fail scoring

## Architecture Decisions

- **Narrow scope over broad mocking**: A real invoice workflow that genuinely executes beats a broad system that fakes most steps
- **SSE over WebSockets**: Simpler, HTTP-native, one-directional — perfect for streaming agent events
- **JSON file store**: Zero setup, portable, inspectable — right for a prototype
- **Tool-as-function pattern**: Each capability is an independently testable function; the agent just chooses which to call
