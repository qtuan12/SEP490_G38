import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MaterialRequestDecisionForm } from './MaterialRequestDecisionForm';

describe('MaterialRequestDecisionForm', () => {
  it('hiển thị bốn phương án dưới dạng lựa chọn trực quan, không dùng dropdown', () => {
    const queryClient = new QueryClient();
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={queryClient}>
        <MaterialRequestDecisionForm
          requestId="mat-req-1"
          onSubmitDecision={async () => true}
          onCompleted={() => undefined}
        />
      </QueryClientProvider>,
    );

    expect(markup.match(/type="radio"/g)).toHaveLength(4);
    expect(markup).not.toContain('<select');
    expect(markup).toContain('Phê duyệt');
    expect(markup).toContain('Đề nghị điều chuyển nội bộ');
    expect(markup).toContain('Chờ cung ứng');
    expect(markup).toContain('Từ chối');
    expect(markup).toContain('value="NotApproved"');
    expect(markup).not.toContain('Yêu cầu bổ sung thông tin');
  });
});
