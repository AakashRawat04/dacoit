import * as crypto from 'crypto';
import * as fs from 'fs';
import { parseBencode } from '../parsing/bencodeParser';
import { parseTorrentFile } from '../parsing/torrentFileParser';
import { convertBuffersToStrings, extractRawInfoDict } from '../utils';
import { parseTrackerResponse } from '../parsing/trackerResponseParser';

export const handlePeersCommand = async (filename: string) => {
  try {
    // Parse the torrent file
    const torrent = parseTorrentFile(filename);

    // Extract announce URL
    const announce = torrent.announce;
    const trackerUrl = announce.toString('utf-8');

    // Calculate info hash from the ORIGINAL bytes in the file
    // We can't re-encode because bencode encoding isn't guaranteed to be byte-identical
    const fileBuffer = fs.readFileSync(filename);
    const rawInfoDict = extractRawInfoDict(fileBuffer);
    const infoHash = crypto
      .createHash('sha1')
      .update(rawInfoDict as unknown as crypto.BinaryLike)
      .digest();

    // Percent-encode the raw hash bytes for URL
    const infoHashPercentEncoded = Array.from(infoHash)
      .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
      .join('');

    // Peer ID: must be exactly 20 bytes (use random to avoid collisions)
    const peerId = Array.from({ length: 20 }, () =>
      Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, '0'),
    )
      .join('')
      .substring(0, 20);

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

    // Make request to tracker
    const response = await fetch(fullUrl, { method: 'GET' });

    if (!response.ok) {
      throw new Error(`Tracker request failed: ${response.status}`);
    }

    // Parse bencode response
    const responseBuffer = Buffer.from(await response.arrayBuffer());
    const [trackerResponse] = parseBencode(responseBuffer, 0);
    const parsedTrackerResponse = parseTrackerResponse(trackerResponse);

    // Extract peers (compact format: 6 bytes per peer)
    const peersValue = parsedTrackerResponse.peers;

    if (!peersValue) {
      // No peers available
      console.log('No peers currently available for this torrent');
      return; // Exit early
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
};
