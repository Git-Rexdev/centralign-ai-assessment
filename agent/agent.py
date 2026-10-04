"""
Core agent loop supporting Groq (with Gemini fallback) + tool execution + event streaming.
"""
import asyncio
import json
import os
import sys
import time
from typing import Callable, Optional
from dotenv import load_dotenv

from tools.tool_definitions import TOOL_DECLARATIONS, execute_tool
from tools.browser_tools import close_browser

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

load_dotenv(override=True)

CEREBRAS_API_KEY = os.getenv("CEREBRAS_API_KEY", "")
CEREBRAS_MODEL = os.getenv("CEREBRAS_MODEL", "qwen-3.8-27b")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
MAX_ITERATIONS = int(os.getenv("MAX_ITERATIONS", "20"))
APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:3000")

SYSTEM_PROMPT = f"""You are an autonomous AI task worker. You complete tasks involving invoices and internal systems.

The simulated company app is at {APP_BASE_URL}.
- Invoice inbox: {APP_BASE_URL}/app/invoices
- Data entry: {APP_BASE_URL}/app/entry

Rules:
1. Always verify your work after completing it using verify_entry.
2. If a tool fails, try an alternative or retry once.
3. Extract exact values. Never guess amounts or dates.
4. After recording, confirm with verify_entry before reporting done.
5. Return a concise summary with evidence (invoice ID, amount, due date, entry ID).
6. Use plain text formatting. Do not use emoji symbols, checkmarks, or em dashes in your response.
"""


def _build_openai_tools():
    """Convert TOOL_DECLARATIONS to OpenAI/Cerebras/Groq tool format."""
    return [
        {
            "type": "function",
            "function": {
                "name": decl["name"],
                "description": decl["description"],
                "parameters": decl["parameters"],
            },
        }
        for decl in TOOL_DECLARATIONS
    ]


_build_groq_tools = _build_openai_tools


class AgentEvent:
    def __init__(self, event_type: str, data: dict):
        self.event_type = event_type
        self.data = data
        self.timestamp = time.time()

    def to_dict(self):
        return {"type": self.event_type, "data": self.data, "timestamp": self.timestamp}


