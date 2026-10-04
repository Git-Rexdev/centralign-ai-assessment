"use client";
import React from "react";
import logger from "@/lib/frontendLogger";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error("ErrorBoundary", error?.message || "Uncaught React rendering error", {
      raw: error?.stack || String(error),
      data: errorInfo,
      action: "Check component lifecycle and props passed to client components.",
    });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "32px 24px", maxWidth: "800px", margin: "40px auto" }}>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--error)",
              borderRadius: "var(--radius-lg)",
              padding: "24px",
            }}
          >
            <h2 style={{ fontSize: "18px", color: "var(--text)", marginBottom: "8px" }}>
              Application Interface Error
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "16px" }}>
              An unexpected error occurred while rendering this interface. The incident details
              have been captured in the browser console for debugging.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={this.handleReload}
              style={{ fontSize: "13px" }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
