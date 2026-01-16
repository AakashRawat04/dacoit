import type { BencodeValue } from './types';

export function convertBuffersToStrings(value: BencodeValue): any {
  if (Buffer.isBuffer(value)) {
    return value.toString();
  } else if (Array.isArray(value)) {
    return value.map(convertBuffersToStrings);
  } else if (typeof value === 'object' && value !== null) {
    const result: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      result[key] = convertBuffersToStrings(val);
    }
    return result;
  }
  return value;
}

/**
 * Extract the raw bytes of the info dictionary from a torrent file.
 *
 * WHY THIS EXISTS:
 * The info hash MUST be calculated from the original bencoded bytes, not re-encoded.
 * Re-encoding might produce different bytes even for the same data (e.g., different key ordering).
 *
 * WHAT IT DOES:
 * 1. Find "4:info" in the torrent file (the key for the info dictionary)
 * 2. Extract the raw bytes of the value (the info dictionary)
 * 3. Properly handle bencode structure (strings, integers, lists, dicts)
 */
export function extractRawInfoDict(buffer: Buffer): Buffer {
  // Find the "4:info" key
  const infoKey = Buffer.from('4:info');
  let pos = buffer.indexOf(Uint8Array.from(infoKey));

  if (pos === -1) {
    throw new Error('Info dictionary not found in torrent file');
  }

  // Move past "4:info" to the start of the value
  pos += infoKey.length;

  if (buffer[pos] !== 'd'.charCodeAt(0)) {
    throw new Error('Info value must be a dictionary (start with "d")');
  }

  // Find the end of this dictionary by tracking depth
  // IMPORTANT: We must skip over string content to avoid false matches!
  const start = pos;
  let depth = 0;

  while (pos < buffer.length) {
    const byte = buffer[pos];

    // If it's a digit, it's a string: "<length>:<content>"
    if (byte >= 0x30 && byte <= 0x39) {
      // '0' to '9'
      // Read the length
      let colonPos = pos;
      while (buffer[colonPos] !== 0x3a) colonPos++; // Find ':'

      const length = parseInt(buffer.subarray(pos, colonPos).toString(), 10);
      pos = colonPos + 1 + length; // Skip past length + ':' + content
      continue;
    }

    // If it's 'i', it's an integer: "i<number>e"
    if (byte === 0x69) {
      // 'i'
      pos++;
      while (buffer[pos] !== 0x65) pos++; // Skip until 'e'
      pos++;
      continue;
    }

    // Structure markers: 'd' = dict, 'l' = list, 'e' = end
    if (byte === 0x64 || byte === 0x6c) {
      // 'd' or 'l'
      depth++;
    } else if (byte === 0x65) {
      // 'e'
      depth--;
      if (depth === 0) {
        // Found the end of the info dictionary
        return buffer.subarray(start, pos + 1);
      }
    }

    pos++;
  }

  throw new Error('Malformed torrent: info dictionary not properly closed');
}
