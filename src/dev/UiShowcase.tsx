// UiShowcase (development only, route /dev/ui): reproduces frame S-47 "Feedback components" inside a mock shell
// for side-by-side visual comparison, followed by a gallery with every design-system component and state.
// It is loaded with a dynamic import behind `import.meta.env.DEV`, so it never reaches the production build.
import { Database, Plus } from 'lucide-react';
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';

import {
  ActionMenu,
  Avatar,
  Banner,
  Button,
  Checkbox,
  DOCUMENTATION_STATUSES,
  EmptyState,
  ElementTypeIcon,
  ErrorState,
  FormField,
  Modal,
  Pagination,
  PasswordField,
  SegmentedControl,
  Select,
  Skeleton,
  SLOW_LOADING_MESSAGE,
  SortableHeader,
  Spinner,
  StatusTag,
  Tag,
  Textarea,
  TextField,
  ToastCard,
  ToastProvider,
  useDelayedLoading,
  useToast,
} from '../components/ui';
import type { ModalSize } from '../components/ui';
import { MockShell } from './MockShell';

const CARD_CLASS = 'rounded-card border border-border-subtle bg-surface shadow-card';

function S47Frame() {
  return (
    <>
      <h1 className="text-title font-semibold text-ink-900">Feedback components</h1>
      <div className="flex flex-col gap-2.5">
        <Banner tone="info" lead="Info.">
          Something the user should know; no action required.
        </Banner>
        <Banner tone="success" lead="Success.">
          Used inline only when a toast would be missed.
        </Banner>
        <Banner tone="warning" lead="Warning.">
          Stale data, archived application, session ending, concurrent change.
        </Banner>
        <Banner tone="danger" lead="Error.">
          Something failed; says what to do next.
        </Banner>
      </div>
      <div className="flex flex-wrap items-start gap-4">
        <ToastCard message="Variable saved." />
        <ToastCard message="TECHEA-108 created." action={{ label: 'Open in Jira', href: '#' }} />
      </div>
      <div className="flex items-stretch gap-4">
        <div className={`${CARD_CLASS} flex-[538]`}>
          <EmptyState
            icon={<Database />}
            title="No collections yet"
            description="Record SAR's collections and their fields."
            action={
              <Button
                variant="primary"
                iconLeft={<Plus size={16} strokeWidth={1.75} aria-hidden="true" />}
              >
                New collection
              </Button>
            }
          />
        </div>
        <div className={`${CARD_CLASS} flex flex-[570] flex-col gap-2.5 p-4`}>
          <Skeleton className="h-4 w-[40%]" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-[90%]" />
          <Skeleton className="h-3 w-[95%]" />
          <Skeleton className="h-3 w-[60%]" />
          <p className="text-small text-ink-500">Skeleton</p>
        </div>
      </div>
    </>
  );
}

