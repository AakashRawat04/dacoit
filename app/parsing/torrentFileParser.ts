import fs from 'fs';
import type { TorrentFile } from '../types';
import { parseBencode } from './bencodeParser';

export const parseTorrentFile = (filePath: string): TorrentFile => {
  const fileBuffer = fs.readFileSync(filePath);
  const [torrent] = parseBencode(fileBuffer, 0);

  if (
    typeof torrent !== 'object' ||
    Array.isArray(torrent) ||
    Buffer.isBuffer(torrent)
  ) {
    throw new Error('Invalid torrent file: expected dictionary at root');
  }

  const announce = torrent.announce;
  const info = torrent.info;

  if (!Buffer.isBuffer(announce)) {
    throw new Error('Invalid torrent file: announce field missing or invalid');
  }

  if (
    typeof info !== 'object' ||
    Array.isArray(info) ||
    Buffer.isBuffer(info)
  ) {
    throw new Error('Invalid torrent file: info field missing or invalid');
  }

  const length = info.length;
  const name = info.name;
  const pieceLength = info['piece length'];
  const pieces = info.pieces;

  if (
    typeof length !== 'number' ||
    !Buffer.isBuffer(name) ||
    typeof pieceLength !== 'number' ||
    !Buffer.isBuffer(pieces)
  ) {
    throw new Error('Invalid torrent file: info fields are missing or invalid');
  }

  return {
    announce,
    info: {
      length,
      name,
      pieceLength,
      pieces,
    },
  };
};

export const parseInfoPieces = (piecesBuffer: Buffer): string[] => {
  const SHA1_HASH_LENGTH = 20; // SHA-1 hash length in bytes
  const numPieces = piecesBuffer.length / SHA1_HASH_LENGTH;
  const pieceHashes: string[] = [];

  for (let i = 0; i < numPieces; i++) {
    const pieceHash = piecesBuffer.subarray(
      i * SHA1_HASH_LENGTH,
      (i + 1) * SHA1_HASH_LENGTH,
    );
    pieceHashes.push(pieceHash.toString('hex'));
  }

  return pieceHashes;
};