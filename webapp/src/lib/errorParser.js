/**
 * Error normalization and parsing utility.
 *
 * Converts raw backend errors, Python exception strings, HTTP errors,
 * and network faults into clean, user-facing error objects with actionable
 * guidance, while preserving the raw details for technical inspection.
 */

export function parseBackendError(error, defaultContext = "Operation") {
  // Extract raw text and status
  let rawText = "";
  let statusCode = null;
  let category = "UNKNOWN_ERROR";
  let title = "Task Execution Issue";
  let message = "An unexpected error occurred while executing the task.";
  let action = "Please try again or check the system logs for more details.";

  if (!error) {
    return {
      title,
      message,
      action,
      category,
      raw: "No error details provided.",
      timestamp: Date.now(),
    };
  }

  // Handle Response / HTTP status if passed
  if (typeof error === "object") {
    if (error.status) statusCode = error.status;
    if (error.message) rawText = String(error.message);
    else if (error.detail) rawText = typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail);
    else if (error.error) rawText = typeof error.error === "string" ? error.error : JSON.stringify(error.error);
    else rawText = JSON.stringify(error);
  } else {
    rawText = String(error);
  }

  const lowerRaw = rawText.toLowerCase();

  // 1. Connection / Network errors (FastAPI backend offline or unreachable)
  if (
    lowerRaw.includes("failed to fetch") ||
    lowerRaw.includes("networkerror") ||
    lowerRaw.includes("econnrefused") ||
    lowerRaw.includes("connection refused") ||
    lowerRaw.includes("err_connection_refused") ||
    lowerRaw.includes("fetch failed") ||
    statusCode === 503 ||
    statusCode === 502
  ) {
    category = "CONNECTION_ERROR";
    title = "Agent Backend Unavailable";
    message = "Could not establish a connection to the Python agent server at http://localhost:8000.";
    action = "Ensure the agent server is running. In your terminal, navigate to the agent folder and run: python server.py";
  }

  // 2. Authentication & API Key errors (Cerebras, Groq, Gemini)
  else if (
    lowerRaw.includes("authenticationerror") ||
    lowerRaw.includes("invalid_api_key") ||
    lowerRaw.includes("invalid api key") ||
    lowerRaw.includes("api key not found") ||
    lowerRaw.includes("no api key configured") ||
    lowerRaw.includes("unauthorized") ||
    statusCode === 401 ||
    statusCode === 403
  ) {
    category = "AUTH_ERROR";
    title = "API Authentication Failed";
    message = "The configured AI model provider rejected the API credentials.";
    action = "Verify that a valid API key (CEREBRAS_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY) is set in your agent/.env file.";
  }

  // 3. Rate limiting / Quota errors
  else if (
    lowerRaw.includes("ratelimit") ||
    lowerRaw.includes("rate_limit") ||
    lowerRaw.includes("resourceexhausted") ||
    lowerRaw.includes("quota exceeded") ||
    lowerRaw.includes("429") ||
    statusCode === 429
  ) {
    category = "RATE_LIMIT_ERROR";
    title = "API Rate Limit Exceeded";
    message = "The AI model provider has temporarily throttled requests due to rate limits.";
    action = "Wait a few seconds before trying again, or configure a fallback provider in agent/.env.";
  }

  // 4. Timeout errors
  else if (
    lowerRaw.includes("timeout waiting for agent") ||
    lowerRaw.includes("timeouterror") ||
    lowerRaw.includes("timed out") ||
    lowerRaw.includes("aborterror") ||
    statusCode === 504
  ) {
    category = "TIMEOUT_ERROR";
    title = "Execution Timed Out";
    message = "The agent operation took longer than the 60-second limit to complete.";
    action = "The model provider may be slow or the task may require multiple steps. Try breaking the task into smaller requests.";
  }

  // 5. Max iterations / Step limit reached
  else if (
    lowerRaw.includes("max iterations") ||
    lowerRaw.includes("max_iterations") ||
    lowerRaw.includes("maximum iterations reached")
  ) {
    category = "STEP_LIMIT_ERROR";
    title = "Execution Step Limit Reached";
    message = "The agent reached its maximum step limit before finishing the task.";
    action = "Try making your prompt more specific or increase MAX_ITERATIONS in agent/.env.";
  }

  // 6. Browser / Playwright automation errors
  else if (
    lowerRaw.includes("playwright") ||
    lowerRaw.includes("browser") ||
    lowerRaw.includes("target page, context or browser has been closed") ||
    lowerRaw.includes("locator.")
  ) {
    category = "BROWSER_AUTOMATION_ERROR";
    title = "Browser Automation Issue";
    message = "The agent encountered an issue while interacting with the simulated web app interface.";
    action = "Ensure the Next.js web application is accessible at http://localhost:3000.";
  }

  // 7. Client validation / Bad request (400)
  else if (statusCode === 400 || lowerRaw.includes("task cannot be empty")) {
    category = "VALIDATION_ERROR";
    title = "Invalid Request";
    message = "The task description was empty or invalid.";
    action = "Enter a task description before running the agent.";
  }

  // 8. Server 500 error
  else if (statusCode === 500 || lowerRaw.includes("server error: 500") || lowerRaw.includes("internal server error")) {
    category = "SERVER_ERROR";
    title = "Agent Server Error";
    message = "The Python backend encountered an unexpected internal error during execution.";
    action = "Check the Python terminal output (server.py) for the full traceback.";
  }

  // 9. Tool execution failures
  else if (lowerRaw.includes("unknown tool") || lowerRaw.includes("tool failed")) {
    category = "TOOL_ERROR";
    title = "Tool Execution Failed";
    message = "One of the agent tools failed to execute properly.";
    action = "Verify the target invoice and simulated system data files exist in the data/ directory.";
  }

  // 10. Fallback / Generic
  else {
    category = "EXECUTION_ERROR";
    title = `${defaultContext} Error`;
    // Clean up ugly stack trace prefixes if present
    const firstLine = rawText.split("\n")[0].trim();
    if (firstLine && firstLine.length < 120 && !firstLine.includes("{")) {
      message = firstLine;
    } else {
      message = "An error occurred while communicating with the agent backend.";
    }
    action = "Inspect the technical details below or check the browser console for more context.";
  }

  return {
    title,
    message,
    action,
    category,
    statusCode,
    raw: rawText,
    timestamp: Date.now(),
  };
}
