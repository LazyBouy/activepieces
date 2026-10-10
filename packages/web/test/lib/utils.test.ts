import { describe, expect, it } from 'vitest';

import { cn } from '@/lib/utils';

describe('cn', () => {
  it('keeps the 13px and 10px type sizes when a text colour follows', () => {
    expect(cn('text-xsm', 'text-gray-11')).toBe('text-xsm text-gray-11');
    expect(cn('text-xss', 'text-gray-11')).toBe('text-xss text-gray-11');
    expect(cn('text-gray-11', 'text-xsm')).toBe('text-gray-11 text-xsm');
  });

  it('lets the later type size win over an earlier one', () => {
    expect(cn('text-sm', 'text-xsm')).toBe('text-xsm');
    expect(cn('text-xsm', 'text-xs')).toBe('text-xs');
    expect(cn('text-xss', 'md:text-sm', 'text-base')).toBe(
      'md:text-sm text-base',
    );
  });

  it('keeps a text colour when only sizes are merged', () => {
    expect(cn('text-xsm text-accent-9', 'text-xss')).toBe(
      'text-accent-9 text-xss',
    );
  });

  it('treats the theme shadow names as shadows', () => {
    expect(cn('shadow-xs', 'shadow-float')).toBe('shadow-float');
    expect(cn('shadow-float', 'shadow-none')).toBe('shadow-none');
    expect(cn('shadow-dialog', 'shadow-gray-6')).toBe(
      'shadow-dialog shadow-gray-6',
    );
  });
});
