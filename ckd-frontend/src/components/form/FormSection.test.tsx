import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormSection } from './FormSection';

describe('FormSection', () => {
  it('should render section title', () => {
    render(
      <FormSection title="Test Section">
        <div>Content</div>
      </FormSection>
    );
    
    expect(screen.getByText('Test Section')).toBeInTheDocument();
  });

  it('should render children components', () => {
    render(
      <FormSection title="Test Section">
        <div>Child 1</div>
        <div>Child 2</div>
      </FormSection>
    );
    
    expect(screen.getByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('Child 2')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(
      <FormSection title="Test Section" description="This is a description">
        <div>Content</div>
      </FormSection>
    );
    
    expect(screen.getByText('This is a description')).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    const { container } = render(
      <FormSection title="Test Section">
        <div>Content</div>
      </FormSection>
    );
    
    const description = container.querySelector('.form-section-description');
    expect(description).not.toBeInTheDocument();
  });

  it('should render toggle button when collapsible is true', () => {
    render(
      <FormSection title="Test Section" collapsible={true}>
        <div>Content</div>
      </FormSection>
    );
    
    const toggle = screen.getByRole('button', { name: /collapse section/i });
    expect(toggle).toBeInTheDocument();
  });

  it('should not render toggle button when collapsible is false', () => {
    render(
      <FormSection title="Test Section" collapsible={false}>
        <div>Content</div>
      </FormSection>
    );
    
    const toggle = screen.queryByRole('button', { name: /collapse section/i });
    expect(toggle).not.toBeInTheDocument();
  });

  it('should collapse content when toggle is clicked', () => {
    render(
      <FormSection title="Test Section" collapsible={true}>
        <div>Content</div>
      </FormSection>
    );
    
    const toggle = screen.getByRole('button', { name: /collapse section/i });
    
    // Initially expanded
    expect(screen.getByText('Content')).toBeInTheDocument();
    
    // Click to collapse
    fireEvent.click(toggle);
    
    // Content should be hidden
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should expand content when toggle is clicked again', () => {
    render(
      <FormSection title="Test Section" collapsible={true}>
        <div>Content</div>
      </FormSection>
    );
    
    const toggle = screen.getByRole('button', { name: /collapse section/i });
    
    // Click to collapse
    fireEvent.click(toggle);
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    
    // Click to expand
    const expandToggle = screen.getByRole('button', { name: /expand section/i });
    fireEvent.click(expandToggle);
    
    // Content should be visible again
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('should toggle with Enter key when collapsible', () => {
    render(
      <FormSection title="Test Section" collapsible={true}>
        <div>Content</div>
      </FormSection>
    );
    
    const toggle = screen.getByRole('button', { name: /collapse section/i });
    
    // Press Enter to collapse
    fireEvent.keyDown(toggle, { key: 'Enter' });
    
    // Content should be hidden
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should toggle with Space key when collapsible', () => {
    render(
      <FormSection title="Test Section" collapsible={true}>
        <div>Content</div>
      </FormSection>
    );
    
    const toggle = screen.getByRole('button', { name: /collapse section/i });
    
    // Press Space to collapse
    fireEvent.keyDown(toggle, { key: ' ' });
    
    // Content should be hidden
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should have pointer cursor on title when collapsible', () => {
    const { container } = render(
      <FormSection title="Test Section" collapsible={true}>
        <div>Content</div>
      </FormSection>
    );
    
    const title = container.querySelector('.form-section-title');
    expect(title).toHaveStyle({ cursor: 'pointer' });
  });

  it('should have default cursor on title when not collapsible', () => {
    const { container } = render(
      <FormSection title="Test Section" collapsible={false}>
        <div>Content</div>
      </FormSection>
    );
    
    const title = container.querySelector('.form-section-title');
    expect(title).toHaveStyle({ cursor: 'default' });
  });

  it('should render with proper ARIA attributes', () => {
    render(
      <FormSection title="Test Section">
        <div>Content</div>
      </FormSection>
    );
    
    const section = screen.getByRole('region');
    expect(section).toHaveAttribute('aria-labelledby', 'section-test-section');
    
    const contentGroup = screen.getByRole('group');
    expect(contentGroup).toBeInTheDocument();
  });

  it('should apply expanded class to toggle when section is expanded', () => {
    render(
      <FormSection title="Test Section" collapsible={true}>
        <div>Content</div>
      </FormSection>
    );
    
    const toggle = screen.getByRole('button', { name: /collapse section/i });
    expect(toggle).toHaveClass('expanded');
  });

  it('should apply collapsed class to toggle when section is collapsed', () => {
    render(
      <FormSection title="Test Section" collapsible={true}>
        <div>Content</div>
      </FormSection>
    );
    
    const toggle = screen.getByRole('button', { name: /collapse section/i });
    fireEvent.click(toggle);
    
    const collapsedToggle = screen.getByRole('button', { name: /expand section/i });
    expect(collapsedToggle).toHaveClass('collapsed');
  });

  it('should handle title click when collapsible', () => {
    render(
      <FormSection title="Test Section" collapsible={true}>
        <div>Content</div>
      </FormSection>
    );
    
    const title = screen.getByText('Test Section');
    
    // Click title to collapse
    fireEvent.click(title);
    
    // Content should be hidden
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('should not collapse when title is clicked if not collapsible', () => {
    render(
      <FormSection title="Test Section" collapsible={false}>
        <div>Content</div>
      </FormSection>
    );
    
    const title = screen.getByText('Test Section');
    
    // Click title
    fireEvent.click(title);
    
    // Content should still be visible
    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
