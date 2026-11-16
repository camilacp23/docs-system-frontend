// The download of a report (FR-22): GET /reports/{id}/file with the session token, a Blob, the name of Content-Disposition
// (else the report's fileName), the object URL revoked afterwards, and the two errors with their catalog texts (409
// REPORT_NOT_READY, 404). Driven with a fake clock (the revoke is delayed) and fireEvent (user-event waits on a real timer).
import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { makePending, makePublished, makeReport } from '../helpers/fakeReportsApi';
import { renderReports, useFakeReportClock } from '../helpers/renderReports';

const objectUrls = {
  create: vi.fn<(blob: Blob) => string>(),
  revoke: vi.fn<(url: string) => void>(),
};
let saved: Array<{ name: string; href: string }> = [];

beforeEach(() => {
  saved = [];
  objectUrls.create.mockReset().mockReturnValue('blob:http://localhost/file-1');
  objectUrls.revoke.mockReset();
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: objectUrls.create });
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: objectUrls.revoke });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push({ name: this.download, href: this.href });
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const card = (title: string) => {
  const item = screen.getByRole('heading', { name: title, level: 3 }).closest('li');
  if (item === null) throw new Error(`No card for ${title}`);
  return within(item);
};

describe('download', () => {
  it('reads the file with the client, saves it with the name of Content-Disposition and revokes the URL', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      reports: [makeReport(7, { title: 'Status', fileName: 'status-2026-10-05.pdf' })],
    });
    api.state.disposition = () => 'attachment; filename="from-the-header.pdf"';

    fireEvent.click(card('Status').getByRole('button', { name: 'Download Status' }));
    await clock.advance(0);

    expect(api.downloads).toEqual([7]);
    expect(objectUrls.create).toHaveBeenCalledWith(api.state.file);
    expect(saved).toEqual([{ name: 'from-the-header.pdf', href: 'blob:http://localhost/file-1' }]);
    expect(objectUrls.revoke).not.toHaveBeenCalled();
    await clock.advance(1000);
    expect(objectUrls.revoke).toHaveBeenCalledExactlyOnceWith('blob:http://localhost/file-1');
  });

  it('uses the fileName of the report when the header is missing', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      reports: [makeReport(7, { title: 'Status', fileName: 'status-2026-10-05.pdf' })],
    });
    api.state.disposition = () => null;

    fireEvent.click(card('Status').getByRole('button', { name: 'Download Status' }));
    await clock.advance(0);

    expect(saved.map((file) => file.name)).toEqual(['status-2026-10-05.pdf']);
  });

  it('ignores a header that is not the closed shape of D-120 and uses the fileName', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      reports: [makeReport(7, { title: 'Status', fileName: 'status-2026-10-05.pdf' })],
    });
    api.state.disposition = () => 'attachment; filename="../../evil.pdf"';

    fireEvent.click(card('Status').getByRole('button', { name: 'Download Status' }));
    await clock.advance(0);

    expect(saved.map((file) => file.name)).toEqual(['status-2026-10-05.pdf']);
  });

  it('tells that the report is not ready (409) and reads the list again', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      reports: [makeReport(7, { title: 'Status' })],
      prepare: (fake) => {
        fake.failNext(
          'GET /reports/{id}/file',
          new ApiError({ status: 409, code: 'REPORT_NOT_READY', details: { status: 'PENDING' } }),
        );
      },
    });
    const reads = api.callsTo('GET /reports').length;

    fireEvent.click(card('Status').getByRole('button', { name: 'Download Status' }));
    await clock.advance(0);

    expect(
      screen.getByText('Only ready reports can be published or downloaded.'),
    ).toBeInTheDocument();
    expect(objectUrls.create).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
    expect(api.callsTo('GET /reports').length).toBeGreaterThan(reads);
  });

  it('tells that the report no longer exists (404)', async () => {
    const clock = useFakeReportClock();
    await renderReports({
      reports: [makeReport(7, { title: 'Status' })],
      prepare: (fake) => {
        fake.failNext(
          'GET /reports/{id}/file',
          new ApiError({ status: 404, code: 'NOT_FOUND', details: { element: 'report', id: 7 } }),
        );
      },
    });

    fireEvent.click(card('Status').getByRole('button', { name: 'Download Status' }));
    await clock.advance(0);

    expect(
      screen.getByText("This report doesn't exist. It may have been deleted."),
    ).toBeInTheDocument();
    expect(saved).toEqual([]);
  });

  it('asks for the file once while the first request is in flight', async () => {
    const clock = useFakeReportClock();
    const gate = { release: () => {} };
    const { api } = await renderReports({
      reports: [makeReport(7, { title: 'Status' })],
      prepare: (fake) => {
        gate.release = fake.hold((call) => call.path === '/reports/{id}/file').release;
      },
    });
    const button = card('Status').getByRole('button', { name: 'Download Status' });

    fireEvent.click(button);
    fireEvent.click(button);
    await clock.advance(0);
    expect(api.callsTo('GET /reports/{id}/file')).toHaveLength(1);
    expect(button).toHaveAttribute('aria-busy', 'true');
    gate.release();
    await clock.advance(0);

    expect(saved).toHaveLength(1);
    expect(card('Status').getByRole('button', { name: 'Download Status' })).not.toHaveAttribute(
      'aria-busy',
    );
  });

  it('downloads from the toast that says a report is ready', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({ reports: [makePending(5, { title: 'Weekly' })] });
    api.settle(5, 'READY');
    await clock.advance(3000);

    fireEvent.click(screen.getByRole('button', { name: 'Download' }));
    await clock.advance(0);

    expect(api.downloads).toEqual([5]);
    expect(saved.map((file) => file.name)).toEqual(['report-5-2026-10-05.pdf']);
  });

  it('lets a Reader download a published report', async () => {
    const clock = useFakeReportClock();
    const { api } = await renderReports({
      role: 'READER',
      reports: [makePublished(7, { title: 'Shared' })],
    });

    fireEvent.click(card('Shared').getByRole('button', { name: 'Download Shared' }));
    await clock.advance(0);

    expect(api.downloads).toEqual([7]);
    expect(saved).toHaveLength(1);
  });
});
