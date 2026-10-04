"""
Tool definitions for Gemini function calling.
Maps tool names to their schemas and async implementations.
"""
import asyncio
import json
from tools.browser_tools import (
    navigate_to, get_page_content, click_element,
    fill_field, get_table_data, get_element_text, screenshot
)
from tools.file_tools import (
    list_invoices, get_invoice, get_latest_invoice,
    record_entry, verify_entry
)

# Gemini function declarations schema
TOOL_DECLARATIONS = [
    {
        "name": "navigate_to",
        "description": "Navigate the browser to a URL. Use this to open web pages.",
        "parameters": {
            "type": "object",
            "properties": {
                "url": {"type": "string", "description": "The full URL to navigate to"}
            },
            "required": ["url"]
        }
    },
    {
        "name": "get_page_content",
        "description": "Get the text content of the current page or a specific element by CSS selector.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "CSS selector (default: body for full page)"}
            },
            "required": []
        }
    },
    {
        "name": "click_element",
        "description": "Click an element on the current page using a CSS selector.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "CSS selector of the element to click"}
            },
            "required": ["selector"]
        }
    },
    {
        "name": "fill_field",
        "description": "Fill a form input field with a value.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "CSS selector of the input field"},
                "value": {"type": "string", "description": "The value to enter"}
            },
            "required": ["selector", "value"]
        }
    },
    {
        "name": "get_table_data",
        "description": "Extract all data from an HTML table on the current page.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "CSS selector for the table (default: table)"}
            },
            "required": []
        }
    },
    {
        "name": "get_element_text",
        "description": "Get the text content of a specific element by CSS selector.",
        "parameters": {
            "type": "object",
            "properties": {
                "selector": {"type": "string", "description": "CSS selector of the element"}
            },
            "required": ["selector"]
        }
    },
    {
        "name": "list_invoices",
        "description": "List all invoices in the system inbox, optionally filtered by company name.",
        "parameters": {
            "type": "object",
            "properties": {
                "company_filter": {"type": "string", "description": "Optional company name to filter by"}
            },
            "required": []
        }
    },
    {
        "name": "get_latest_invoice",
        "description": "Get the most recent invoice from a specific company.",
        "parameters": {
            "type": "object",
            "properties": {
                "company": {"type": "string", "description": "The company name to search for"}
            },
            "required": ["company"]
        }
    },
    {
        "name": "get_invoice",
        "description": "Get details of a specific invoice by its ID.",
        "parameters": {
            "type": "object",
            "properties": {
                "invoice_id": {"type": "string", "description": "The invoice ID (e.g. INV-2024-001)"}
            },
            "required": ["invoice_id"]
        }
    },
    {
        "name": "record_entry",
        "description": "Record an invoice into the internal accounting system. Call this after extracting all invoice data.",
        "parameters": {
            "type": "object",
            "properties": {
                "invoice_id": {"type": "string", "description": "The invoice ID being recorded"},
                "amount": {"type": "number", "description": "The invoice amount in dollars"},
                "due_date": {"type": "string", "description": "Due date in YYYY-MM-DD format"},
                "company": {"type": "string", "description": "The company name"},
                "notes": {"type": "string", "description": "Optional notes about the invoice"}
            },
            "required": ["invoice_id", "amount", "due_date", "company"]
        }
    },
    {
        "name": "verify_entry",
        "description": "Verify that an invoice has been successfully recorded in the internal system.",
        "parameters": {
            "type": "object",
            "properties": {
                "invoice_id": {"type": "string", "description": "The invoice ID to verify"}
            },
            "required": ["invoice_id"]
        }
    },
    {
        "name": "screenshot",
        "description": "Take a screenshot of the current browser state for verification evidence.",
        "parameters": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "description": "File path to save the screenshot"}
            },
            "required": []
        }
    }
]


async def execute_tool(name: str, args: dict) -> dict:
    """Dispatch a tool call by name and return its result."""
    # Async browser tools
    async_tools = {
        "navigate_to": lambda a: navigate_to(a.get("url", "")),
        "get_page_content": lambda a: get_page_content(a.get("selector", "body")),
        "click_element": lambda a: click_element(a.get("selector", "")),
        "fill_field": lambda a: fill_field(a.get("selector", ""), a.get("value", "")),
        "get_table_data": lambda a: get_table_data(a.get("selector", "table")),
        "get_element_text": lambda a: get_element_text(a.get("selector", "")),
        "screenshot": lambda a: screenshot(a.get("path", "screenshot.png")),
    }

    # Sync file tools (run in executor to avoid blocking)
    sync_tools = {
        "list_invoices": lambda a: list_invoices(a.get("company_filter", "")),
        "get_latest_invoice": lambda a: get_latest_invoice(a.get("company", "")),
        "get_invoice": lambda a: get_invoice(a.get("invoice_id", "")),
        "record_entry": lambda a: record_entry(
            a.get("invoice_id", ""),
            float(a.get("amount", 0)),
            a.get("due_date", ""),
            a.get("company", ""),
            a.get("notes", "")
        ),
        "verify_entry": lambda a: verify_entry(a.get("invoice_id", "")),
    }

    if name in async_tools:
        return await async_tools[name](args)
    elif name in sync_tools:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, sync_tools[name], args)
    else:
        return {"success": False, "error": f"Unknown tool: {name}"}
