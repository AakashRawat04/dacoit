import { describe, expect, test } from 'bun:test';
import {
  encodeBencode,
  encodeBuffer,
  encodeDictionary,
  encodeInteger,
  encodeList,
} from '../../app/encoder';

describe('encodeInteger', () => {
  test('encodes positive integers', () => {
    const result = encodeInteger(42);
    expect(result.toString()).toBe('i42e');
  });

  test('encodes zero', () => {
    const result = encodeInteger(0);
    expect(result.toString()).toBe('i0e');
  });

  test('encodes negative integers', () => {
    const result = encodeInteger(-42);
    expect(result.toString()).toBe('i-42e');
  });

  test('throws on non-integer', () => {
    expect(() => encodeInteger(42.5)).toThrow(/integer/i);
  });
});

describe('encodeBuffer', () => {
  test('encodes simple strings', () => {
    const result = encodeBuffer(Buffer.from('spam'));
    expect(result.toString()).toBe('4:spam');
  });

  test('encodes empty buffer', () => {
    const result = encodeBuffer(Buffer.from(''));
    expect(result.toString()).toBe('0:');
  });

  test('encodes binary data', () => {
    const binary = Buffer.from([0x01, 0x02, 0x03]);
    const result = encodeBuffer(binary);
    expect(result.toString()).toBe('3:\x01\x02\x03');
  });
});

describe('encodeList', () => {
  test('encodes empty list', () => {
    const result = encodeList([]);
    expect(result.toString()).toBe('le');
  });

  test('encodes list with integers', () => {
    const result = encodeList([1, 2, 3]);
    expect(result.toString()).toBe('li1ei2ei3ee');
  });

  test('encodes list with strings', () => {
    const result = encodeList([Buffer.from('spam'), Buffer.from('eggs')]);
    expect(result.toString()).toBe('l4:spam4:eggse');
  });

  test('encodes mixed list', () => {
    const result = encodeList([Buffer.from('spam'), 42]);
    expect(result.toString()).toBe('l4:spami42ee');
  });

  test('encodes nested list', () => {
    const result = encodeList([1, [2, 3], 4]);
    expect(result.toString()).toBe('li1eli2ei3eei4ee');
  });
});

describe('encodeDictionary', () => {
  test('encodes empty dictionary', () => {
    const result = encodeDictionary({});
    expect(result.toString()).toBe('de');
  });

  test('encodes simple dictionary', () => {
    const result = encodeDictionary({
      cow: Buffer.from('moo'),
      spam: Buffer.from('eggs'),
    });
    expect(result.toString()).toBe('d3:cow3:moo4:spam4:eggse');
  });

  test('encodes dictionary with integer value', () => {
    const result = encodeDictionary({
      foo: 42,
    });
    expect(result.toString()).toBe('d3:fooi42ee');
  });

  test('sorts keys lexicographically', () => {
    const result = encodeDictionary({
      zebra: 1,
      apple: 2,
      banana: 3,
    });
    // Keys should be sorted: apple, banana, zebra
    expect(result.toString()).toBe('d5:applei2e6:bananai3e5:zebrai1ee');
  });

  test('encodes nested dictionary', () => {
    const result = encodeDictionary({
      outer: { inner: 42 },
    });
    expect(result.toString()).toBe('d5:outerd5:inneri42eee');
  });
});

describe('encodeBencode (dispatcher)', () => {
  test('encodes integer', () => {
    const result = encodeBencode(42);
    expect(result.toString()).toBe('i42e');
  });

  test('encodes buffer', () => {
    const result = encodeBencode(Buffer.from('test'));
    expect(result.toString()).toBe('4:test');
  });

  test('encodes list', () => {
    const result = encodeBencode([1, 2]);
    expect(result.toString()).toBe('li1ei2ee');
  });

  test('encodes dictionary', () => {
    const result = encodeBencode({ key: 42 });
    expect(result.toString()).toBe('d3:keyi42ee');
  });

  test('encodes complex nested structure', () => {
    const result = encodeBencode({
      list: [1, 2, 3],
      name: Buffer.from('test'),
    });
    expect(result.toString()).toBe('d4:listli1ei2ei3ee4:name4:teste');
  });
});
