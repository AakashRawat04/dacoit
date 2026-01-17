import * as crypto from 'crypto';
import fs from 'fs';
import { encodeUTPHandshakeMessage } from '../encoding/uTPEncoder';
import { parseUTPResponseMessage } from '../parsing/uTPResponseParser';
import { extractRawInfoDict, generatePeerId } from '../utils';

export const handleHandshakeCommand = async (
  filename: string,
  peerAddress: string,
) => {
  // info hash
  const fileBuffer = fs.readFileSync(filename);
  const rawInfoDict = extractRawInfoDict(fileBuffer);
  const infoHash = crypto
    .createHash('sha1')
    .update(rawInfoDict as unknown as crypto.BinaryLike)
    .digest();

  // generate a random peer id
  const peerId = generatePeerId();

  // construct handshake message
  const handshakeMessage = encodeUTPHandshakeMessage(infoHash, peerId);

  // establish a TCP connection to the peer
  await Bun.connect({
    hostname: peerAddress.split(':')[0],
    port: parseInt(peerAddress.split(':')[1], 10),
    socket: {
      open(socket) {
        // send handshake message
        socket.write(new Uint8Array(handshakeMessage));
      },
      data(socket, data) {
        // parse the received handshake message
        const parsedMessageResponse = parseUTPResponseMessage(data);
        console.log(`Peer ID: ${parsedMessageResponse.peerId.toString('hex')}`);
        socket.end();
      },
      error(error) {
        console.error(`Connection error: ${error}`);
      },
    },
  });
};
