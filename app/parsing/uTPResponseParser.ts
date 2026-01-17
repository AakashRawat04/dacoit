import { INFO_HASH_LENGTH, PEER_ID_LENGTH, PROTOCOL_STRING_LENGTH, RESERVED_BYTES_LENGTH } from "../constants";

/**
 * Parses a uTP response message according to the uTP protocol specification.
 * The response message consists of the following parts:
 * - length of the protocol string (BitTorrent protocol) which is 19 (1 byte)
  - the string BitTorrent protocol (19 bytes)
  - eight reserved bytes, which are all set to zero (8 bytes)
  - sha1 infohash (20 bytes) (NOT the hexadecimal representation, which is 40 bytes long)
  - peer id (20 bytes) (generate 20 random byte values)
 * @param buffer 
 * @returns Object containing infoHash and peerId as Buffers
 */
export const parseUTPResponseMessage = (buffer: Buffer): {
  infoHash: Buffer;
  peerId: Buffer;
} => {

  const expectedLength =
    1 +
    PROTOCOL_STRING_LENGTH +
    RESERVED_BYTES_LENGTH +
    INFO_HASH_LENGTH +
    PEER_ID_LENGTH;

  if (buffer.length < expectedLength) {
    throw new Error(
      `Invalid uTP response message: expected at least ${expectedLength} bytes, got ${buffer.length}`,
    );
  }

  const protocolStringLength = buffer.readUInt8(0);
  if (protocolStringLength !== PROTOCOL_STRING_LENGTH) {
    throw new Error(
      `Invalid protocol string length: expected ${PROTOCOL_STRING_LENGTH}, got ${protocolStringLength}`,
    );
  }

  const infoHashStart =
    1 + PROTOCOL_STRING_LENGTH + RESERVED_BYTES_LENGTH;
  const infoHashEnd = infoHashStart + INFO_HASH_LENGTH;
  const peerIdStart = infoHashEnd;
  const peerIdEnd = peerIdStart + PEER_ID_LENGTH;

  const infoHash = buffer.subarray(infoHashStart, infoHashEnd);
  const peerId = buffer.subarray(peerIdStart, peerIdEnd);

  return {
    infoHash,
    peerId,
  };
};