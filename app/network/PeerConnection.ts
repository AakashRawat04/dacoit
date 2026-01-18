import {
  encodeInterestedMessage,
  encodeRequestMessage,
} from '../encoding/peerMessageEncoder';
import { encodeUTPHandshakeMessage } from '../encoding/uTPEncoder';
import {
  isBitfieldMessage,
  isPieceMessage,
  isUnchokeMessage,
  parsePeerMessage,
  parsePieceMessage,
} from '../parsing/peerMessageParser';
import { verifyPiece, type BlockInfo } from '../utils';

/**
 * Manages a persistent connection to a BitTorrent peer.
 * Handles handshake, message exchange, and downloading multiple pieces
 * through the same connection.
 */
export class PeerConnection {
  private socket: any = null;
  private hostname: string;
  private port: number;
  private infoHash: Buffer;
  private peerId: Buffer;

  // Connection state
  private handshakeComplete = false;
  private bitfieldReceived = false;
  private unchoked = false;

  // Message buffer for TCP stream
  private messageBuffer = Buffer.alloc(0);

  // Track if connection is ready
  private isConnected = false;
  private isReady = false;

  // Promise resolvers for async operations
  private readyResolver?: () => void;
  private readyRejecter?: (error: Error) => void;

  // Current piece download state
  private currentPieceResolver?: (data: Buffer) => void;
  private currentPieceRejecter?: (error: Error) => void;
  private receivedBlocks = new Map<number, Buffer>();
  private expectedBlocks: BlockInfo[] = [];
  private requestsSent = false;

  constructor(
    hostname: string,
    port: number,
    infoHash: Buffer,
    peerId: Buffer,
  ) {
    this.hostname = hostname;
    this.port = port;
    this.infoHash = infoHash;
    this.peerId = peerId;
  }

  /**
   * Establishes connection to the peer and completes the handshake sequence.
   * Returns when the connection is ready to download pieces (after unchoke).
   */
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.readyResolver = resolve;
      this.readyRejecter = reject;

      const handshakeMessage = encodeUTPHandshakeMessage(
        this.infoHash,
        this.peerId,
      );

