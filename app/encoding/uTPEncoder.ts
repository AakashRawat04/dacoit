/**
 * Encodes a uTP handshake message according to the uTP protocol specification.
 * The handshake message consists of the following parts:
  - length of the protocol string (BitTorrent protocol) which is 19 (1 byte)
  - the string BitTorrent protocol (19 bytes)
  - eight reserved bytes, which are all set to zero (8 bytes)
  - sha1 infohash (20 bytes) (NOT the hexadecimal representation, which is 40 bytes long)
  - peer id (20 bytes) (generate 20 random byte values)

 * @param infoHash 
 * @param peerId 
 * @returns Buffer representing the uTP handshake message
 */
export const encodeUTPHandshakeMessage = (
  infoHash: Buffer,
  peerId: Buffer,
): Buffer => {
  if (infoHash.length !== 20) {
    throw new Error('Info hash must be 20 bytes long');
  }
  if (peerId.length !== 20) {
    throw new Error('Peer ID must be 20 bytes long');
  }

  const protocolString = Buffer.from('BitTorrent protocol', 'utf-8');
  const protocolStringLength = Buffer.from([protocolString.length]);
  const reservedBytes = Buffer.alloc(8, 0); // 8 reserved bytes set to zero

  return Buffer.concat([
    protocolStringLength,
    protocolString,
    reservedBytes,
    infoHash,
    peerId,
  ] as unknown as Uint8Array[]);
};