import { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            minHeight: "100dvh",
            background: "hsl(var(--surface2))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          <div
            style={{
              background: "hsl(var(--card))",
              borderRadius: "20px",
              padding: "32px 24px",
              maxWidth: "360px",
              width: "100%",
              textAlign: "center",
              border: "1px solid hsl(var(--border2))",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "16px",
                background: "hsl(var(--destructive, 0 84.2% 60.2%) / 0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <AlertTriangle
                style={{
                  width: "28px",
                  height: "28px",
                  color: "hsl(var(--destructive, 0 84.2% 60.2%))",
                }}
              />
            </div>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: 700,
                color: "hsl(var(--foreground))",
                margin: "0 0 8px",
              }}
            >
              حدث خطأ
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: "hsl(var(--muted2))",
                margin: "0 0 20px",
                lineHeight: 1.5,
              }}
            >
              Something went wrong. Please try again.
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                borderRadius: "12px",
                background: "hsl(var(--accent2))",
                color: "hsl(var(--accent2-foreground))",
                border: "none",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <RefreshCw style={{ width: "16px", height: "16px" }} />
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