function GallerySection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${CARD_CLASS} flex flex-col gap-3 p-5`}>
      <h2 className="text-card-title font-extrabold text-ink-900">{title}</h2>
      {children}
    </section>
  );
}

function ModalDemos() {
  const [size, setSize] = useState<ModalSize | null>(null);
  const [blocking, setBlocking] = useState(false);
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {(['sm', 'md', 'lg'] as const).map((value) => (
          <Button
            key={value}
            onClick={() => {
              setSize(value);
            }}
          >
            Open {value} modal
          </Button>
        ))}
        <Button
          onClick={() => {
            setBlocking(true);
          }}
        >
          Open blocking modal
        </Button>
      </div>
      <Modal
        open={size !== null}
        onClose={() => {
          setSize(null);
        }}
        size={size ?? 'sm'}
        title="Delete colClientes?"
        footer={
          <>
            <Button
              onClick={() => {
                setSize(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger">Delete collection</Button>
          </>
        }
      >
        Its 8 fields, 3 variable assignments and its links to 2 screens are deleted too. The audit
        log keeps a record of everything deleted.
      </Modal>
      <Modal
        open={blocking}
        onClose={() => {
          setBlocking(false);
        }}
        dismissible={false}
        title="Your session ended"
        footer={
          <Button
            variant="primary"
            onClick={() => {
              setBlocking(false);
            }}
          >
            Sign in
          </Button>
        }
      >
        For security, sessions last up to 12 hours. Sign in again to continue where you were. Your
        unsaved changes on this page are kept in this browser.
      </Modal>
    </>
  );
}

function ToastDemos() {
  const { show } = useToast();
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        onClick={() => {
          show({ message: 'Variable saved.' });
        }}
      >
        Toast
      </Button>
      <Button
        onClick={() => {
          show({ message: 'TECHEA-108 created.', action: { label: 'Open in Jira', href: '#' } });
        }}
      >
        Toast with action
      </Button>
      <Button
        onClick={() => {
          show({
            tone: 'warning',
            message: (
              <>
                Your session ends at <strong className="font-bold">18:05</strong>. Save your work;
                you&apos;ll need to sign in again after that.
              </>
            ),
          });
        }}
      >
        Warning toast
      </Button>
    </div>
  );
}

function LoadingDemo() {
  const [loading, setLoading] = useState(false);
  const { showSkeleton, isSlow } = useDelayedLoading(loading);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          onClick={() => {
            setLoading((current) => !current);
          }}
        >
          {loading ? 'Stop loading' : 'Start loading'}
        </Button>
        <span className="text-small text-ink-500">Skeleton after 300 ms, notice after 10 s.</span>
      </div>
      {showSkeleton && (
        <div className="flex flex-col gap-2.5" role="status" aria-label="Loading">
          <Skeleton className="h-4 w-[40%]" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-[90%]" />
        </div>
      )}
      {isSlow && <p className="text-small text-ink-500">{SLOW_LOADING_MESSAGE}</p>}
    </div>
  );
}

function FormControlsDemo() {
  const focusRef = useRef<HTMLSelectElement>(null);
  const [scope, setScope] = useState<'GLOBAL' | 'CONTEXT'>('GLOBAL');
  const [checked, setChecked] = useState(true);
  return (
    <>
      <div className="grid max-w-180 grid-cols-2 gap-4">
        <FormField label="Select (normal)">
          {(control) => (
            <Select {...control} ref={focusRef} defaultValue="TEXT">
              <option value="TEXT">Text</option>
              <option value="NUMBER">Number</option>
            </Select>
          )}
        </FormField>
        <FormField
          label="Select (error)"
          error="Choose one of the available options for Data type."
        >
          {(control) => (
            <Select {...control}>
              <option>Text</option>
            </Select>
          )}
        </FormField>
        <FormField label="Select (disabled)">
          {(control) => (
            <Select {...control} disabled>
              <option>Text</option>
            </Select>
          )}
        </FormField>
        <FormField label="Textarea (error)" error="Description is too long.">
          {(control) => <Textarea {...control} defaultValue="What the variable holds" />}
        </FormField>
        <FormField label="Textarea (disabled)">
          {(control) => <Textarea {...control} disabled defaultValue="Read only" />}
        </FormField>
        <FormField label="Textarea (normal)">
          {(control) => <Textarea {...control} placeholder="What the variable holds" />}
        </FormField>
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <Checkbox
          label="DEV"
          checked={checked}
          onChange={(event) => {
            setChecked(event.target.checked);
          }}
        />
        <Checkbox label="PROD (unchecked)" defaultChecked={false} />
        <Checkbox label="Disabled" disabled defaultChecked />
        <Checkbox label="Invalid" invalid />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <SegmentedControl
          name="demo-scope"
          label="Scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'GLOBAL', label: 'Global (Set)' },
            { value: 'CONTEXT', label: 'Context (UpdateContext)' },
          ]}
        />
        <SegmentedControl
          name="demo-scope-disabled"
          label="Scope (disabled)"
          value="GLOBAL"
          onChange={() => undefined}
          disabled
          options={[
            { value: 'GLOBAL', label: 'Global (Set)' },
            { value: 'CONTEXT', label: 'Context (UpdateContext)' },
          ]}
        />
        <SegmentedControl
          name="demo-scope-error"
          label="Scope (error)"
          value="GLOBAL"
          onChange={() => undefined}
          invalid
          options={[
            { value: 'GLOBAL', label: 'Global' },
            { value: 'CONTEXT', label: 'Context' },
          ]}
        />
        <Button
          onClick={() => {
            focusRef.current?.focus();
          }}
        >
          Focus the first Select
        </Button>
      </div>
    </>
  );
}

function ListPartsDemo() {
  const [sort, setSort] = useState('name');
  const [page, setPage] = useState(2);
  const [size, setSize] = useState(20);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Tag tone="info">Set · Global</Tag>
        <Tag>UpdateContext · Context</Tag>
        <Tag tone="success">PROD</Tag>
        <Tag tone="warning">Untraced</Tag>
        <Tag mono>OnVisible</Tag>
        <ActionMenu
          label="Actions for gUsuario"
          items={[
            { key: 'view', label: 'View', onSelect: () => undefined },
            {
              key: 'edit',
              label: 'Edit',
              onSelect: () => undefined,
              disabled: true,
              reason: 'Read-only: the application is archived',
            },
            { key: 'delete', label: 'Delete', onSelect: () => undefined, danger: true },
          ]}
        />
      </div>
      <table className="w-full max-w-150 text-left">
        <thead>
          <tr>
            <SortableHeader label="Name" sortKey="name" sort={sort} onSort={setSort} />
            <SortableHeader label="Scope" sortKey="scope" sort={sort} onSort={setSort} />
            <SortableHeader label="Updated" sortKey="updatedAt" sort={sort} onSort={setSort} />
          </tr>
        </thead>
      </table>
      <Pagination
        page={page}
        pageSize={size}
        total={230}
        onPageChange={setPage}
        onPageSizeChange={(next) => {
          setSize(next);
          setPage(1);
        }}
      />
    </>
  );
}

function Gallery() {
  const [errors, setErrors] = useState(true);
  return (
    <>
      <h2 className="mt-2 text-title font-semibold text-ink-900">Component gallery</h2>
      <GallerySection title="Button">
        <div className="flex flex-wrap items-center gap-2">
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
          <Button size="sm">Small 30</Button>
          <Button size="md">Medium 36</Button>
          <Button size="lg">Large 40</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
            <Button key={variant} variant={variant} loading>
              {variant} loading
            </Button>
          ))}
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((variant) => (
            <Button key={variant} variant={variant} disabled>
              {variant} disabled
            </Button>
          ))}
        </div>
      </GallerySection>
      <GallerySection title="TextField, PasswordField, FormField">
        <div className="grid max-w-150 grid-cols-2 gap-4">
          <FormField label="Name" required help="Letters, digits and _ only.">
            {(control) => <TextField {...control} mono placeholder="gUsuario" />}
          </FormField>
          <FormField
            label="Email"
            required
            error={errors ? 'Enter a valid email, e.g. name@domain.com.' : undefined}
          >
            {(control) => <TextField {...control} type="email" defaultValue="camila.castillo@" />}
          </FormField>
          <FormField label="Password" required error={errors ? 'Enter your password.' : undefined}>
            {(control) => <PasswordField {...control} placeholder="Your password" />}
          </FormField>
          <FormField label="Disabled">
            {(control) => <TextField {...control} disabled defaultValue="Read only" />}
          </FormField>
        </div>
        <label className="flex items-center gap-2 text-small text-ink-700">
          <input
            type="checkbox"
            checked={errors}
            onChange={(event) => {
              setErrors(event.target.checked);
            }}
          />
          Show errors
        </label>
      </GallerySection>
      <GallerySection title="Select, Textarea, Checkbox, SegmentedControl">
        <FormControlsDemo />
      </GallerySection>
      <GallerySection title="Tag, ActionMenu, SortableHeader, Pagination">
        <ListPartsDemo />
      </GallerySection>
      <GallerySection title="Banner">
        <Banner tone="warning" lead="Heads up." actions={<Button size="sm">Reload</Button>}>
          With actions on the right.
        </Banner>
        <Banner tone="danger" lead="Error." onDismiss={() => undefined}>
          Dismissible banner.
        </Banner>
      </GallerySection>
      <GallerySection title="Toast and Modal">
        <ToastDemos />
        <ModalDemos />
      </GallerySection>
      <GallerySection title="Loading (S-39a)">
        <LoadingDemo />
        <Spinner size="lg" label="Loading" />
      </GallerySection>
      <GallerySection title="StatusTag, Avatar, ElementTypeIcon">
        <div className="flex flex-wrap items-center gap-2">
          {DOCUMENTATION_STATUSES.map((status) => (
            <StatusTag key={status} status={status} />
          ))}
        </div>
        <div className="flex items-center gap-3 text-ink-700">
          <Avatar name="Camila Castillo" />
          <Avatar name="Sample Developer A" />
          <ElementTypeIcon type="screen" label="Screen" />
          <ElementTypeIcon type="variable" label="Variable" />
          <ElementTypeIcon type="collection" label="Collection" />
          <ElementTypeIcon type="component" label="Component" />
        </div>
      </GallerySection>
      <GallerySection title="ErrorState (S-41a, S-41b, S-41c)">
        <div className="grid grid-cols-3 gap-4">
          <ErrorState
            className="pb-0"
            variant="not-found"
            element="variable"
            listLabel="Variables"
          />
          <ErrorState className="pb-0" variant="no-access" roleName="Reader" />
          <ErrorState className="pb-0" variant="server-error" requestId="7f3c2a" />
        </div>
      </GallerySection>
    </>
  );
}

export function UiShowcase() {
  return (
    <ToastProvider>
      <MockShell activeLabel="Dashboard" pageName="Dashboard">
        <S47Frame />
        <Gallery />
      </MockShell>
    </ToastProvider>
  );
}
