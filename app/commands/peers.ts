import { encodeBencode } from "../encoder";
import { parseBencode } from "../parser";
import { parseTorrentFile } from "../torrentFileParser";
import * as crypto from "crypto";
import { convertBuffersToStrings } from "../utils";

export const handlePeersCommand = async (filename: string) => {
  try {
    // Parse the torrent file
    const torrent = parseTorrentFile(filename);

    // Extract announce URL
    const announce = torrent.announce;
    const trackerUrl = announce.toString('utf-8');

    // Compute info hash (20 raw bytes)
    const encodedInfo = encodeBencode(torrent.info);
    const infoHash = crypto
      .createHash('sha1')
      .update(encodedInfo as unknown as crypto.BinaryLike)
      .digest('hex');
    console.log(`Info Hash: ${infoHash}`);
    // add % before each byte
    const infoHashPercentEncoded = Array.from(
      Buffer.from(infoHash, 'hex'),
    )
      .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
      .join('');
    console.log(`Info Hash (percent-encoded): ${infoHashPercentEncoded}`);

    // Peer ID: must be exactly 20 bytes
    const peerId = '00112233445566778899';

    // Build query string manually (URLSearchParams doesn't handle binary data well)
    const params = [
      `info_hash=${infoHashPercentEncoded}`,
      `peer_id=${peerId}`,
      `port=6881`,
      `uploaded=0`,
      `downloaded=0`,
      `left=${torrent.info.length}`, // Total file size
      `compact=1`,
    ].join('&');

    const fullUrl = `${trackerUrl}?${params}`;
    console.log(`Requesting tracker: ${fullUrl}`);

    // Make request to tracker
    const response = await fetch(fullUrl, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`Tracker request failed: ${response.status}`);
    }

    // Parse bencode response
    const responseBuffer = Buffer.from(await response.arrayBuffer());
    const [trackerResponse] = parseBencode(responseBuffer, 0);

    if (
      typeof trackerResponse !== 'object' ||
      Array.isArray(trackerResponse) ||
      Buffer.isBuffer(trackerResponse)
    ) {
      throw new Error('Invalid tracker response');
    }
    console.log('Tracker Response:', convertBuffersToStrings(trackerResponse));

    // Check for failure reason
    if (trackerResponse['failure reason']) {
      throw new Error(`Tracker error: ${trackerResponse['failure reason']}`);
    }

    // Extract peers (compact format: 6 bytes per peer)
    const peersValue = trackerResponse.peers;

    if (!peersValue) {
      // No peers available
      console.log('No peers currently available for this torrent');
    }

    if (!Buffer.isBuffer(peersValue)) {
      throw new Error('Invalid peers format: expected Buffer');
    }

    // Parse peers: each peer is 6 bytes (4 for IP, 2 for port)
    for (let i = 0; i < peersValue.length; i += 6) {
      const ip = Array.from(peersValue.subarray(i, i + 4)).join('.');
      const port = peersValue.readUInt16BE(i + 4);
      console.log(`${ip}:${port}`);
    }
  } catch (error) {
    console.error((error as Error).message);
  }
}