// reactFlowShims: the pieces of the browser that jsdom lacks and React Flow needs. Importing this file installs them
// (`import '../helpers/reactFlowShims'`); only the test files of the dependency map import it, so no other test changes.
// It never draws or measures anything for real, and the tests do not look at the canvas pixel by pixel: they check what
// the page decides (nodes, panel, URL, requests), not where React Flow puts a line.
//   ResizeObserver     does nothing but tell, once, that each observed element has a size, so React Flow measures its
//                      nodes (inside `act`, so React does not warn about an update outside of it).
//   DOMMatrixReadOnly  reads the scale of a CSS transform (`m22`), which React Flow uses to know the zoom.
//   offsetWidth/Height 1200 x 700 for the React Flow container; an element with an inline width and height (the nodes
//                      draw theirs) reports those, as a browser would.
//   SVGElement.getBBox zero box, used to size the labels of the edges.
// Each shim is installed only if the browser object is missing, so a future jsdom that has it keeps its own.
import { act } from '@testing-library/react';

const CONTAINER_WIDTH = 1200;
const CONTAINER_HEIGHT = 700;

class ResizeObserverShim {
  private readonly callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element): void {
    queueMicrotask(() => {
      void act(() => {
        const entry = { target, contentRect: target.getBoundingClientRect() };
        this.callback([entry as ResizeObserverEntry], this);
      });
    });
  }

  unobserve(): void {
    // Nothing is watched for real.
  }

  disconnect(): void {
    // Nothing is watched for real.
  }
}

class DOMMatrixReadOnlyShim {
  readonly m22: number;

  constructor(transform?: string) {
    const matrix = /matrix\(([^)]+)\)/.exec(transform ?? '');
    const values = matrix?.[1]?.split(',').map((part) => Number(part.trim())) ?? [];
    this.m22 = values[3] ?? 1;
  }
}

function inlineSize(element: HTMLElement, property: 'width' | 'height'): number | null {
  // Only a size in pixels counts: the container of React Flow has width: 100%, which a browser resolves from its parent.
  const text = element.style[property];
  return /^\d+(\.\d+)?px$/.test(text) ? Number.parseFloat(text) : null;
}

const target = globalThis as unknown as Record<string, unknown>;
if (typeof target.ResizeObserver === 'undefined') target.ResizeObserver = ResizeObserverShim;
if (typeof target.DOMMatrixReadOnly === 'undefined')
  target.DOMMatrixReadOnly = DOMMatrixReadOnlyShim;

Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
  configurable: true,
  get(this: HTMLElement) {
    return inlineSize(this, 'width') ?? CONTAINER_WIDTH;
  },
});
Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
  configurable: true,
  get(this: HTMLElement) {
    return inlineSize(this, 'height') ?? CONTAINER_HEIGHT;
  },
});

const svg = SVGElement.prototype as unknown as { getBBox?: () => DOMRect };
svg.getBBox ??= () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
