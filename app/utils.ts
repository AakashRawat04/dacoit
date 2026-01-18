import crypto from 'crypto';
import {
  BLOCK_SIZE,
  PEER_ID_LENGTH,
  PEER_ID_PREFIX,
  SHA1_HASH_LENGTH,
} from './constants';
import type { BencodeValue } from './types';

/**
 * Represents information about a block within a piece
 */
export interface BlockInfo {
  index: number; // Piece index
  begin: number; // Byte offset within the piece
  length: number; // Length of the block in bytes
}

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

export const generatePeerId = (): Buffer => {
  const prefix = PEER_ID_PREFIX;
  const randomPart = crypto.randomBytes(PEER_ID_LENGTH - prefix.length);
  return Buffer.concat([
    Buffer.from(prefix),
    randomPart,
  ] as unknown as Uint8Array[]);
};

/**
 * Calculates block information for downloading a piece.
 *
 * A piece is divided into blocks of BLOCK_SIZE (16 KB) bytes.
 * The last block may be smaller if the piece length is not evenly divisible.
 *
 * @param pieceIndex - The zero-based index of the piece to download
 * @param pieceLength - The length of the piece in bytes
 * @returns Array of BlockInfo objects describing each block to request
 *
 * @example
 * // For a 262144 byte (256 KB) piece:
 * // Returns 16 blocks: 15 blocks of 16384 bytes + 1 block of 16384 bytes
 * calculateBlocks(0, 262144);
 *
 * @example
 * // For a 100000 byte piece:
 * // Returns 7 blocks: 6 blocks of 16384 bytes + 1 block of 1696 bytes
 * calculateBlocks(0, 100000);
 */
export const calculateBlocks = (
  pieceIndex: number,
  pieceLength: number,
): BlockInfo[] => {
  const blocks: BlockInfo[] = [];
  let offset = 0;

  while (offset < pieceLength) {
    const blockLength = Math.min(BLOCK_SIZE, pieceLength - offset);

    blocks.push({
      index: pieceIndex,
      begin: offset,
      length: blockLength,
    });

    offset += blockLength;
  }

  return blocks;
};

/**
 * Verifies that a downloaded piece matches its expected hash.
 *
 * @param pieceData - The complete piece data as a Buffer
 * @param expectedHash - The expected SHA-1 hash of the piece (20 bytes)
 * @returns true if the hash matches, false otherwise
 *
 * @example
 * const pieceData = Buffer.concat(allBlocks);
 * const expectedHash = torrent.info.pieces.subarray(pieceIndex * 20, (pieceIndex + 1) * 20);
 * if (!verifyPiece(pieceData, expectedHash)) {
 *   throw new Error('Piece hash mismatch!');
 * }
 */
export const verifyPiece = (
  pieceData: Buffer,
  expectedHash: Buffer,
): boolean => {
  const actualHash = crypto
    .createHash('sha1')
    .update(pieceData as unknown as crypto.BinaryLike)
    .digest();

  return actualHash.equals(Uint8Array.from(expectedHash));
};

/**
 * Gets the expected hash for a specific piece from the torrent info.
 *
 * The pieces field in the torrent contains concatenated SHA-1 hashes,
 * each 20 bytes long. This function extracts the hash for a specific piece.
 *
 * @param pieces - The pieces buffer from torrent.info.pieces
 * @param pieceIndex - The zero-based index of the piece
 * @returns The 20-byte SHA-1 hash for the specified piece
 *
 * @example
 * const expectedHash = getPieceHash(torrent.info.pieces, 0);
 */
export const getPieceHash = (pieces: Buffer, pieceIndex: number): Buffer => {
  const start = pieceIndex * SHA1_HASH_LENGTH;
  const end = start + SHA1_HASH_LENGTH;

  if (end > pieces.length) {
    throw new Error(`Piece index ${pieceIndex} out of range`);
  }

  return pieces.subarray(start, end);
};
