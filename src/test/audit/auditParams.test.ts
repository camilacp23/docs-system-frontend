// URL of the audit log: what parseAuditListParams accepts and what it drops.
import { describe, expect, it } from 'vitest';

import { parseAuditListParams } from '../../modules/audit/useAuditListParams';

const parse = (query: string) => parseAuditListParams(new URLSearchParams(query));

describe('parseAuditListParams', () => {
  it('opens on the selected application with no other filter', () => {
    expect(parse('')).toEqual({
      application: 'selected',
      type: '',
      entityId: '',
      action: '',
      actor: '',
      from: '',
      to: '',
      page: 1,
      pageSize: 20,
    });
  });

  it('reads every filter', () => {
    expect(
      parse(
        'application=all&type=element_environment&entityId=12%3ADEV&action=UPDATE&actor=7&from=2026-10-01&to=2026-10-05&page=3&pageSize=50',
      ),
    ).toEqual({
      application: 'all',
      type: 'element_environment',
      entityId: '12:DEV',
      action: 'UPDATE',
      actor: '7',
      from: '2026-10-01',
      to: '2026-10-05',
      page: 3,
      pageSize: 50,
    });
  });

  it('drops what is not valid: unknown type or action, a bad user id, impossible days, page sizes outside 20, 50, 100', () => {
    const params = parse(
      'application=other&type=users&action=DROP&actor=-1&from=2026-02-30&to=yesterday&page=0&pageSize=30',
    );
    expect(params.application).toBe('selected');
    expect(params.type).toBe('');
    expect(params.action).toBe('');
    expect(params.actor).toBe('');
    expect(params.from).toBe('');
    expect(params.to).toBe('');
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(20);
  });

  it('cuts the element id at the 50 characters the contract allows', () => {
    expect(parse(`entityId=${'a'.repeat(80)}`).entityId).toHaveLength(50);
  });
});
