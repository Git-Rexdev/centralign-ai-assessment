"use client";
import { useState } from "react";
import styles from "./ErrorBanner.module.css";

export default function ErrorBanner({ error, onRetry, onDismiss }) {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!error) return null;

  const handleCopy = async () => {
    const textToCopy = `Error: ${error.title}\nCategory: ${error.category}\nMessage: ${error.message}\nAction: ${error.action}\nRaw Details:\n${error.raw}`;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className={styles.banner} role="alert">
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <svg
            className={styles.icon}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <h2 className={styles.title}>{error.title || "Operation Failed"}</h2>
          {error.category && (
            <span className={styles.categoryBadge}>{error.category}</span>
          )}
        </div>
        {onDismiss && (
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={onDismiss}
            aria-label="Dismiss error banner"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      <p className={styles.message}>{error.message}</p>

      {error.action && (
        <div className={styles.actionBox}>
          <span className={styles.actionLabel}>Suggested fix:</span>
          <span>{error.action}</span>
        </div>
      )}

      <div className={styles.btnRow}>
        {onRetry && (
          <button type="button" className={styles.retryBtn} onClick={onRetry}>
            Retry Task
          </button>
        )}
        <button
          type="button"
          className={`${styles.detailsToggle} ${showDetails ? styles.open : ""}`}
          onClick={() => setShowDetails((prev) => !prev)}
        >
          <span>{showDetails ? "Hide Technical Details" : "Show Technical Details"}</span>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      {showDetails && (
        <div className={styles.techDetails}>
          <div className={styles.techMeta}>
            <span>Raw diagnostic information logged to console</span>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={handleCopy}
              title="Copy error details to clipboard"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span>{copied ? "Copied" : "Copy Details"}</span>
            </button>
          </div>
          <pre className={styles.rawCode}>{error.raw || "No raw details available."}</pre>
        </div>
      )}
    </div>
  );
}
