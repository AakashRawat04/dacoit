import { describe, expect, test } from 'bun:test';
import { parseBuffer, parseInteger } from '../../app/parsing/bencodeParser';

describe('parseInteger', () => {
  test('parses positive integers', () => {
    const buffer = Buffer.from('i42e');
    const [value, pos] = parseInteger(buffer, 0);
    expect(value).toBe(42);
    expect(pos).toBe(4);
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

describe('parseString', () => {
  test('parses simple strings', () => {
    const buffer = Buffer.from('5:hello');
    const [value, pos] = parseBuffer(buffer, 0);
    expect(value.toString()).toBe('hello');
    expect(pos).toBe(7);
  });

  test('parses empty string', () => {
    const buffer = Buffer.from('0:');
    const [value, pos] = parseBuffer(buffer, 0);
    expect(value.toString()).toBe('');
    expect(pos).toBe(2);
  });

  test('parses string with spaces', () => {
    const buffer = Buffer.from('11:hello world');
    const [value, pos] = parseBuffer(buffer, 0);
    expect(value.toString()).toBe('hello world');
    expect(pos).toBe(14);
  });

  test('parses string with special characters', () => {
    const buffer = Buffer.from('13:hello:world!@#');
    const [value, pos] = parseBuffer(buffer, 0);
    expect(value.toString()).toBe('hello:world!@');
    expect(pos).toBe(16);
  });

  test('parses string at non-zero position', () => {
    const buffer = Buffer.from('XXX4:testYYY');
    const [value, pos] = parseBuffer(buffer, 3);
    expect(value.toString()).toBe('test');
    expect(pos).toBe(9);
  });

  test('parses multi-digit length', () => {
    const buffer = Buffer.from('26:abcdefghijklmnopqrstuvwxyz');
    const [value, pos] = parseBuffer(buffer, 0);
    expect(value.toString()).toBe('abcdefghijklmnopqrstuvwxyz');
    expect(pos).toBe(29);
  });

  test('returns Buffer (not string) for binary data', () => {
    // Simulate binary data (like SHA-1 hash)
    const binaryData = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
    const buffer = Buffer.concat([
      Buffer.from('5:'),
      binaryData,
    ] as unknown as Uint8Array[]);
    const [value, pos] = parseBuffer(buffer, 0);

    expect(value).toBeInstanceOf(Buffer);
    expect(value).toEqual(binaryData);
    expect(pos).toBe(7);
  });

  test('handles UTF-8 encoded text', () => {
    // UTF-8: "hello 世界!" is 13 bytes (6 for "hello ", 6 for "世界", 1 for "!")
    const text = 'hello 世界!';
    const byteLength = Buffer.byteLength(text, 'utf-8');
    const buffer = Buffer.from(`${byteLength}:${text}`);
    const [value, pos] = parseBuffer(buffer, 0);
    expect((value as Buffer).toString('utf-8')).toBe(text);
  });

  test('preserves binary data without corruption', () => {
    // SHA-1 hash example (20 bytes of binary)
    const hash = Buffer.from([
      0x2f, 0xd4, 0xe1, 0xc6, 0x7a, 0x2d, 0x28, 0xfc, 0xed, 0x84, 0x9e, 0xe1,
      0xbb, 0x76, 0xe7, 0x39, 0x1b, 0x93, 0xeb, 0x12,
    ]);
    const buffer = Buffer.concat([
      Buffer.from('20:'),
      hash,
    ] as unknown as Uint8Array[]);
    const [value, pos] = parseBuffer(buffer, 0);

    expect(value).toEqual(hash);
    expect((value as Buffer).length).toBe(20);
  });

  describe('error handling', () => {
    test('throws on missing colon', () => {
      const buffer = Buffer.from('5hello');
      expect(() => parseBuffer(buffer, 0)).toThrow(
        /unterminated string length/i,
      );
    });

    test('throws on invalid length (non-numeric)', () => {
      const buffer = Buffer.from('abc:hello');
      expect(() => parseBuffer(buffer, 0)).toThrow(/invalid string length/i);
    });

    test('throws on negative length', () => {
      const buffer = Buffer.from('-5:hello');
      expect(() => parseBuffer(buffer, 0)).toThrow(/invalid string length/i);
    });

    test('throws when string exceeds buffer length', () => {
      const buffer = Buffer.from('10:short');
      expect(() => parseBuffer(buffer, 0)).toThrow(/exceeds buffer length/i);
    });

    test('throws on partial string data', () => {
      const buffer = Buffer.from('5:hel');
      expect(() => parseBuffer(buffer, 0)).toThrow(/exceeds buffer length/i);
    });
  });
});
