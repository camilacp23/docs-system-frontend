// reportForm: the rules that make an invalid report request impossible (D-115) and the request and the summary line built
// from the form; plus the text of the new `notApplicable` rule and the name of a group in the "N fields need attention."
// summary.
import { describe, expect, it } from 'vitest';

import { ApiError } from '../../api/ApiError';
import { getFieldErrors, getRuleMessage } from '../../api/messages';
import { invalidFields } from '../../modules/collections/invalidFields';
import {
  appliesToScreens,
  buildRequest,
  EMPTY_FORM,
  hasErrors,
  summaryText,
  toggleElement,
  toggleStatus,
  validateForm,
  type ReportForm,
} from '../../modules/reports/reportForm';

const form = (patch: Partial<ReportForm>): ReportForm => ({ ...EMPTY_FORM, ...patch });

describe('validateForm', () => {
  it('asks for a title that is not blank and for something to include', () => {
    expect(validateForm(EMPTY_FORM)).toEqual({
      title: 'Title is required.',
      include: 'Choose at least one element, or include the status summary.',
    });
    expect(validateForm(form({ title: '   ', elementTypes: ['VARIABLE'] }))).toEqual({
      title: 'Title is required.',
    });
  });

  it('accepts an empty element list only with the status summary (D-115)', () => {
    expect(hasErrors(validateForm(form({ title: 'x', includeStatusSummary: true })))).toBe(false);
    expect(hasErrors(validateForm(form({ title: 'x' })))).toBe(true);
  });
});

describe('buildRequest', () => {
  it('writes both include flags and sends the element types in a fixed order', () => {
    const request = buildRequest(
      form({
        title: ' Doc ',
        elementTypes: ['COLLECTION', 'SCREEN'],
        format: 'XLSX',
        publish: true,
      }),
      4,
    );
    expect(request).toEqual({
      applicationId: 4,
      title: ' Doc ',
      scope: {
        elementTypes: ['SCREEN', 'COLLECTION'],
        includeStatusSummary: false,
        includeDependencies: false,
      },
      publish: true,
    });
  });

  it('leaves screenIds and documentationStatus out when they are empty (absent = all)', () => {
    const scope = buildRequest(form({ title: 'x', elementTypes: ['SCREEN'] }), 1).scope;
    expect(scope).not.toHaveProperty('screenIds');
    expect(scope).not.toHaveProperty('documentationStatus');
  });

  it('sends them only when Screens or Components is included, even if the form still holds them', () => {
    const held = {
      title: 'x',
      screens: [{ id: 7, name: 'Inicio' }],
      documentationStatus: ['APPROVED' as const],
    };
    expect(buildRequest(form({ ...held, elementTypes: ['VARIABLE'] }), 1).scope).not.toHaveProperty(
      'screenIds',
    );
    expect(buildRequest(form({ ...held, elementTypes: ['COMPONENT'] }), 1).scope).toMatchObject({
      screenIds: [7],
      documentationStatus: ['APPROVED'],
    });
  });

  it('sends the statuses in the order of the workflow whatever the order of the clicks', () => {
    const scope = buildRequest(
      form({
        title: 'x',
        elementTypes: ['SCREEN'],
        documentationStatus: ['APPROVED', 'DRAFT', 'IN_REVIEW'],
      }),
      1,
    ).scope;
    expect(scope.documentationStatus).toEqual(['DRAFT', 'IN_REVIEW', 'APPROVED']);
  });
});

describe('toggles that keep the form valid', () => {
  it('clears the screens and the statuses when the last of Screens and Components goes', () => {
    const start = form({
      elementTypes: ['SCREEN', 'COMPONENT', 'VARIABLE'],
      documentationStatus: ['DRAFT'],
      screens: [{ id: 1, name: 'A' }],
    });
    const oneLeft = toggleElement(start, 'SCREEN', false);
    expect(oneLeft.screens).toHaveLength(1);
    expect(oneLeft.documentationStatus).toEqual(['DRAFT']);
    const noneLeft = toggleElement(oneLeft, 'COMPONENT', false);
    expect(noneLeft.elementTypes).toEqual(['VARIABLE']);
    expect(noneLeft.screens).toEqual([]);
    expect(noneLeft.documentationStatus).toEqual([]);
    expect(appliesToScreens(noneLeft)).toBe(false);
  });

  it('keeps the element types in the order of the frame', () => {
    expect(
      toggleElement(form({ elementTypes: ['COLLECTION'] }), 'SCREEN', true).elementTypes,
    ).toEqual(['SCREEN', 'COLLECTION']);
  });

  it('adds and removes a status', () => {
    const on = toggleStatus(EMPTY_FORM, 'APPROVED', true);
    expect(on.documentationStatus).toEqual(['APPROVED']);
    expect(toggleStatus(on, 'APPROVED', false).documentationStatus).toEqual([]);
  });
});

describe('summaryText', () => {
  it('is the line of the frame', () => {
    expect(
      summaryText(form({ elementTypes: ['SCREEN', 'VARIABLE'], includeDependencies: true })),
    ).toBe('PDF · Screens, Variables · all statuses · with dependencies');
  });

  it('names the statuses, the number of screens, the summary and the publication', () => {
    expect(
      summaryText(
        form({
          format: 'XLSX',
          elementTypes: ['SCREEN'],
          includeStatusSummary: true,
          documentationStatus: ['DRAFT', 'APPROVED'],
          screens: [
            { id: 1, name: 'A' },
            { id: 2, name: 'B' },
          ],
          publish: true,
        }),
      ),
    ).toBe('Excel · Screens, Status summary · Draft, Approved · 2 screens · published when ready');
  });

  it('says nothing is chosen yet, and leaves the status part out when it does not apply', () => {
    expect(summaryText(EMPTY_FORM)).toBe('PDF · Nothing selected yet');
    expect(summaryText(form({ elementTypes: ['VARIABLE'] }))).toBe('PDF · Variables');
  });
});

describe('the text of the notApplicable rule (contract 0.3.8)', () => {
  it('is its own sentence, never the server text', () => {
    expect(getRuleMessage('notApplicable', 'Screens')).toBe(
      'Screens only applies when Screens or Components is included.',
    );
    const error = new ApiError({
      status: 400,
      code: 'VALIDATION_ERROR',
      details: {
        fields: [{ field: 'scope.screenIds', rule: 'notApplicable', message: 'server text' }],
      },
    });
    expect(getFieldErrors(error, { 'scope.screenIds': 'Screens' })).toEqual([
      {
        field: 'scope.screenIds',
        index: null,
        rule: 'notApplicable',
        message: 'Screens only applies when Screens or Components is included.',
      },
    ]);
  });
});

describe('invalidFields names a group by the element its aria-labelledby points to', () => {
  it('uses the label text without the required mark', () => {
    document.body.innerHTML = `
      <form>
        <span id="l1">Include<span aria-hidden="true">*</span></span>
        <div role="group" aria-labelledby="l1" aria-invalid="true" tabindex="-1"></div>
        <label for="t">Title <span>*</span></label><input id="t" aria-invalid="true" />
      </form>`;
    const found = invalidFields(document.querySelector('form'));
    expect(found.map((field) => field.label)).toEqual(['Include', 'Title']);
    document.body.innerHTML = '';
  });
});
