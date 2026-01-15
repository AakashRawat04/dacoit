import * as crypto from 'crypto';
import * as fs from 'fs';
import { encodeBencode } from './encoder';
import { parseBencode } from './parser';
import type { BencodeValue } from './types';

// Helper function to convert Buffers to strings for JSON output
function convertBuffersToStrings(value: BencodeValue): any {
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

const args = process.argv;
const command = args[2];

if (command === 'decode') {
  const bencodedValue = args[3];
  try {
    const decoded = parseBencode(Buffer.from(bencodedValue))[0];
    // Convert Buffers to strings for JSON output
    console.log(JSON.stringify(convertBuffersToStrings(decoded)));
  } catch (error) {
    console.error((error as Error).message);
  }
} else if (command === 'info') {
  const filename = args[3];
  try {
    // Read the torrent file as binary
    const fileBuffer = fs.readFileSync(filename);

    // Parse the torrent file
    const [torrent] = parseBencode(fileBuffer, 0);

    if (
      typeof torrent !== 'object' ||
      Array.isArray(torrent) ||
      Buffer.isBuffer(torrent)
    ) {
      throw new Error('Invalid torrent file: expected dictionary at root');
    }

    // Extract announce URL
    const announce = torrent.announce;
    if (!Buffer.isBuffer(announce)) {
      throw new Error(
        'Invalid torrent file: announce field missing or invalid',
      );
    }
    console.log(`Tracker URL: ${announce.toString('utf-8')}`);

    // Extract info dictionary
    const info = torrent.info;
    if (
      typeof info !== 'object' ||
      Array.isArray(info) ||
      Buffer.isBuffer(info)
    ) {
      throw new Error(
        'Invalid torrent file: info dictionary missing or invalid',
      );
    }

    // Extract length from info dictionary
    const length = info.length;
    if (typeof length !== 'number') {
      throw new Error('Invalid torrent file: length field missing or invalid');
    }

    console.log(`Length: ${length}`);

    // Compute info hash
    const encodedInfo = encodeBencode(info);
    const infoHash = crypto
      .createHash('sha1')
      .update(encodedInfo as unknown as crypto.BinaryLike)
      .digest('hex');
    console.log(`Info Hash: ${infoHash}`);

    // Extract piece length
    const pieceLength = info['piece length'];
    if (typeof pieceLength !== 'number') {
      throw new Error(
        'Invalid torrent file: piece length field missing or invalid',
      );
    }
    console.log(`Piece Length: ${pieceLength}`);

    // Extract piece hashes
    const pieces = info.pieces;
    if (!Buffer.isBuffer(pieces)) {
      throw new Error('Invalid torrent file: pieces field missing or invalid');
    }
    const numPieces = pieces.length / 20; // SHA-1 hash is 20 bytes
    console.log(`Piece Hashes:`);

    // List piece hashes in hex
    for (let i = 0; i < numPieces; i++) {
      const pieceHash = pieces.subarray(i * 20, (i + 1) * 20);
      console.log(`${pieceHash.toString('hex')}`);
    }
  } catch (error) {
    console.error((error as Error).message);
  }
}
