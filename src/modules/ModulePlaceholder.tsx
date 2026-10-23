// ModulePlaceholder: stand-in page of a module that does not exist yet (title + a fixed notice, no data).
// Props: title (the module title, same as in the sidebar).
interface ModulePlaceholderProps {
  title: string;
}

export function ModulePlaceholder({ title }: ModulePlaceholderProps) {
  return (
    <>
      <h1 className="text-page-title font-extrabold text-ink-900">{title}</h1>
      <p className="text-body-lg text-ink-500">This module is not available yet.</p>
    </>
  );
}
