"use client";

import React from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ backgroundColor: "color-mix(in oklch, var(--color-destructive) 12%, transparent)" }}
          >
            <AlertTriangle className="h-8 w-8" style={{ color: "var(--color-destructive)" }} />
          </div>
          <h2 className="text-xl font-semibold mb-2" style={{ color: "var(--color-foreground)" }}>
            Something went wrong
          </h2>
          <p className="text-sm mb-1 max-w-md" style={{ color: "var(--color-muted-foreground)" }}>
            {this.state.error?.message ?? "An unexpected error occurred."}
          </p>
          <p className="text-xs mb-6" style={{ color: "var(--color-muted-foreground)" }}>
            Please try refreshing the page or contact support if the issue persists.
          </p>
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
              }}
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
              style={{
                border: "1px solid var(--color-border)",
                color: "var(--color-foreground)",
              }}
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

/** Lightweight inline error state for query failures */
export function QueryError({ message }: { message?: string }) {
  return (
    <div
      className="flex items-center gap-3 p-4 rounded-xl border"
      style={{
        backgroundColor: "color-mix(in oklch, var(--color-destructive) 8%, transparent)",
        borderColor: "color-mix(in oklch, var(--color-destructive) 30%, transparent)",
      }}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" style={{ color: "var(--color-destructive)" }} />
      <p className="text-sm" style={{ color: "var(--color-destructive)" }}>
        {message ?? "Failed to load data. Please try refreshing."}
      </p>
    </div>
  );
}
