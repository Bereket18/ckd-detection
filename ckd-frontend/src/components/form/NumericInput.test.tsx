/**
 * NumericInput Component Tests
 * 
 * Tests the NumericInput component for:
 * - Rendering with various prop combinations
 * - Value changes and onChange callback
 * - Validation error display
 * - Clear button functionality
 * - Tooltip display on hover
 * - Accessibility attributes
 * - Keyboard navigation
 * - Edge cases (min, max, null values)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NumericInput } from './NumericInput';

describe('NumericInput', () => {
  const defaultProps = {
    name: 'age',
    label: 'Age',
    min: 0,
    max: 120,
    value: null,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render with required props', () => {
      render(<NumericInput {...defaultProps} />);
      
      expect(screen.getByLabelText(/age/i)).toBeInTheDocument();
      expect(screen.getByRole('spinbutton')).toBeInTheDocument();
    });

    it('should display label correctly', () => {
      render(<NumericInput {...defaultProps} />);
      
      expect(screen.getByText('Age')).toBeInTheDocument();
    });

    it('should display unit when provided', () => {
      render(<NumericInput {...defaultProps} unit="years" />);
      
      expect(screen.getByText('(years)')).toBeInTheDocument();
    });

    it('should display unit in different formats', () => {
      const { rerender } = render(<NumericInput {...defaultProps} unit="mmHg" />);
      expect(screen.getByText('(mmHg)')).toBeInTheDocument();

      rerender(<NumericInput {...defaultProps} unit="mg/dL" />);
      expect(screen.getByText('(mg/dL)')).toBeInTheDocument();
    });

    it('should render without unit when not provided', () => {
      render(<NumericInput {...defaultProps} />);
      
      const label = screen.getByText('Age');
      expect(label.textContent).toBe('Age');
    });

    it('should show placeholder with min-max range', () => {
      render(<NumericInput {...defaultProps} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('placeholder', '0-120');
    });

    it('should display current value', () => {
      render(<NumericInput {...defaultProps} value={45} />);
      
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('45');
    });

    it('should display empty string when value is null', () => {
      render(<NumericInput {...defaultProps} value={null} />);
      
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('');
    });
  });

  describe('Value Changes', () => {
    it('should call onChange when value changes', async () => {
      const handleChange = vi.fn();
      render(<NumericInput {...defaultProps} onChange={handleChange} />);
      
      const input = screen.getByRole('spinbutton');
      await userEvent.type(input, '25');
      
      expect(handleChange).toHaveBeenCalled();
    });

    it('should parse numeric input correctly', async () => {
      const handleChange = vi.fn();
      render(<NumericInput {...defaultProps} onChange={handleChange} />);
      
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '45' } });
      
      expect(handleChange).toHaveBeenCalledWith(45);
    });

    it('should handle decimal values', async () => {
      const handleChange = vi.fn();
      render(
        <NumericInput
          name="sg"
          label="SG"
          min={1.0}
          max={1.03}
          value={null}
          onChange={handleChange}
        />
      );
      
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1.015' } });
      
      expect(handleChange).toHaveBeenCalledWith(1.015);
    });

    it('should handle negative values when min is negative', async () => {
      const handleChange = vi.fn();
      render(
        <NumericInput
          name="test"
          label="Test"
          min={-10}
          max={10}
          value={null}
          onChange={handleChange}
        />
      );
      
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '-5' } });
      
      expect(handleChange).toHaveBeenCalledWith(-5);
    });

    it('should call onChange with null when input is cleared', async () => {
      const handleChange = vi.fn();
      render(<NumericInput {...defaultProps} value={45} onChange={handleChange} />);
      
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '' } });
      
      expect(handleChange).toHaveBeenCalledWith(null);
    });

    it('should not call onChange for invalid input', async () => {
      const handleChange = vi.fn();
      render(<NumericInput {...defaultProps} onChange={handleChange} />);
      
      const input = screen.getByRole('spinbutton');
      handleChange.mockClear();
      
      fireEvent.change(input, { target: { value: 'abc' } });
      
      // Should not be called with a valid number
      expect(handleChange).not.toHaveBeenCalled();
    });
  });

  describe('Clear Button', () => {
    it('should show clear button when value is present', () => {
      render(<NumericInput {...defaultProps} value={45} />);
      
      const clearButton = screen.getByLabelText(/clear age/i);
      expect(clearButton).toBeInTheDocument();
    });

    it('should not show clear button when value is null', () => {
      render(<NumericInput {...defaultProps} value={null} />);
      
      const clearButton = screen.queryByLabelText(/clear age/i);
      expect(clearButton).not.toBeInTheDocument();
    });

    it('should call onChange with null when clear button is clicked', async () => {
      const handleChange = vi.fn();
      render(<NumericInput {...defaultProps} value={45} onChange={handleChange} />);
      
      const clearButton = screen.getByLabelText(/clear age/i);
      await userEvent.click(clearButton);
      
      expect(handleChange).toHaveBeenCalledWith(null);
    });

    it('should focus input after clear button is clicked', async () => {
      const handleChange = vi.fn();
      render(<NumericInput {...defaultProps} value={45} onChange={handleChange} />);
      
      const input = screen.getByRole('spinbutton');
      const clearButton = screen.getByLabelText(/clear age/i);
      
      await userEvent.click(clearButton);
      
      expect(input).toHaveFocus();
    });
  });

  describe('Validation and Error Display', () => {
    it('should display error message when error prop is provided', () => {
      render(
        <NumericInput
          {...defaultProps}
          error="Value must be at least 0"
        />
      );
      
      expect(screen.getByText(/value must be at least 0/i)).toBeInTheDocument();
    });

    it('should apply error class when error is present', () => {
      render(
        <NumericInput
          {...defaultProps}
          error="Invalid value"
        />
      );
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveClass('numeric-input__field--error');
    });

    it('should set aria-invalid when error is present', () => {
      render(
        <NumericInput
          {...defaultProps}
          error="Invalid value"
        />
      );
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('should not set aria-invalid when no error', () => {
      render(<NumericInput {...defaultProps} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });

    it('should link error message with aria-describedby', () => {
      render(
        <NumericInput
          {...defaultProps}
          error="Invalid value"
        />
      );
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('aria-describedby', 'age-error');
      expect(screen.getByRole('alert')).toHaveAttribute('id', 'age-error');
    });
  });

  describe('Tooltip', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should show tooltip on hover after delay', async () => {
      render(
        <NumericInput
          {...defaultProps}
          tooltip="Patient age in years"
        />
      );
      
      const container = screen.getByRole('spinbutton').closest('.numeric-input');
      
      fireEvent.mouseEnter(container!);
      
      // Tooltip should not appear immediately
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      
      // Fast-forward time
      vi.advanceTimersByTime(500);
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText(/patient age in years/i)).toBeInTheDocument();
      });
    });

    it('should hide tooltip on mouse leave', async () => {
      render(
        <NumericInput
          {...defaultProps}
          tooltip="Patient age in years"
        />
      );
      
      const container = screen.getByRole('spinbutton').closest('.numeric-input');
      
      fireEvent.mouseEnter(container!);
      vi.advanceTimersByTime(500);
      
      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
      });
      
      fireEvent.mouseLeave(container!);
      
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });

    it('should not show tooltip if mouse leaves before delay', async () => {
      render(
        <NumericInput
          {...defaultProps}
          tooltip="Patient age in years"
        />
      );
      
      const container = screen.getByRole('spinbutton').closest('.numeric-input');
      
      fireEvent.mouseEnter(container!);
      vi.advanceTimersByTime(200); // Less than 500ms
      fireEvent.mouseLeave(container!);
      vi.advanceTimersByTime(500);
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('should not show tooltip when error is present', async () => {
      render(
        <NumericInput
          {...defaultProps}
          tooltip="Patient age in years"
          error="Invalid value"
        />
      );
      
      const container = screen.getByRole('spinbutton').closest('.numeric-input');
      
      fireEvent.mouseEnter(container!);
      vi.advanceTimersByTime(500);
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('should not render tooltip when tooltip prop is not provided', async () => {
      render(<NumericInput {...defaultProps} />);
      
      const container = screen.getByRole('spinbutton').closest('.numeric-input');
      
      fireEvent.mouseEnter(container!);
      vi.advanceTimersByTime(500);
      
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper aria-label with range information', () => {
      render(<NumericInput {...defaultProps} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('aria-label', 'Age (range: 0 to 120)');
    });

    it('should include unit in aria-label when provided', () => {
      render(<NumericInput {...defaultProps} unit="years" />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('aria-label', 'Age (range: 0 to 120 years)');
    });

    it('should link to tooltip with aria-describedby when present', () => {
      render(
        <NumericInput
          {...defaultProps}
          tooltip="Patient age in years"
        />
      );
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('aria-describedby', 'age-tooltip');
    });

    it('should have correct id and name attributes', () => {
      render(<NumericInput {...defaultProps} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('id', 'age');
      expect(input).toHaveAttribute('name', 'age');
    });

    it('should be keyboard navigable', async () => {
      render(<NumericInput {...defaultProps} />);
      
      const input = screen.getByRole('spinbutton');
      
      await userEvent.tab();
      expect(input).toHaveFocus();
    });
  });

  describe('Input Attributes', () => {
    it('should set correct min and max attributes', () => {
      render(<NumericInput {...defaultProps} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('min', '0');
      expect(input).toHaveAttribute('max', '120');
    });

    it('should allow any step value', () => {
      render(<NumericInput {...defaultProps} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('step', 'any');
    });

    it('should have type="number"', () => {
      render(<NumericInput {...defaultProps} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveAttribute('type', 'number');
    });
  });

  describe('Focus States', () => {
    it('should apply focus class when input is focused', async () => {
      render(<NumericInput {...defaultProps} />);
      
      const input = screen.getByRole('spinbutton');
      
      await userEvent.click(input);
      
      expect(input).toHaveClass('numeric-input__field--focused');
    });

    it('should remove focus class when input is blurred', async () => {
      render(<NumericInput {...defaultProps} />);
      
      const input = screen.getByRole('spinbutton');
      
      await userEvent.click(input);
      expect(input).toHaveClass('numeric-input__field--focused');
      
      await userEvent.tab();
      expect(input).not.toHaveClass('numeric-input__field--focused');
    });

    it('should apply filled class when value is present', () => {
      render(<NumericInput {...defaultProps} value={45} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).toHaveClass('numeric-input__field--filled');
    });

    it('should not apply filled class when value is null', () => {
      render(<NumericInput {...defaultProps} value={null} />);
      
      const input = screen.getByRole('spinbutton');
      expect(input).not.toHaveClass('numeric-input__field--filled');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero as a valid value', () => {
      const handleChange = vi.fn();
      render(<NumericInput {...defaultProps} value={0} onChange={handleChange} />);
      
      const input = screen.getByRole('spinbutton') as HTMLInputElement;
      expect(input.value).toBe('0');
      expect(screen.getByLabelText(/clear age/i)).toBeInTheDocument();
    });

    it('should handle max value correctly', () => {
      const handleChange = vi.fn();
      render(<NumericInput {...defaultProps} onChange={handleChange} />);
      
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '120' } });
      
      expect(handleChange).toHaveBeenCalledWith(120);
    });

    it('should handle min value correctly', () => {
      const handleChange = vi.fn();
      render(<NumericInput {...defaultProps} onChange={handleChange} />);
      
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '0' } });
      
      expect(handleChange).toHaveBeenCalledWith(0);
    });

    it('should handle large numbers', () => {
      const handleChange = vi.fn();
      render(
        <NumericInput
          name="wc"
          label="WC"
          min={0}
          max={30000}
          value={null}
          onChange={handleChange}
        />
      );
      
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '25000' } });
      
      expect(handleChange).toHaveBeenCalledWith(25000);
    });

    it('should handle very small decimal values', () => {
      const handleChange = vi.fn();
      render(
        <NumericInput
          name="sg"
          label="SG"
          min={1.0}
          max={1.03}
          value={null}
          onChange={handleChange}
        />
      );
      
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '1.005' } });
      
      expect(handleChange).toHaveBeenCalledWith(1.005);
    });
  });
});
