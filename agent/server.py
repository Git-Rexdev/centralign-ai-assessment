"""
FastAPI server: exposes the agent via HTTP + SSE streaming.
Also acts as a bridge between the Next.js dashboard and the Python agent.
"""
import asyncio
import json
import os
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv(override=True)

sys.path.insert(0, os.path.dirname(__file__))
from agent import Agent, AgentEvent
from tools.file_tools import list_invoices, verify_entry, _read_json, ENTRIES_FILE, AUDIT_FILE


app = FastAPI(title="AI Task Worker API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TaskRequest(BaseModel):
    task: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "AI Task Worker"}


@app.get("/api/invoices")
async def get_invoices(company: str = ""):
    result = list_invoices(company)
    return result


@app.get("/api/entries")
async def get_entries():
    entries = _read_json(ENTRIES_FILE)
    return {"entries": entries, "count": len(entries)}


@app.get("/api/audit")
async def get_audit():
    log = _read_json(AUDIT_FILE)
    return {"log": log, "count": len(log)}


@app.post("/api/run")
async def run_task_stream(request: TaskRequest):
    """Stream agent execution events as Server-Sent Events."""
    task = request.task.strip()
    if not task:
        raise HTTPException(status_code=400, detail="Task cannot be empty")

    async def event_stream() -> AsyncGenerator[str, None]:
        queue: asyncio.Queue[AgentEvent | None] = asyncio.Queue()

        def on_event(event: AgentEvent):
            queue.put_nowait(event)

        async def run_agent():
            agent = Agent(on_event=on_event)
            await agent.run(task)
            queue.put_nowait(None)  # Sentinel

        # Run agent in background
        agent_task = asyncio.create_task(run_agent())

        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=60.0)
            except asyncio.TimeoutError:
                yield "data: {\"type\": \"error\", \"data\": {\"message\": \"Timeout waiting for agent\"}}\n\n"
                break

            if event is None:
                yield "data: {\"type\": \"done\"}\n\n"
                break

            payload = json.dumps(event.to_dict())
            yield f"data: {payload}\n\n"

        if not agent_task.done():
            agent_task.cancel()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        }
    )


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("AGENT_PORT", "8000"))
    uvicorn.run("server:app", host="0.0.0.0", port=port, reload=False)
