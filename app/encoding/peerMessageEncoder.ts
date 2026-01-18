import { MESSAGE_ID } from '../constants';

/**
 * Encodes an "interested" message to send to a peer.
 *
 * Message format:
 * - Length: 1 (4 bytes) - only contains message ID, no payload
 * - Message ID: 2 (1 byte)
 * - Payload: (empty)
 *
 * Total: 5 bytes [0, 0, 0, 1, 2]
 *
 * @returns Buffer containing the interested message
 */
export const encodeInterestedMessage = (): Buffer => {
  const buffer = Buffer.alloc(5);
  let offset = 0;

  // Write length (1 byte for message ID only)
  buffer.writeUInt32BE(1, offset);
  offset += 4;

  // Write message ID (interested = 2)
  buffer.writeUInt8(MESSAGE_ID.INTERESTED, offset);

  return buffer;
};

/**
 * Encodes a "request" message to request a block from a peer.
 *
 * Message format:
 * - Length: 13 (4 bytes) - 1 byte ID + 12 bytes payload
 * - Message ID: 6 (1 byte)
 * - Payload:
 *   - index: piece index (4 bytes, unsigned 32-bit integer)
 *   - begin: byte offset within the piece (4 bytes, unsigned 32-bit integer)
 *   - length: block length in bytes (4 bytes, unsigned 32-bit integer)
 *
 * Total: 17 bytes
 *
 * @param index - The zero-based piece index
 * @param begin - The zero-based byte offset within the piece
 * @param length - The length of the block in bytes (typically 16384)
 * @returns Buffer containing the request message
 */
export const encodeRequestMessage = (
  index: number,
  begin: number,
  length: number,
): Buffer => {
  const buffer = Buffer.alloc(17);
  let offset = 0;

  // Write length (1 ID + 12 payload = 13 bytes)
  buffer.writeUInt32BE(13, offset);
  offset += 4;

  // Write message ID (request = 6)
  buffer.writeUInt8(MESSAGE_ID.REQUEST, offset);
  offset += 1;

  // Write payload
  buffer.writeUInt32BE(index, offset); // piece index
  offset += 4;

  buffer.writeUInt32BE(begin, offset); // byte offset
  offset += 4;

  buffer.writeUInt32BE(length, offset); // block length

  return buffer;
};
