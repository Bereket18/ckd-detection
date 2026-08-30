import React, { useState } from 'react';
import './FormSection.css';

interface FormSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  collapsible?: boolean;
}

/**
 * FormSection component that groups related form fields with a header
 * 
 * **Validates: Requirements 1.2**
 * 
 * @param title - Section header title
 * @param description - Optional description text below title
 * @param children - Form field components to render in responsive grid
 * @param collapsible - Optional flag to enable collapse/expand functionality
 */
export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  children,
  collapsible = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <section className="form-section" aria-labelledby={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}>
      <div className="form-section-header">
        <h3 
          id={`section-${title.replace(/\s+/g, '-').toLowerCase()}`}
          className="form-section-title"
          onClick={handleToggle}
          style={{ cursor: collapsible ? 'pointer' : 'default' }}
        >
          {title}
          {collapsible && (
            <span 
              className={`form-section-toggle ${isExpanded ? 'expanded' : 'collapsed'}`}
              aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleToggle();
                }
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </span>
          )}
        </h3>
        {description && (
          <p className="form-section-description">{description}</p>
        )}
      </div>
      {isExpanded && (
        <div className="form-section-content" role="group">
          {children}
        </div>
      )}
    </section>
  );
};
