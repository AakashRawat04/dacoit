import * as crypto from 'crypto';
import * as fs from 'fs';
import {
  encodeInterestedMessage,
  encodeRequestMessage,
} from '../encoding/peerMessageEncoder';
import { encodeUTPHandshakeMessage } from '../encoding/uTPEncoder';
import { parseBencode } from '../parsing/bencodeParser';
import {
  isBitfieldMessage,
  isPieceMessage,
  isUnchokeMessage,
  parsePeerMessage,
  parsePieceMessage,
} from '../parsing/peerMessageParser';
import { parseTorrentFile } from '../parsing/torrentFileParser';
import { parseTrackerResponse } from '../parsing/trackerResponseParser';
import {
  calculateBlocks,
  extractRawInfoDict,
  generatePeerId,
  getPieceHash,
  verifyPiece,
  type BlockInfo,
} from '../utils';

/**
 * Downloads a single piece from a peer and saves it to disk.
 *
 * Flow:
 * 1. Parse torrent file and get peer list from tracker
 * 2. Connect to first available peer and perform handshake
 * 3. Wait for bitfield message
 * 4. Send interested message
 * 5. Wait for unchoke message
 * 6. Request all blocks for the piece
 * 7. Receive and assemble blocks
 * 8. Verify piece integrity
 * 9. Save to output file
 *
 * @param outputPath - Path where the downloaded piece will be saved
 * @param filename - Path to the torrent file
 * @param pieceIndex - Zero-based index of the piece to download
 */
export const handleDownloadPieceCommand = async (
  outputPath: string,
  filename: string,
  pieceIndex: number,
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

    // 3. Calculate blocks for this piece
    // IMPORTANT: Last piece might be smaller than pieceLength!
    const standardPieceLength = torrent.info.pieceLength;
    const totalFileLength = torrent.info.length;
    const totalPieces = Math.ceil(totalFileLength / standardPieceLength);

    // Calculate actual length for this specific piece
    let actualPieceLength: number;
    if (pieceIndex === totalPieces - 1) {
      // Last piece: calculate remaining bytes
      actualPieceLength = totalFileLength - pieceIndex * standardPieceLength;
    } else {
      // All other pieces: use standard piece length
      actualPieceLength = standardPieceLength;
    }

    const blocks = calculateBlocks(pieceIndex, actualPieceLength);
    const expectedHash = getPieceHash(torrent.info.pieces, pieceIndex);

    // 4. Download the piece
    await downloadPieceFromPeer(
      peerIp,
      peerPort,
      infoHash,
      peerId,
      blocks,
      expectedHash,
      outputPath,
    );

    console.log(`Piece ${pieceIndex} downloaded to ${outputPath}.`);
  } catch (error) {
    console.error(`Error downloading piece: ${(error as Error).message}`);
    throw error;
  }
};

/**
 * Downloads a piece from a specific peer using the BitTorrent protocol.
 */
async function downloadPieceFromPeer(
  hostname: string,
  port: number,
  infoHash: Buffer,
  peerId: Buffer,
  blocks: BlockInfo[],
  expectedHash: Buffer,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const handshakeMessage = encodeUTPHandshakeMessage(infoHash, peerId);

    // State machine
    let handshakeComplete = false;
    let bitfieldReceived = false;
    let unchoked = false;
    let requestsSent = false;

    // Block storage: map of begin offset -> block data
    const receivedBlocks = new Map<number, Buffer>();
    let messageBuffer = Buffer.alloc(0);

    // Timeout handling - 30 seconds should be enough
    const timeout = setTimeout(() => {
      reject(new Error('Download timed out after 30 seconds'));
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeout);
    };

    Bun.connect({
      hostname,
      port,
      socket: {
        open(socket) {
          // Send handshake
          socket.write(new Uint8Array(handshakeMessage));
        },

        data(socket, data) {
          try {
            const dataBuffer = data as Buffer;

            // Handle handshake response (first 68 bytes)
            if (!handshakeComplete) {
              if (dataBuffer.length >= 68) {
                handshakeComplete = true;
                // Process remaining data after handshake
                const remaining = dataBuffer.subarray(68);
                if (remaining.length > 0) {
                  messageBuffer = Buffer.concat([
                    messageBuffer,
                    remaining,
                  ] as unknown as Uint8Array[]);
                }
              } else {
                // Not enough data for handshake yet
                return;
              }
            } else {
              // Accumulate data into message buffer
              messageBuffer = Buffer.concat([
                messageBuffer,
                dataBuffer,
              ] as unknown as Uint8Array[]);
            }

            // Process all complete messages in buffer
            while (messageBuffer.length >= 4) {
              const messageLength = messageBuffer.readUInt32BE(0);
              const totalLength = 4 + messageLength;

              if (messageBuffer.length < totalLength) {
                break;
              }

              // Extract and parse message
              const messageData = messageBuffer.subarray(0, totalLength);
              const message = parsePeerMessage(messageData);

              // Handle different message types
              if (isBitfieldMessage(message)) {
                bitfieldReceived = true;
                // Send interested message
                const interestedMsg = encodeInterestedMessage();
                socket.write(new Uint8Array(interestedMsg));
              } else if (isUnchokeMessage(message)) {
                unchoked = true;
                // Send all block requests
                if (!requestsSent) {
                  for (const block of blocks) {
                    const requestMsg = encodeRequestMessage(
                      block.index,
                      block.begin,
                      block.length,
                    );
                    socket.write(new Uint8Array(requestMsg));
                  }
                  requestsSent = true;
                }
              } else if (isPieceMessage(message)) {
                const pieceMsg = parsePieceMessage(message.payload);
                receivedBlocks.set(pieceMsg.begin, pieceMsg.block);

                // Check if we have all blocks
                if (receivedBlocks.size === blocks.length) {
                  // Assemble piece from blocks in order
                  const pieceData = Buffer.concat(
                    blocks.map(
                      (block) => receivedBlocks.get(block.begin)!,
                    ) as unknown as Uint8Array[],
                  );

                  // Verify piece hash
                  if (!verifyPiece(pieceData, expectedHash)) {
                    console.error('Piece hash mismatch! Download corrupted.');
                    cleanup();
                    socket.end();
                    reject(new Error('Piece hash verification failed'));
                    return;
                  }

                  // Save to file
                  fs.writeFileSync(outputPath, new Uint8Array(pieceData));

                  console.log('Piece download complete and verified.');
                  cleanup();
                  socket.end();
                  resolve();
                  return;
                }
              }

              // Remove processed message from buffer
              messageBuffer = messageBuffer.subarray(totalLength);
            }
          } catch (error) {
            console.error(`Error processing data: ${(error as Error).message}`);
            cleanup();
            socket.end();
            reject(error);
          }
        },
        error(socket, error) {
          console.error(`Connection error: ${error}`);
          cleanup();
          reject(new Error(`Connection error: ${error}`));
        },
      },
    });
  });
}