      Bun.connect({
        hostname: this.hostname,
        port: this.port,
        socket: {
          open: (socket) => {
            this.socket = socket; // Store the socket for later use
            this.isConnected = true;
            // Send handshake
            socket.write(new Uint8Array(handshakeMessage));
          },

          data: (socket, data) => {
            try {
              this.handleData(data as Buffer);
            } catch (error) {
              this.handleError(error as Error);
            }
          },

          error: (socket, error) => {
            this.handleError(new Error(`Connection error: ${error}`));
          },

          close: () => {
            this.isConnected = false;
            if (!this.isReady && this.readyRejecter) {
              this.readyRejecter(new Error('Connection closed unexpectedly'));
            }
            if (this.currentPieceRejecter) {
              this.currentPieceRejecter(
                new Error('Connection closed during download'),
              );
            }
          },
        },
      });
    });
  }

  /**
   * Downloads a single piece through the established connection.
   * @param blocks - Array of block information for the piece
   * @param expectedHash - Expected SHA-1 hash of the piece for verification
   * @returns The downloaded and verified piece data
   */
  async downloadPiece(
    blocks: BlockInfo[],
    expectedHash: Buffer,
  ): Promise<Buffer> {
    if (!this.isReady) {
      throw new Error('Connection not ready. Call connect() first.');
    }

    return new Promise((resolve, reject) => {
      // Set up state for this piece download
      this.currentPieceResolver = resolve;
      this.currentPieceRejecter = reject;
      this.expectedBlocks = blocks;
      this.receivedBlocks.clear();
      this.requestsSent = false;

      // Send request messages for all blocks
      for (const block of blocks) {
        const requestMsg = encodeRequestMessage(
          block.index,
          block.begin,
          block.length,
        );
        this.socket.write(new Uint8Array(requestMsg));
      }
      this.requestsSent = true;

      // Store expected hash for verification
      (this as any).currentExpectedHash = expectedHash;
    });
  }

  /**
   * Closes the connection to the peer.
   */
  close(): void {
    if (this.socket) {
      this.socket.end();
      this.isConnected = false;
      this.isReady = false;
    }
  }

  /**
   * Handles incoming data from the peer.
   */
  private handleData(dataBuffer: Buffer): void {
    // Handle handshake response (first 68 bytes)
    if (!this.handshakeComplete) {
      if (dataBuffer.length >= 68) {
        this.handshakeComplete = true;
        // Process remaining data after handshake
        const remaining = dataBuffer.subarray(68);
        if (remaining.length > 0) {
          this.messageBuffer = Buffer.concat([
            this.messageBuffer,
            remaining,
          ] as unknown as Uint8Array[]);
        }
      } else {
        // Not enough data for handshake yet
        return;
      }
    } else {
      // Accumulate data into message buffer
      this.messageBuffer = Buffer.concat([
        this.messageBuffer,
        dataBuffer,
      ] as unknown as Uint8Array[]);
    }

    // Process all complete messages in buffer
    this.processMessages();
  }

  /**
   * Processes complete messages from the message buffer.
   */
  private processMessages(): void {
    while (this.messageBuffer.length >= 4) {
      const messageLength = this.messageBuffer.readUInt32BE(0);
      const totalLength = 4 + messageLength;

      if (this.messageBuffer.length < totalLength) {
        // Wait for more data
        break;
      }

      // Extract and parse message
      const messageData = this.messageBuffer.subarray(0, totalLength);
      const message = parsePeerMessage(messageData);

      // Handle different message types
      if (isBitfieldMessage(message)) {
        this.bitfieldReceived = true;
        // Send interested message
        const interestedMsg = encodeInterestedMessage();
        this.socket.write(new Uint8Array(interestedMsg));
      } else if (isUnchokeMessage(message)) {
        this.unchoked = true;
        // Connection is now ready to download
        if (!this.isReady) {
          this.isReady = true;
          if (this.readyResolver) {
            this.readyResolver();
          }
        }
      } else if (isPieceMessage(message)) {
        this.handlePieceMessage(message.payload);
      }

      // Remove processed message from buffer
      this.messageBuffer = this.messageBuffer.subarray(totalLength);
    }
  }

  /**
   * Handles a piece message containing block data.
   */
  private handlePieceMessage(payload: Buffer): void {
    const pieceMsg = parsePieceMessage(payload);
    this.receivedBlocks.set(pieceMsg.begin, pieceMsg.block);

    // Check if we have all blocks for the current piece
    if (this.receivedBlocks.size === this.expectedBlocks.length) {
      // Assemble piece from blocks in order
      const pieceData = Buffer.concat(
        this.expectedBlocks.map(
          (block) => this.receivedBlocks.get(block.begin)!,
        ) as unknown as Uint8Array[],
      );

      // Verify piece hash
      const expectedHash = (this as any).currentExpectedHash;
      if (!verifyPiece(pieceData, expectedHash)) {
        if (this.currentPieceRejecter) {
          this.currentPieceRejecter(
            new Error('Piece hash verification failed'),
          );
        }
        return;
      }

      // Piece downloaded and verified successfully
      if (this.currentPieceResolver) {
        this.currentPieceResolver(pieceData);
        this.currentPieceResolver = undefined;
        this.currentPieceRejecter = undefined;
      }
    }
  }

  /**
   * Handles errors during connection or download.
   */
  private handleError(error: Error): void {
    if (this.readyRejecter && !this.isReady) {
      this.readyRejecter(error);
    }
    if (this.currentPieceRejecter) {
      this.currentPieceRejecter(error);
    }
    this.close();
  }

  /**
   * Returns whether the connection is active.
   */
  isActive(): boolean {
    return this.isConnected && this.isReady;
  }
}
