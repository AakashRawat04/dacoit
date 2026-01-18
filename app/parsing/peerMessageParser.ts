import { MESSAGE_ID } from '../constants';

/**
 * Represents a parsed peer message
 */
export interface PeerMessage {
  id: number;
  payload: Buffer;
}

/**
 * Represents a parsed piece message with structured data
 */
export interface PieceMessage {
  index: number; // Piece index
  begin: number; // Byte offset within the piece
  block: Buffer; // The actual data block
}

/**
 * Parses a peer message from a buffer.
 *
 * Message format:
 * - Length: 4 bytes (unsigned 32-bit integer) - length of message ID + payload
 * - Message ID: 1 byte
 * - Payload: variable length (length - 1 bytes)
 *
 * @param buffer - Buffer containing the complete message (including length prefix)
 * @returns Parsed peer message with id and payload
 * @throws Error if buffer is too small or malformed
 */
export const parsePeerMessage = (buffer: Buffer): PeerMessage => {
  if (buffer.length < 4) {
    throw new Error('Buffer too small to contain message length');
  }

  // Read message length (excludes the 4-byte length prefix itself)
  const messageLength = buffer.readUInt32BE(0);

  // Check if we have the complete message
  if (buffer.length < 4 + messageLength) {
    throw new Error(
      `Incomplete message: expected ${4 + messageLength} bytes, got ${buffer.length}`,
    );
  }

  // Handle keep-alive message (length = 0, no ID or payload)
  if (messageLength === 0) {
    return {
      id: -1, // Special ID for keep-alive
      payload: Buffer.alloc(0),
    };
  }

  // Read message ID
  const messageId = buffer.readUInt8(4);

  // Read payload (if any)
  const payload = buffer.subarray(5, 4 + messageLength);

  return {
    id: messageId,
    payload,
  };
};

/**
 * Parses a piece message payload into structured data.
 *
 * Piece message payload format:
 * - index: 4 bytes (unsigned 32-bit integer) - piece index
 * - begin: 4 bytes (unsigned 32-bit integer) - byte offset within piece
 * - block: remaining bytes - the actual data
 *
 * @param payload - The payload buffer from a piece message (id: 7)
 * @returns Parsed piece message with index, begin, and block data
 * @throws Error if payload is too small
 */
export const parsePieceMessage = (payload: Buffer): PieceMessage => {
  if (payload.length < 8) {
    throw new Error(
      'Piece message payload too small: must be at least 8 bytes',
    );
  }

  const index = payload.readUInt32BE(0);
  const begin = payload.readUInt32BE(4);
  const block = payload.subarray(8);

  return {
    index,
    begin,
    block,
  };
};

/**
 * Checks if a message is a bitfield message (id: 5).
 *
 * @param message - The parsed peer message
 * @returns true if the message is a bitfield message
 */
export const isBitfieldMessage = (message: PeerMessage): boolean => {
  return message.id === MESSAGE_ID.BITFIELD;
};

/**
 * Checks if a message is an unchoke message (id: 1).
 *
 * @param message - The parsed peer message
 * @returns true if the message is an unchoke message
 */
export const isUnchokeMessage = (message: PeerMessage): boolean => {
  return message.id === MESSAGE_ID.UNCHOKE;
};

/**
 * Checks if a message is a piece message (id: 7).
 *
 * @param message - The parsed peer message
 * @returns true if the message is a piece message
 */
export const isPieceMessage = (message: PeerMessage): boolean => {
  return message.id === MESSAGE_ID.PIECE;
};

/**
 * Gets the name of a message type for debugging.
 *
 * @param messageId - The message ID
 * @returns Human-readable message name
 */
export const getMessageName = (messageId: number): string => {
  const names: Record<number, string> = {
    [MESSAGE_ID.CHOKE]: 'choke',
    [MESSAGE_ID.UNCHOKE]: 'unchoke',
    [MESSAGE_ID.INTERESTED]: 'interested',
    [MESSAGE_ID.NOT_INTERESTED]: 'not interested',
    [MESSAGE_ID.HAVE]: 'have',
    [MESSAGE_ID.BITFIELD]: 'bitfield',
    [MESSAGE_ID.REQUEST]: 'request',
    [MESSAGE_ID.PIECE]: 'piece',
    [MESSAGE_ID.CANCEL]: 'cancel',
    '-1': 'keep-alive',
  };

  return names[messageId] || `unknown (${messageId})`;
};
