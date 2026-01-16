import { parseBencode } from '../parsing/bencodeParser';
import { convertBuffersToStrings } from '../utils';

export const handleDecodeCommand = (bencodedValue: string): void => {
  try {
    const decoded = parseBencode(Buffer.from(bencodedValue))[0];
    // Convert Buffers to strings for JSON output
    console.log(JSON.stringify(convertBuffersToStrings(decoded)));
  } catch (error) {
    console.error((error as Error).message);
  }
};
