import { Component, type ErrorInfo, type ReactNode } from "react";
import { debugLog } from "@/lib/debug-logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    debugLog.error(`Uncaught error: ${error.message}`);
    debugLog.error(`Component stack: ${errorInfo.componentStack}`);
    console.error("Uncaught error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 bg-surface text-text h-screen flex flex-col items-center justify-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Something went wrong</h1>
          <div className="bg-surface-elevated p-4 rounded-lg border border-border max-w-2xl w-full overflow-auto mb-6">
            <p className="font-mono text-red-400 mb-2">{this.state.error?.toString()}</p>
            <pre className="text-xs text-text-muted whitespace-pre-wrap">
              {this.state.errorInfo?.componentStack}
            </pre>
          </div>
          <div className="flex gap-4">
            <button
              className="px-4 py-2 bg-accent text-white rounded hover:bg-accent/90"
              onClick={() => window.location.reload()}
            >
              Reload Application
            </button>
            <button
              className="px-4 py-2 bg-surface-elevated border border-border text-text rounded hover:bg-surface-elevated/80"
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
            >
              Clear Settings & Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
