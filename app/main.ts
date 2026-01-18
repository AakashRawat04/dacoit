import { handleDecodeCommand } from './commands/decode';
import { handleDownloadPieceCommand } from './commands/downloadPiece';
import { handleHandshakeCommand } from './commands/handshake';
import { handleInfoCommand } from './commands/info';
import { handlePeersCommand } from './commands/peers';

const args = process.argv;
const command = args[2];

if (command === 'decode') {
  const bencodedValue = args[3];
  handleDecodeCommand(bencodedValue);
} else if (command === 'info') {
  const filename = args[3];
  handleInfoCommand(filename);
} else if (command === 'peers') {
  const filename = args[3];
  await handlePeersCommand(filename);
} else if (command === 'handshake') {
  const filename = args[3];
  const peerAddress = args[4];
  await handleHandshakeCommand(filename, peerAddress);
} else if (command === 'download_piece') {
  // Parse arguments: download_piece -o <output_path> <torrent_file> <piece_index>
  const outputFlagIndex = args.indexOf('-o');
  if (outputFlagIndex === -1 || !args[outputFlagIndex + 1]) {
    console.error(
      'Usage: download_piece -o <output_path> <torrent_file> <piece_index>',
    );
    process.exit(1);
  }

  const outputPath = args[outputFlagIndex + 1];
  const torrentFile = args[outputFlagIndex + 2];
  const pieceIndex = parseInt(args[outputFlagIndex + 3], 10);

  if (!torrentFile || isNaN(pieceIndex)) {
    console.error(
      'Usage: download_piece -o <output_path> <torrent_file> <piece_index>',
    );
    process.exit(1);
  }

  await handleDownloadPieceCommand(outputPath, torrentFile, pieceIndex);
} else {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}
