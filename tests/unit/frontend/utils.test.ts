/**
 * Unit tests for utility functions
 */

// Mock utility functions that would be in lib/utils.ts
export const formatDate = (date: string | Date): string => {
  const d = new Date(date);
  return d.toLocaleDateString('sk-SK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const formatReadingTime = (minutes: number): string => {
  if (minutes < 1) return 'Menej ako 1 min';
  if (minutes === 1) return '1 min';
  return `${minutes} min`;
};

export const generateSlug = (title: string): string => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
};

export const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

export const isValidSlovakText = (text: string): boolean => {
  // Check for Slovak diacritics
  const slovakDiacritics = /[áäčďéíĺľňóôŕšťúýž]/i;
  return slovakDiacritics.test(text);
};

export const extractKeywords = (text: string): string[] => {
  // Simple keyword extraction (in real app, this would be more sophisticated)
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 3);
  
  // Remove common Slovak stop words
  const stopWords = ['ktorý', 'ktorá', 'ktoré', 'ktorí', 'ktorých', 'ktorým', 'ktorými', 'tento', 'táto', 'toto', 'títo', 'týchto', 'tomuto', 'týmto', 'je', 'sú', 'bol', 'bola', 'bolo', 'boli', 'bude', 'budú', 'má', 'majú', 'mal', 'mala', 'malo', 'mali', 'máme', 'máte', 'majú', 'pre', 'na', 'v', 'z', 'do', 'od', 'k', 'o', 's', 'a', 'ale', 'alebo', 'ani', 'či', 'keď', 'ak', 'že', 'aby', 'lebo', 'takže', 'preto', 'aj', 'tiež', 'len', 'iba', 'už', 'ešte', 'stále', 'vždy', 'nikdy', 'niekedy', 'často', 'zriedka', 'veľmi', 'dosť', 'celkom', 'úplne', 'skoro', 'takmer', 'asi', 'možno', 'určite', 'iste', 'samozrejme', 'nepochybne'];
  
  return words
    .filter(word => !stopWords.includes(word))
    .slice(0, 10); // Return max 10 keywords
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const sanitizeHtml = (html: string): string => {
  // Basic HTML sanitization (in real app, use a proper library like DOMPurify)
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
};

export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

