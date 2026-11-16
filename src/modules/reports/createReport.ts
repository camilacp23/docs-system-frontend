// createReport: requests a new report (POST /reports/pdf or /reports/excel, 202 with the report PENDING, FR-22).
// createReport(client, request, format, signal?) -> { report, etag }.
// Every call creates a NEW report (D-55); the generation runs in the background and the page follows it by polling.
// Shared by the generate dialog and by "Generate again".
import type { ApiClient } from '../../api/client';

import type { Report, ReportFormat, ReportRequest } from './reportModel';

export async function createReport(
  client: ApiClient,
  request: ReportRequest,
  format: ReportFormat,
  signal?: AbortSignal,
): Promise<{ report: Report; etag: string | null }> {
  const path = format === 'PDF' ? '/reports/pdf' : '/reports/excel';
  const answer = await client.post(path, { body: request, signal });
  return { report: answer.body.data, etag: answer.etag };
}
