import { handleDecodeCommand } from './commands/decode';
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
}
