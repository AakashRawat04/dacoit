import type { BencodeValue } from "./types";

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