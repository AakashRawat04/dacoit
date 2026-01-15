import type { BencodeValue } from './types';

export const encodeInteger = (value: number): Buffer => {
  if (!Number.isInteger(value)) {
    throw new Error('Value must be an integer');
  }

  return Buffer.from(`i${value}e`);
};

export const encodeBuffer = (value: Buffer): Buffer => {
  return Buffer.concat([
    Buffer.from(`${value.length}:`),
    value,
  ] as unknown as Uint8Array[]);
};

export const encodeBencode = (value: BencodeValue): Buffer => {
  if (typeof value === 'number') {
    return encodeInteger(value);
  } else if (Buffer.isBuffer(value)) {
    return encodeBuffer(value);
  } else if (Array.isArray(value)) {
    return encodeList(value);
  } else if (typeof value === 'object') {
    return encodeDictionary(value);
  } else {
    throw new Error('Unsupported bencode value type');
  }
};

export const encodeList = (list: BencodeValue[]): Buffer => {
  const buffers: Buffer[] = [Buffer.from('l')];

  for (const item of list) {
    buffers.push(encodeBencode(item));
  }

  buffers.push(Buffer.from('e'));
  return Buffer.concat(buffers as unknown as Uint8Array[]);
};

export const encodeDictionary = (
  dict: Record<string, BencodeValue>,
): Buffer => {
  const buffers: Buffer[] = [Buffer.from('d')];

  // Bencode dictionaries must have keys sorted in lexicographical order
  const sortedKeys = Object.keys(dict).sort();

  for (const key of sortedKeys) {
    const keyBuffer = Buffer.from(key);
    buffers.push(encodeBuffer(keyBuffer));
    buffers.push(encodeBencode(dict[key]));
  }

  buffers.push(Buffer.from('e'));
  return Buffer.concat(buffers as unknown as Uint8Array[]);
};
