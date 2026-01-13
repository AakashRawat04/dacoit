export type BencodeValue = string | Buffer | number | BencodeDictionary | BencodeList;

export interface BencodeDictionary {
  [key: string]: BencodeValue;
}

export type BencodeList = BencodeValue[];