describe('Utility Functions', () => {
  describe('formatDate', () => {
    test('should format date string correctly', () => {
      const result = formatDate('2025-01-15T06:00:00.000Z');
      expect(result).toMatch(/15\. januára 2025/);
    });

    test('should format Date object correctly', () => {
      const date = new Date('2025-12-25T12:00:00.000Z');
      const result = formatDate(date);
      expect(result).toMatch(/25\. decembra 2025/);
    });

    test('should handle invalid date gracefully', () => {
      const result = formatDate('invalid-date');
      expect(result).toBe('Invalid Date');
    });
  });

  describe('formatReadingTime', () => {
    test('should format reading time correctly', () => {
      expect(formatReadingTime(0)).toBe('Menej ako 1 min');
      expect(formatReadingTime(1)).toBe('1 min');
      expect(formatReadingTime(5)).toBe('5 min');
      expect(formatReadingTime(10)).toBe('10 min');
    });

    test('should handle decimal values', () => {
      expect(formatReadingTime(1.5)).toBe('1.5 min');
      expect(formatReadingTime(2.7)).toBe('2.7 min');
    });
  });

  describe('generateSlug', () => {
    test('should generate valid slug from title', () => {
      expect(generateSlug('Test Article Title')).toBe('test-article-title');
      expect(generateSlug('Článok o Astronómii')).toBe('clanok-o-astronomii');
      expect(generateSlug('NASA APOD - Daily Image')).toBe('nasa-apod-daily-image');
    });

    test('should handle special characters', () => {
      expect(generateSlug('Test & Article!')).toBe('test-article');
      expect(generateSlug('Article with "quotes"')).toBe('article-with-quotes');
      expect(generateSlug('Multiple   Spaces')).toBe('multiple-spaces');
    });

    test('should handle empty or whitespace strings', () => {
      expect(generateSlug('')).toBe('');
      expect(generateSlug('   ')).toBe('');
      expect(generateSlug('---')).toBe('');
    });
  });

  describe('truncateText', () => {
    test('should truncate long text', () => {
      const longText = 'This is a very long text that should be truncated when it exceeds the maximum length specified.';
      const result = truncateText(longText, 50);
      expect(result).toBe('This is a very long text that should be...');
      expect(result.length).toBeLessThanOrEqual(53); // 50 + '...'
    });

    test('should not truncate short text', () => {
      const shortText = 'Short text';
      const result = truncateText(shortText, 50);
      expect(result).toBe('Short text');
    });

    test('should handle exact length', () => {
      const text = 'Exactly fifty characters long text here!';
      const result = truncateText(text, 50);
      expect(result).toBe('Exactly fifty characters long text here!');
    });
  });

  describe('isValidSlovakText', () => {
    test('should detect Slovak diacritics', () => {
      expect(isValidSlovakText('Slovenčina s diakritikou')).toBe(true);
      expect(isValidSlovakText('článok o astronómii')).toBe(true);
      expect(isValidSlovakText('žiarivé hviezdy')).toBe(true);
    });

    test('should return false for text without diacritics', () => {
      expect(isValidSlovakText('English text without diacritics')).toBe(false);
      expect(isValidSlovakText('Slovensky text bez diakritiky')).toBe(false);
    });

    test('should handle empty string', () => {
      expect(isValidSlovakText('')).toBe(false);
    });
  });

  describe('extractKeywords', () => {
    test('should extract keywords from Slovak text', () => {
      const text = 'Tento článok hovorí o astronómii a vesmíre. Hovorí o hviezdach a galaxiách.';
      const keywords = extractKeywords(text);
      
      expect(keywords).toContain('článok');
      expect(keywords).toContain('astronómii');
      expect(keywords).toContain('vesmíre');
      expect(keywords).toContain('hviezdach');
      expect(keywords).toContain('galaxiách');
      expect(keywords).not.toContain('tento');
      expect(keywords).not.toContain('o');
      expect(keywords).not.toContain('a');
    });

    test('should limit number of keywords', () => {
      const longText = 'Toto je veľmi dlhý text s veľkým množstvom slov ktoré by mohli byť kľúčovými slovami pre tento článok o astronómii a vesmíre.';
      const keywords = extractKeywords(longText);
      
      expect(keywords.length).toBeLessThanOrEqual(10);
    });

    test('should handle empty text', () => {
      const keywords = extractKeywords('');
      expect(keywords).toEqual([]);
    });
  });

  describe('validateEmail', () => {
    test('should validate correct email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('user.name@domain.co.uk')).toBe(true);
      expect(validateEmail('test+tag@example.org')).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      expect(validateEmail('invalid-email')).toBe(false);
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('test.example.com')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });
  });

  describe('sanitizeHtml', () => {
    test('should remove script tags', () => {
      const html = '<p>Safe content</p><script>alert("xss")</script><p>More content</p>';
      const result = sanitizeHtml(html);
      expect(result).toBe('<p>Safe content</p><p>More content</p>');
    });

    test('should remove style tags', () => {
      const html = '<p>Content</p><style>body { color: red; }</style><p>More content</p>';
      const result = sanitizeHtml(html);
      expect(result).toBe('<p>Content</p><p>More content</p>');
    });

    test('should remove event handlers', () => {
      const html = '<p onclick="alert(\'xss\')">Content</p>';
      const result = sanitizeHtml(html);
      expect(result).toBe('<p>Content</p>');
    });

    test('should remove javascript: protocols', () => {
      const html = '<a href="javascript:alert(\'xss\')">Link</a>';
      const result = sanitizeHtml(html);
      expect(result).toBe('<a href="">Link</a>');
    });

    test('should preserve safe HTML', () => {
      const html = '<p>Safe <strong>content</strong> with <em>formatting</em></p>';
      const result = sanitizeHtml(html);
      expect(result).toBe(html);
    });
  });

  describe('debounce', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should delay function execution', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1');
      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledWith('arg1');
    });

    test('should cancel previous calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('arg1');
      debouncedFn('arg2');
      debouncedFn('arg3');

      jest.advanceTimersByTime(100);
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg3');
    });
  });

  describe('throttle', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should limit function execution frequency', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('arg1');
      throttledFn('arg2');
      throttledFn('arg3');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('arg1');

      jest.advanceTimersByTime(100);
      throttledFn('arg4');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('arg4');
    });
  });
});
