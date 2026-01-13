import type { BencodeValue } from './types';

export const parseInteger = (
  buffer: Buffer,
  position: number,
): [BencodeValue, number] => {
  // Bencode integers are encoded as: i<integer>e
  // check for starting 'i'
  const firstByte = buffer[position];
  if (firstByte !== 'i'.charCodeAt(0)) {
    throw new Error(`Invalid integer start at position ${position}`);
  }
  let endPosition = position + 1;

  // find the ending 'e' position (if not found, it's an error)
  while (buffer[endPosition] !== 'e'.charCodeAt(0)) {
    endPosition++;
    if (endPosition >= buffer.length) {
      throw new Error(`Unterminated integer starting at position ${position}`);
    }
  }

  const intBuffer = buffer.subarray(position + 1, endPosition);

  const intString = intBuffer.toString();
  // Check for leading zeros (except "0")
  if (intString !== '0' && intString.startsWith('0')) {
    throw new Error(`Invalid integer: leading zeros not allowed`);
  }

  // Check for negative zero
  if (intString === '-0') {
    throw new Error(`Invalid integer: negative zero not allowed`);
  }

  const intValue = parseInt(intString, 10);
  if (isNaN(intValue)) {
    throw new Error(`Invalid integer value at position ${position}`);
  }
  return [intValue, endPosition + 1];
};

export const parseBuffer = (
  buffer: Buffer,
  position: number,
): [BencodeValue, number] => {
  // read until we find a colon
  let colonPosition = position;
  while (buffer[colonPosition] !== ':'.charCodeAt(0)) {
    colonPosition++;
    if (colonPosition >= buffer.length) {
      throw new Error(`Unterminated string length at position ${position}`);
    }
  }

  // extract the length of the string
  const lengthBuffer = buffer.subarray(position, colonPosition);
  const lengthString = lengthBuffer.toString();
  const strLength = parseInt(lengthString, 10);
  if (isNaN(strLength) || strLength < 0) {
    throw new Error(`Invalid string length at position ${position}`);
  }

  // extract the string value
  const strStart = colonPosition + 1;
  const strEnd = strStart + strLength;
  if (strEnd > buffer.length) {
    throw new Error(`String exceeds buffer length at position ${position}`);
  }

  const strBuffer = buffer.subarray(strStart, strEnd);
  return [strBuffer, strEnd];
};

/**
 * handle different bencode types (integer, string, list, dictionary)
 */
export const parseBencode = (buffer: Buffer): [BencodeValue, number] => {
  const firstByte = buffer[0];
  if (firstByte === 'i'.charCodeAt(0)) {
    const [value, position] = parseInteger(buffer, 0);
    return [value, position];
  } else if (firstByte >= '0'.charCodeAt(0) && firstByte <= '9'.charCodeAt(0)) {
    const [value, position] = parseBuffer(buffer, 0);
    return [value.toString(), position];
  } else if (firstByte === 'l'.charCodeAt(0)) {
    const [value, position] = parseList(buffer, 0);
    return [value, position];
  } else if (firstByte === 'd'.charCodeAt(0)) {
    const [value, position] = parseDictionary(buffer, 0);
    return [value, position];
  } else {
    throw new Error(`Unknown bencode type at position 0`);
  }
};

export const parseList = (
  buffer: Buffer,
  position: number,
): [BencodeValue, number] => {
  const firstByte = buffer[position];
  if (firstByte !== 'l'.charCodeAt(0)) {
    throw new Error(`Invalid list start at position ${position}`);
  }
  let currentPosition = position + 1;
  const list: BencodeValue[] = [];

  while (buffer[currentPosition] !== 'e'.charCodeAt(0)) {
    // recursively parse based on the type
    let [element, newPosition] = parseBencode(buffer.subarray(currentPosition));
    newPosition += currentPosition; // adjust position relative to the original buffer

    list.push(element);
    currentPosition = newPosition;
  }

  return [list, currentPosition + 1];
};

export const parseDictionary = (
  buffer: Buffer,
  position: number,
): [BencodeValue, number] => {
  const firstByte = buffer[position];
  if (firstByte !== 'd'.charCodeAt(0)) {
    throw new Error(`Invalid dictionary start at position ${position}`);
  }
  let currentPosition = position + 1;
  const dict: Record<string, BencodeValue> = {};

  while (buffer[currentPosition] !== 'e'.charCodeAt(0)) {
    // parse key (must be a string)
    let [keyBuffer, newPosition] = parseBuffer(buffer, currentPosition);
    const key = keyBuffer.toString();
    currentPosition = newPosition;

    // parse value (can be any bencode type)
    let [value, valueEndPosition] = parseBencode(
      buffer.subarray(currentPosition),
    );
    valueEndPosition += currentPosition; // adjust position relative to the original buffer

    dict[key] = value;
    currentPosition = valueEndPosition;
  }

  return [dict, currentPosition + 1];
};
