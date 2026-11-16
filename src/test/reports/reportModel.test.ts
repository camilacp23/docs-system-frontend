// reportModel: the pure rules of the report list: the ETag of D-118, the size and date texts of a card, the name of a
// downloaded file (the closed shape of D-120) and the parameters of the list in the URL.
import { describe, expect, it } from 'vitest';

import {
  completedText,
  downloadName,
  etagOf,
  fileNameFromDisposition,
  fileSizeText,
  publishedDay,
} from '../../modules/reports/reportModel';
import { parseReportListParams } from '../../modules/reports/useReportListParams';

const ZONE = 'America/Costa_Rica';

describe('etagOf', () => {
  it('is the weak tag of the epoch milliseconds of updatedAt (D-118)', () => {
    expect(etagOf({ updatedAt: '2026-10-05T15:01:00.000Z' })).toBe(
      `W/"${Date.UTC(2026, 9, 5, 15, 1, 0)}"`,
    );
  });
});

describe('fileSizeText', () => {
  it.each([
    [0, '0 B'],
    [999, '999 B'],
    [1024, '1 KB'],
    [412 * 1024, '412 KB'],
    [1536 * 1024, '1.5 MB'],
  ])('%i bytes is %s', (bytes, text) => {
    expect(fileSizeText(bytes)).toBe(text);
  });
});

describe('completedText', () => {
  it('reads "Completed Oct 5 · 09:01 · 412 KB" in the zone given', () => {
    const now = new Date('2026-10-20T00:00:00.000Z');
    expect(
      completedText({ completedAt: '2026-10-05T15:01:00.000Z', fileSize: 412 * 1024 }, ZONE, now),
    ).toBe('Completed Oct 5 · 09:01 · 412 KB');
  });

  it('adds the year when it is not this one', () => {
    const now = new Date('2027-01-20T00:00:00.000Z');
    expect(
      completedText({ completedAt: '2026-10-05T15:01:00.000Z', fileSize: 2048 }, ZONE, now),
    ).toBe('Completed Oct 5, 2026 · 09:01 · 2 KB');
  });

  it('is empty for a report that is not finished', () => {
    expect(completedText({ completedAt: null, fileSize: null }, ZONE)).toBe('');
  });
});

describe('publishedDay', () => {
  it('is the day in the zone, or null when not published', () => {
    expect(publishedDay({ publishedAt: '2026-10-06T02:00:00.000Z' }, ZONE)).toBe('2026-10-05');
    expect(publishedDay({ publishedAt: null }, ZONE)).toBeNull();
  });
});

describe('the name of a downloaded file', () => {
  it('takes it from Content-Disposition when it has the shape of D-120', () => {
    expect(fileNameFromDisposition('attachment; filename="status-2026-10-05.pdf"')).toBe(
      'status-2026-10-05.pdf',
    );
  });

  it.each([
    null,
    'attachment',
    'attachment; filename="../x.pdf"',
    'attachment; filename="A B.pdf"',
    "attachment; filename*=UTF-8''x.pdf",
  ])('rejects %s', (header) => {
    expect(fileNameFromDisposition(header)).toBeNull();
  });

  it('falls back to the fileName of the report, then to a neutral name', () => {
    expect(downloadName(null, 'status.pdf', 'PDF')).toBe('status.pdf');
    expect(downloadName(null, null, 'PDF')).toBe('report.pdf');
    expect(downloadName(null, null, 'XLSX')).toBe('report.xlsx');
    expect(downloadName(null, '../evil', 'XLSX')).toBe('report.xlsx');
  });
});

describe('parseReportListParams', () => {
  it('reads the filter, the page and the page size, and drops what is not valid', () => {
    expect(
      parseReportListParams(new URLSearchParams('published=true&page=3&pageSize=24'), true),
    ).toEqual({
      publishedOnly: true,
      page: 3,
      pageSize: 24,
    });
    expect(
      parseReportListParams(new URLSearchParams('published=yes&page=0&pageSize=7'), true),
    ).toEqual({
      publishedOnly: false,
      page: 1,
      pageSize: 12,
    });
  });

  it('ignores the filter for a role that cannot filter (the Reader)', () => {
    expect(parseReportListParams(new URLSearchParams('published=true'), false).publishedOnly).toBe(
      false,
    );
  });
});
