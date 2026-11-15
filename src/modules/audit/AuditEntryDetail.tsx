// AuditEntryDetail: what a record says when it is opened (S-32): the fields it changed and the id of the element.
// Props: entry (AuditEntry).
//   UPDATE   a table Field / Before / After with the fields of `changedFields`: the old value struck through on red,
//            the new one on green (S-32).
//   CREATE   a table Field / Value with the new values; DELETE with the old values; EVENT with its payload.
//   Always   the id of the element (it can be composite, "12:DEV") and, only when the API sent it (Administrator),
//            the database role of the write.
// A password change shows the field "Password" as changed, with no value: the API never stores it and the client
// never draws a `passwordHash` it might receive (REDACTED_FIELDS). Values are text (AuditValue).
import { AuditValue } from './AuditValue';
import { fieldLabel, isRedacted, type AuditEntry } from './auditLabels';

export const PASSWORD_CHANGED_TEXT = "Changed. The value isn't stored.";
export const NO_DETAILS_TEXT = 'No details recorded.';

const HEAD_CLASS = 'px-3 py-2 text-left text-micro font-bold tracking-wider text-ink-500 uppercase';
const FIELD_CLASS = 'px-3 py-2.5 text-left align-top font-mono text-label font-normal text-ink-900';

type Image = Record<string, unknown> | null | undefined;

function readKey(image: Image, key: string): unknown {
  return image === null || image === undefined ? null : image[key];
}

function keysOf(image: Image): string[] {
  return image === null || image === undefined ? [] : Object.keys(image);
}

function UpdateTable({ entry }: { entry: AuditEntry }) {
  const keys = [...new Set(entry.changedFields)];
  return (
    <table aria-label="Changes" className="w-full">
      <thead className="bg-search-bg">
        <tr>
          <th scope="col" className={HEAD_CLASS}>
            Field
          </th>
          <th scope="col" className={HEAD_CLASS}>
            Before
          </th>
          <th scope="col" className={HEAD_CLASS}>
            After
          </th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key} className="border-t border-divider">
            <th scope="row" className={FIELD_CLASS}>
              {fieldLabel(key)}
            </th>
            {isRedacted(key) ? (
              <td colSpan={2} className="px-3 py-2.5 text-body text-ink-700">
                {PASSWORD_CHANGED_TEXT}
              </td>
            ) : (
              <>
                <td className="bg-danger-bg/60 px-3 py-2.5 align-top text-body">
                  <AuditValue value={readKey(entry.oldValue, key)} tone="before" />
                </td>
                <td className="bg-success-bg/60 px-3 py-2.5 align-top text-body">
                  <AuditValue value={readKey(entry.newValue, key)} tone="after" />
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ValuesTable({ image }: { image: Image }) {
  const keys = keysOf(image).filter((key) => !isRedacted(key));
  return (
    <table aria-label="Values" className="w-full">
      <thead className="bg-search-bg">
        <tr>
          <th scope="col" className={HEAD_CLASS}>
            Field
          </th>
          <th scope="col" className={HEAD_CLASS}>
            Value
          </th>
        </tr>
      </thead>
      <tbody>
        {keys.map((key) => (
          <tr key={key} className="border-t border-divider">
            <th scope="row" className={FIELD_CLASS}>
              {fieldLabel(key)}
            </th>
            <td className="px-3 py-2.5 align-top text-body text-ink-900">
              <AuditValue value={readKey(image, key)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function AuditEntryDetail({ entry }: { entry: AuditEntry }) {
  const image: Image =
    entry.action === 'DELETE' ? entry.oldValue : entry.action === 'UPDATE' ? null : entry.newValue;
  const hasRows =
    entry.action === 'UPDATE'
      ? entry.changedFields.length > 0
      : keysOf(image).some((key) => !isRedacted(key));

  return (
    <div className="mt-2.5 mb-1 flex flex-col gap-3">
      {hasRows ? (
        <div className="overflow-x-auto rounded-control border border-border-subtle">
          {entry.action === 'UPDATE' ? (
            <UpdateTable entry={entry} />
          ) : (
            <ValuesTable image={image} />
          )}
        </div>
      ) : (
        <p className="text-body text-ink-500">{NO_DETAILS_TEXT}</p>
      )}
      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-small">
        <div className="flex gap-1.5">
          <dt className="text-ink-500">Element id</dt>
          <dd className="font-mono text-ink-900">{entry.entityId}</dd>
        </div>
        {entry.dbRole !== undefined && (
          <div className="flex gap-1.5">
            <dt className="text-ink-500">Database role</dt>
            <dd className="font-mono text-ink-900">{entry.dbRole}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
