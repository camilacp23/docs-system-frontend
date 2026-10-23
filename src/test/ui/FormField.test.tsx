// FormField: label association, required marker, aria-invalid / aria-describedby wiring for help and error text.
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormField, PasswordField, TextField } from '../../components/ui';

describe('FormField', () => {
  it('associates the label with the control', () => {
    render(<FormField label="Email">{(control) => <TextField {...control} />}</FormField>);

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('uses the given htmlFor as the control id', () => {
    render(
      <FormField label="Email" htmlFor="email-field">
        {(control) => <TextField {...control} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Email')).toHaveAttribute('id', 'email-field');
  });

  it('is valid and undescribed when there is no help or error', () => {
    render(<FormField label="Email">{(control) => <TextField {...control} />}</FormField>);

    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).not.toHaveAttribute('aria-required');
  });

  it('sets aria-invalid and describes the control by the error message', () => {
    render(
      <FormField label="Email" error="Enter a valid email, e.g. name@domain.com.">
        {(control) => <TextField {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Enter a valid email, e.g. name@domain.com.');
  });

  it('describes the control by the help text when there is no error', () => {
    render(
      <FormField label="Name" help="Letters, digits and _ only.">
        {(control) => <TextField {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAccessibleDescription('Letters, digits and _ only.');
  });

  it('references both help and error when both are present', () => {
    render(
      <FormField label="Name" help="Letters only." error="Enter a name.">
        {(control) => <TextField {...control} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Name')).toHaveAccessibleDescription(
      'Letters only. Enter a name.',
    );
  });

  it('marks required fields with aria-required and a decorative asterisk', () => {
    render(
      <FormField label="Password" required>
        {(control) => <PasswordField {...control} />}
      </FormField>,
    );

    const input = screen.getByLabelText(/^Password/);
    expect(input).toHaveAccessibleName('Password');
    expect(input).toHaveAttribute('aria-required', 'true');
    const asterisk = screen.getByText('*');
    expect(asterisk).toHaveAttribute('aria-hidden', 'true');
    expect(asterisk).toHaveClass('text-danger');
  });

  it('does not treat an empty error string as an error', () => {
    render(
      <FormField label="Email" error="">
        {(control) => <TextField {...control} />}
      </FormField>,
    );

    expect(screen.getByLabelText('Email')).not.toHaveAttribute('aria-invalid');
  });
});
