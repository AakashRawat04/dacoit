import * as crypto from 'crypto';
import * as fs from 'fs';
import { SHA1_HASH_LENGTH } from '../constants';
import { parseTorrentFile } from '../parsing/torrentFileParser';
import { extractRawInfoDict } from '../utils';

export const handleInfoCommand = (filename: string) => {
  try {
    const torrent = parseTorrentFile(filename);

    console.log(`Tracker URL: ${torrent.announce.toString('utf-8')}`);
    console.log(`Length: ${torrent.info.length}`);

    // Compute info hash from RAW bytes (don't re-encode!)
    const fileBuffer = fs.readFileSync(filename);
    const rawInfoDict = extractRawInfoDict(fileBuffer);
    const infoHash = crypto
      .createHash('sha1')
      .update(rawInfoDict as unknown as crypto.BinaryLike)
      .digest('hex');
    console.log(`Info Hash: ${infoHash}`);

    // Extract piece length
    const pieceLength = torrent.info.pieceLength;
    console.log(`Piece Length: ${pieceLength}`);

    // Extract piece hashes
    const pieces = torrent.info.pieces;
    const numPieces = pieces.length / SHA1_HASH_LENGTH; // SHA-1 hash is 20 bytes
    console.log(`Piece Hashes:`);

    // List piece hashes in hex
    for (let i = 0; i < numPieces; i++) {
      const pieceHash = pieces.subarray(
        i * SHA1_HASH_LENGTH,
        (i + 1) * SHA1_HASH_LENGTH,
      );
      console.log(`${pieceHash.toString('hex')}`);
    }
  } catch (error) {
    console.error((error as Error).message);
  }
};
