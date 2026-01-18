// Constants for BitTorrent protocol
export const PEER_ID_LENGTH = 20;
export const TRACKER_PORT = 6881;
export const BYTES_PER_PEER = 6;
export const SHA1_HASH_LENGTH = 20;
export const PEER_ID_PREFIX = '-TS0001-';

// Constants for uTP protocol
export const PROTOCOL_STRING_LENGTH = 19;
export const RESERVED_BYTES_LENGTH = 8;
export const INFO_HASH_LENGTH = 20;

// Peer Message IDs
export const MESSAGE_ID = {
  CHOKE: 0,
  UNCHOKE: 1,
  INTERESTED: 2,
  NOT_INTERESTED: 3,
  HAVE: 4,
  BITFIELD: 5,
  REQUEST: 6,
  PIECE: 7,
  CANCEL: 8,
} as const;

// Block and Piece constants
export const BLOCK_SIZE = 16384; // 16 KB (2^14 bytes) - standard block size
export const MESSAGE_LENGTH_PREFIX_SIZE = 4; // 4 bytes for message length prefix
export const MESSAGE_ID_SIZE = 1; // 1 byte for message ID