class Agent:
    def __init__(self, on_event: Optional[Callable[[AgentEvent], None]] = None):
        self.on_event = on_event or (lambda e: None)
        self.iteration = 0

        # Prioritize Cerebras, then Groq, then Gemini
        if CEREBRAS_API_KEY:
            from cerebras.cloud.sdk import AsyncCerebras
            self.provider = "cerebras"
            self.model_name = CEREBRAS_MODEL
            self.client = AsyncCerebras(api_key=CEREBRAS_API_KEY)
        elif GROQ_API_KEY:
            from groq import AsyncGroq
            self.provider = "groq"
            self.model_name = GROQ_MODEL
            self.client = AsyncGroq(api_key=GROQ_API_KEY)
        elif GEMINI_API_KEY:
            from google import genai
            self.provider = "gemini"
            self.model_name = GEMINI_MODEL
            self.gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        else:
            raise ValueError("No API key configured in .env (expected CEREBRAS_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY)")

    def emit(self, event_type: str, data: dict) -> AgentEvent:
        event = AgentEvent(event_type, data)
        self.on_event(event)
        return event

    async def run(self, task: str) -> dict:
        self.emit("task_start", {"task": task, "model": self.model_name, "provider": self.provider})

        if self.provider in ("cerebras", "groq"):
            return await self._run_openai_compatible(task)
        else:
            return await self._run_gemini(task)

    async def _run_openai_compatible(self, task: str) -> dict:
        tools = _build_openai_tools()
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": task},
        ]

        result = {"success": False, "summary": "", "iterations": 0}

        try:
            for self.iteration in range(MAX_ITERATIONS):
                self.emit("thinking", {"iteration": self.iteration + 1})

                response = await self.client.chat.completions.create(
                    model=self.model_name,
                    messages=messages,
                    tools=tools,
                    tool_choice="auto",
                    temperature=0.1,
                )

                message = response.choices[0].message
                tool_calls = message.tool_calls or []

                # Convert message object to dictionary for conversation history
                assistant_msg = {
                    "role": "assistant",
                    "content": message.content or "",
                }
                if tool_calls:
                    assistant_msg["tool_calls"] = [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            },
                        }
                        for tc in tool_calls
                    ]
                messages.append(assistant_msg)

                if not tool_calls:
                    # Model provided final text
                    final_text = message.content or ""
                    self.emit("agent_response", {"text": final_text})
                    result = {"success": True, "summary": final_text, "iterations": self.iteration + 1}
                    break

                # Execute tool calls
                for tc in tool_calls:
                    tool_name = tc.function.name
                    raw_args = tc.function.arguments or "{}"
                    try:
                        tool_args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
                    except Exception:
                        tool_args = {}

                    self.emit("tool_call", {"tool": tool_name, "args": tool_args})

                    tool_result = await execute_tool(tool_name, tool_args)

                    self.emit("tool_result", {
                        "tool": tool_name,
                        "result": tool_result,
                        "success": tool_result.get("success", False),
                    })

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "name": tool_name,
                        "content": json.dumps(tool_result),
                    })

            else:
                self.emit("error", {"message": f"Max iterations ({MAX_ITERATIONS}) reached"})
                result = {"success": False, "summary": "Max iterations reached", "iterations": MAX_ITERATIONS}

        except Exception as e:
            self.emit("error", {"message": str(e)})
            result = {"success": False, "summary": f"Agent error: {str(e)}", "iterations": self.iteration}
        finally:
            await close_browser()
            self.emit("task_complete", result)

        return result

    async def _run_gemini(self, task: str) -> dict:
        from google.genai import types

        declarations = []
        for decl in TOOL_DECLARATIONS:
            declarations.append(types.FunctionDeclaration(
                name=decl["name"],
                description=decl["description"],
                parameters=decl["parameters"],
            ))
        tools = [types.Tool(function_declarations=declarations)]

        contents = [types.Content(role="user", parts=[types.Part(text=task)])]
        config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=tools,
            temperature=0.1,
        )

        result = {"success": False, "summary": "", "iterations": 0}

        try:
            for self.iteration in range(MAX_ITERATIONS):
                self.emit("thinking", {"iteration": self.iteration + 1})

                response = self.gemini_client.models.generate_content(
                    model=self.model_name,
                    contents=contents,
                    config=config,
                )

                candidate = response.candidates[0]
                contents.append(candidate.content)

                function_calls = [
                    part.function_call
                    for part in candidate.content.parts
                    if part.function_call is not None
                ]

                if not function_calls:
                    final_text = "".join(
                        part.text for part in candidate.content.parts
                        if hasattr(part, "text") and part.text
                    )
                    self.emit("agent_response", {"text": final_text})
                    result = {"success": True, "summary": final_text, "iterations": self.iteration + 1}
                    break

                tool_response_parts = []
                for fc in function_calls:
                    tool_name = fc.name
                    tool_args = dict(fc.args) if fc.args else {}

                    self.emit("tool_call", {"tool": tool_name, "args": tool_args})

                    tool_result = await execute_tool(tool_name, tool_args)

                    self.emit("tool_result", {
                        "tool": tool_name,
                        "result": tool_result,
                        "success": tool_result.get("success", False),
                    })

                    tool_response_parts.append(
                        types.Part.from_function_response(
                            name=tool_name,
                            response=tool_result,
                        )
                    )

                contents.append(types.Content(role="user", parts=tool_response_parts))

            else:
                self.emit("error", {"message": f"Max iterations ({MAX_ITERATIONS}) reached"})
                result = {"success": False, "summary": "Max iterations reached", "iterations": MAX_ITERATIONS}

        except Exception as e:
            self.emit("error", {"message": str(e)})
            result = {"success": False, "summary": f"Agent error: {str(e)}", "iterations": self.iteration}
        finally:
            await close_browser()
            self.emit("task_complete", result)

        return result


async def run_cli(task: str):
    def print_event(event: AgentEvent):
        t = event.event_type
        d = event.data
        if t == "task_start":
            print(f"\n[AGENT] Starting - provider: {d.get('provider')} - model: {d['model']}", flush=True)
            print(f"[TASK]  {d['task']}\n", flush=True)
        elif t == "thinking":
            print(f"\n--- Step {d['iteration']} ---", flush=True)
        elif t == "tool_call":
            print(f"  CALL  {d['tool']}({json.dumps(d['args'])})", flush=True)
        elif t == "tool_result":
            status = "OK  " if d["success"] else "FAIL"
            print(f"  {status}  {json.dumps(d['result'])[:180]}", flush=True)
        elif t == "agent_response":
            print(f"\n[DONE]\n{d['text']}", flush=True)
        elif t == "error":
            print(f"\n[ERROR] {d['message']}", file=sys.stderr, flush=True)
        elif t == "task_complete":
            print(f"\n[COMPLETE] success={d.get('success')}  steps={d.get('iterations')}", flush=True)

    agent = Agent(on_event=print_event)
    return await agent.run(task)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print('Usage: python agent.py "<task>"')
        sys.exit(1)
    asyncio.run(run_cli(" ".join(sys.argv[1:])))
