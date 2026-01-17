export type BencodeValue = Buffer | number | BencodeDictionary | BencodeList;

export interface BencodeDictionary {
  [key: string]: BencodeValue;
}

export type BencodeList = BencodeValue[];

export interface TorrentFile {
  announce: Buffer;
  info: {
    length: number;
    name: Buffer;
    pieceLength: number;
    pieces: Buffer;
  };
}

export interface TrackerResponse {
  interval: number;
  peers: Buffer;
}
