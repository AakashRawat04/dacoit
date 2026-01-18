import * as crypto from 'crypto';
import * as fs from 'fs';
import { PeerConnection } from '../network/PeerConnection';
import { parseBencode } from '../parsing/bencodeParser';
import { parseTorrentFile } from '../parsing/torrentFileParser';
import { parseTrackerResponse } from '../parsing/trackerResponseParser';
import {
  calculateBlocks,
  calculatePieceLength,
  extractRawInfoDict,
  generatePeerId,
  getPieceHash,
} from '../utils';

/**
 * Downloads the entire file by downloading all pieces sequentially
 * through a single peer connection.
 *
 * Flow:
 * 1. Parse torrent file and get peer list from tracker
 * 2. Connect to first available peer
 * 3. Download all pieces through the same connection
 * 4. Assemble pieces and save to disk
 *
 * @param outputPath - Path where the downloaded file will be saved
 * @param filename - Path to the torrent file
 */
export const handleDownloadCommand = async (
  outputPath: string,
  filename: string,
) => {
  try {
    // 1. Parse torrent file
    const torrent = parseTorrentFile(filename);
    const fileBuffer = fs.readFileSync(filename);
    const rawInfoDict = extractRawInfoDict(fileBuffer);
    const infoHash = crypto
      .createHash('sha1')
      .update(rawInfoDict as unknown as crypto.BinaryLike)
      .digest();

    // 2. Get peer list from tracker
    const announce = torrent.announce.toString('utf-8');
    const peerId = generatePeerId();
    const infoHashPercentEncoded = Array.from(infoHash)
      .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
      .join('');

    const params = [
      `info_hash=${infoHashPercentEncoded}`,
      `peer_id=${peerId.toString('hex').substring(0, 20)}`,
      `port=6881`,
      `uploaded=0`,
      `downloaded=0`,
      `left=${torrent.info.length}`,
      `compact=1`,
    ].join('&');

    const trackerUrl = `${announce}?${params}`;
    const response = await fetch(trackerUrl);
    const responseBuffer = Buffer.from(await response.arrayBuffer());
    const [trackerResponse] = parseBencode(responseBuffer, 0);
    const parsedTracker = parseTrackerResponse(trackerResponse);

    // Get first peer
    const peersBuffer = parsedTracker.peers;
    const peerIp = Array.from(peersBuffer.subarray(0, 4)).join('.');
    const peerPort = peersBuffer.readUInt16BE(4);

    console.log(`Connecting to peer: ${peerIp}:${peerPort}`);

    // 3. Calculate total pieces
    const standardPieceLength = torrent.info.pieceLength;
    const totalFileLength = torrent.info.length;
    const totalPieces = Math.ceil(totalFileLength / standardPieceLength);

    console.log(`Downloading ${totalPieces} pieces...`);

    // 4. Connect to peer (once)
    const peer = new PeerConnection(peerIp, peerPort, infoHash, peerId);
    await peer.connect();

    // 5. Download all pieces through the same connection
    const pieces: Buffer[] = new Array(totalPieces);

    for (let pieceIndex = 0; pieceIndex < totalPieces; pieceIndex++) {
      const actualPieceLength = calculatePieceLength(pieceIndex, torrent.info);
      const blocks = calculateBlocks(pieceIndex, actualPieceLength);
      const expectedHash = getPieceHash(torrent.info.pieces, pieceIndex);

      console.log(`Downloading piece ${pieceIndex}/${totalPieces - 1}...`);
      const pieceData = await peer.downloadPiece(blocks, expectedHash);
      pieces[pieceIndex] = pieceData;
    }

    // 6. Close connection
    peer.close();

    // 7. Assemble all pieces and save to file
    const completeFile = Buffer.concat(pieces as unknown as Uint8Array[]);
    fs.writeFileSync(outputPath, new Uint8Array(completeFile));

    console.log(
      `Downloaded ${torrent.info.name.toString('utf-8')} to ${outputPath}.`,
    );
  } catch (error) {
    console.error(`Error downloading file: ${(error as Error).message}`);
    throw error;
  }
};
