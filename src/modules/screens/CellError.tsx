// CellError: the danger text under a control of a row editor, linked to the control with aria-describedby (its `id`).
// Props: id, message (nothing is drawn without a message).
export function CellError({ id, message }: { id: string; message: string | undefined }) {
  return message ? (
    <p id={id} className="mt-1 text-small text-danger">
      {message}
    </p>
  ) : null;
}
