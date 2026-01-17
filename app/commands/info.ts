import * as crypto from 'crypto';
import * as fs from 'fs';
import {
  parseInfoPieces,
  parseTorrentFile,
} from '../parsing/torrentFileParser';
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
    const pieces = parseInfoPieces(torrent.info.pieces);
    console.log('Piece Hashes:');
    pieces.forEach((pieceHash) => {
      console.log(`${pieceHash}`);
    });
  } catch (error) {
    console.error((error as Error).message);
  }
};
