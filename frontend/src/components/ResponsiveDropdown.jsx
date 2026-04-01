import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

const normalizeOptions = (options) => {
  return (options || []).map((option) => {
    if (typeof option === 'string') {
      return { value: option, label: option, fullLabel: option };
    }
    return {
      value: option.value,
      label: option.label,
      fullLabel: option.fullLabel || option.label
    };
  });
};

const ResponsiveDropdown = ({ value, onChange, options, className = '', buttonClassName = '' }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const normalizedOptions = useMemo(() => normalizeOptions(options), [options]);
  const selected = normalizedOptions.find((opt) => opt.value === value) || normalizedOptions[0];

  useEffect(() => {
    const onClickOutside = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className={`responsive-dropdown ${className}`} ref={rootRef}>
      <button
        type="button"
        className={`form-control responsive-dropdown-trigger ${buttonClassName}`.trim()}
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
      >
        <span className="responsive-dropdown-label">{selected?.label || ''}</span>
        <ChevronDown size={16} className={open ? 'responsive-dropdown-arrow open' : 'responsive-dropdown-arrow'} />
      </button>

      {open && (
        <div className="responsive-dropdown-menu">
          {normalizedOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`responsive-dropdown-option ${option.value === value ? 'active' : ''}`}
              title={option.fullLabel}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ResponsiveDropdown;
