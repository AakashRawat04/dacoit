import { handleDecodeCommand } from './commands/decode';
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
}
