import { describe, expect, test } from 'bun:test';
import { parseInteger } from '../../app/parsing/bencodeParser';

describe('parseInteger', () => {
  test('parses positive integers', () => {
    const buffer = Buffer.from('i42e');
    const [value, pos] = parseInteger(buffer, 0);
    expect(value).toBe(42);
    expect(pos).toBe(4); // Should be at end of buffer
  });

  test('parses zero', () => {
    const buffer = Buffer.from('i0e');
    const [value, pos] = parseInteger(buffer, 0);
    expect(value).toBe(0);
    expect(pos).toBe(3);
  });

  test('parses negative integers', () => {
    const buffer = Buffer.from('i-42e');
    const [value, pos] = parseInteger(buffer, 0);
    expect(value).toBe(-42);
    expect(pos).toBe(5);
  });

  test('parses multi-digit integers', () => {
    const buffer = Buffer.from('i123456e');
    const [value, pos] = parseInteger(buffer, 0);
    expect(value).toBe(123456);
    expect(pos).toBe(8);
  });

  test('parses integer at non-zero position', () => {
    const buffer = Buffer.from('XXXi99eYYY');
    const [value, pos] = parseInteger(buffer, 3);
    expect(value).toBe(99);
    expect(pos).toBe(7);
  });

  describe('error handling', () => {
    test('throws on leading zeros', () => {
      const buffer = Buffer.from('i04e');
      expect(() => parseInteger(buffer, 0)).toThrow(/leading zero/i);
    });

    test('throws on negative zero', () => {
      const buffer = Buffer.from('i-0e');
      expect(() => parseInteger(buffer, 0)).toThrow(/negative zero/i);
    });

    test('throws on missing end marker', () => {
      const buffer = Buffer.from('i42x');
      expect(() => parseInteger(buffer, 0)).toThrow(/unterminated/i);
    });

    test('throws on invalid start character', () => {
      const buffer = Buffer.from('x42e');
      expect(() => parseInteger(buffer, 0)).toThrow(/invalid integer start/i);
    });

    test('throws on non-numeric content', () => {
      const buffer = Buffer.from('iabce');
      expect(() => parseInteger(buffer, 0)).toThrow(/invalid integer/i);
    });
  });
});
