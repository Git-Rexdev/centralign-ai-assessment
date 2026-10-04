/**
 * Frontend logging utility for the AI Task Worker webapp.
 * 
 * Provides structured logging with developer-friendly DevTools console output,
 * error context aggregation, and an in-memory buffer of recent logs for diagnostics.
 */

const MAX_LOG_HISTORY = 100;

class FrontendLogger {
  constructor() {
    this.logs = [];
  }

  _record(level, context, summary, details = {}) {
    const entry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      context,
      summary,
      details,
    };

    this.logs.unshift(entry);
    if (this.logs.length > MAX_LOG_HISTORY) {
      this.logs.pop();
    }

    return entry;
  }

  /**
   * Log an error with detailed developer context without exposing raw errors directly to the user UI.
   *
   * @param {string} context - The component or module where the error originated (e.g., 'Dashboard', 'AgentAPI')
   * @param {string} summary - Human-readable error description
   * @param {Object} [details] - Detailed metadata (status, raw error, payload, stack trace, etc.)
   */
  error(context, summary, details = {}) {
    const entry = this._record("error", context, summary, details);

    if (typeof console !== "undefined") {
      const header = `%c[Frontend Error] [${context}] ${summary}`;
      const style = "background: #7f1d1d; color: #fecaca; font-weight: bold; padding: 2px 6px; border-radius: 3px;";

      // Group in DevTools so developers can inspect raw stack & payloads without cluttering the console
      if (console.groupCollapsed) {
        console.groupCollapsed(header, style);
        console.error("Context:", context);
        console.error("Summary:", summary);
        if (details.category) console.info("Category:", details.category);
        if (details.statusCode) console.info("HTTP Status:", details.statusCode);
        if (details.url) console.info("Request URL:", details.url);
        if (details.action) console.info("Recommended Action:", details.action);
        if (details.raw) {
          console.error("Raw Backend Error / Stack:", details.raw);
        }
        if (details.data) {
          console.dir("Extra Payload:", details.data);
        }
        console.groupEnd();
      } else {
        console.error(`[Frontend Error] [${context}] ${summary}`, details);
      }
    }

    return entry;
  }

  /**
   * Log a warning.
   */
  warn(context, summary, details = {}) {
    const entry = this._record("warn", context, summary, details);
    if (typeof console !== "undefined") {
      console.warn(`[Frontend Warn] [${context}] ${summary}`, details);
    }
    return entry;
  }

  /**
   * Log informational progress.
   */
  info(context, summary, details = {}) {
    const entry = this._record("info", context, summary, details);
    if (typeof console !== "undefined") {
      console.info(`[Frontend Info] [${context}] ${summary}`, details);
    }
    return entry;
  }

  /**
   * Log debug details.
   */
  debug(context, summary, details = {}) {
    const entry = this._record("debug", context, summary, details);
    if (typeof console !== "undefined" && process.env.NODE_ENV !== "production") {
      console.debug(`[Frontend Debug] [${context}] ${summary}`, details);
    }
    return entry;
  }

  /**
   * Retrieve error log entries from memory.
   */
  getErrors() {
    return this.logs.filter((log) => log.level === "error");
  }

  /**
   * Retrieve all recorded log entries.
   */
  getAllLogs() {
    return [...this.logs];
  }

  /**
   * Clear the in-memory log buffer.
   */
  clear() {
    this.logs = [];
  }
}

export const logger = new FrontendLogger();
export default logger;
