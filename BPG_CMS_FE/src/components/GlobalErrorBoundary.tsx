import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('🔥 GlobalErrorBoundary caught an unhandled error:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const isChunkError = this.state.error?.name === 'ChunkLoadError' || 
        this.state.error?.message?.includes('Failed to fetch dynamically imported module');

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(var(--bg-main))] p-6 text-center">
          <div className="max-w-md w-full rounded-2xl bg-white p-8 shadow-xl border border-slate-200">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
              <AlertTriangle size={36} />
            </div>

            <h2 className="mb-2 text-2xl font-bold text-slate-800">
              {isChunkError ? 'Lỗi kết nối mạng' : 'Đã có sự cố xảy ra'}
            </h2>

            <p className="mb-6 text-sm text-slate-500 leading-relaxed">
              {isChunkError
                ? 'Không thể tải thành phần ứng dụng do kết nối mạng gián đoạn. Vui lòng kiểm tra lại mạng và tải lại trang.'
                : 'Hệ thống vừa gặp một sự cố render không mong muốn. Bạn có thể thử lại hoặc tải lại trang.'}
            </p>

            <div className="flex flex-wrap gap-2.5 justify-center">
              <button
                type="button"
                onClick={this.handleReset}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                <RotateCcw size={15} />
                <span>Thử lại</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
              >
                <RefreshCw size={15} />
                <span>Tải lại trang</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-200 transition-colors border border-slate-200"
              >
                <Home size={15} />
                <span>Trang chủ</span>
              </button>
            </div>

            {import.meta.env.DEV && this.state.error && (
              <details className="mt-6 text-left text-xs text-slate-500">
                <summary className="cursor-pointer font-medium text-slate-700 hover:text-slate-900">
                  Chi tiết kỹ thuật (Chế độ DEV)
                </summary>
                <div className="mt-2 max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-slate-200 text-[11px] whitespace-pre-wrap">
                  <p className="font-bold text-red-400 mb-1">{this.state.error.name}: {this.state.error.message}</p>
                  {this.state.error.stack}
                </div>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
