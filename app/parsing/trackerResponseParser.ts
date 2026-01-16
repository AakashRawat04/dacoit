import type { BencodeValue, TrackerResponse } from '../types';

export const parseTrackerResponse = (
  trackerResponse: BencodeValue,
): TrackerResponse => {
  if (
    typeof trackerResponse !== 'object' ||
    Array.isArray(trackerResponse) ||
    Buffer.isBuffer(trackerResponse)
  ) {
    throw new Error('Invalid tracker response');
  }

  // Check for failure reason
  if (trackerResponse['failure reason']) {
    throw new Error(`Tracker error: ${trackerResponse['failure reason']}`);
  }

  if (typeof trackerResponse['interval'] !== 'number') {
    throw new Error('Invalid or missing interval in tracker response');
  }

  if (!Buffer.isBuffer(trackerResponse['peers'])) {
    throw new Error('Invalid or missing peers in tracker response');
  }

  return {
    interval: trackerResponse.interval,
    peers: trackerResponse.peers,
  };
};
