// Highlighted draws the matches as <mark> elements of React: never HTML, never Markdown.
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Highlighted } from '../../modules/search/Highlighted';

function marks(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('mark')).map((mark) => mark.textContent ?? '');
}

describe('Highlighted', () => {
  it('marks every appearance, with the capitalization and the accents of the text', () => {
    const { container } = render(
      <p>
        <Highlighted text="Configuración y CONFIGURACION" query="configuracion" />
      </p>,
    );
    expect(marks(container)).toEqual(['Configuración', 'CONFIGURACION']);
    expect(container.textContent).toBe('Configuración y CONFIGURACION');
  });

  it('draws the text as it is without a query', () => {
    const { container } = render(
      <p>
        <Highlighted text="Nothing marked" query={null} />
        <Highlighted text=" here" query="  " />
      </p>,
    );
    expect(container.querySelectorAll('mark')).toHaveLength(0);
    expect(container.textContent).toBe('Nothing marked here');
  });

  it('shows markup in the text as text and never builds elements from it', () => {
    const text = '<img src=x onerror=alert(1)> **bold** <b>ñ</b> [link](http://x)';
    const { container } = render(
      <p>
        <Highlighted text={text} query="bold" />
      </p>,
    );
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('b')).toBeNull();
    expect(container.querySelector('a')).toBeNull();
    expect(container.querySelector('strong')).toBeNull();
    expect(container.textContent).toBe(text);
    expect(marks(container)).toEqual(['bold']);
  });

  it('marks text that has characters of a pattern', () => {
    const { container } = render(
      <p>
        <Highlighted text="Filter(colClients, Active = true) 100%" query="(colclients" />
        <Highlighted text=" a_b" query="a_b" />
      </p>,
    );
    expect(marks(container)).toEqual(['(colClients', 'a_b']);
  });
});
