import { encodeBencode } from "../encoder";
import { parseTorrentFile } from "../torrentFileParser";
import * as crypto from "crypto";

export const handleInfoCommand = (filename: string) => {
  try {
      const torrent = parseTorrentFile(filename);
  
      console.log(`Tracker URL: ${torrent.announce.toString('utf-8')}`);
      console.log(`Length: ${torrent.info.length}`);
  
      // Compute info hash
      const encodedInfo = encodeBencode(torrent.info);
      const infoHash = crypto
        .createHash('sha1')
        .update(encodedInfo as unknown as crypto.BinaryLike)
        .digest('hex');
      console.log(`Info Hash: ${infoHash}`);
  
      // Extract piece length
      const pieceLength = torrent.info.pieceLength;
      console.log(`Piece Length: ${pieceLength}`);
  
      // Extract piece hashes
      const pieces = torrent.info.pieces;
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