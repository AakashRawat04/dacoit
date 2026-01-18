# Dacoit

so i built a BitTorrent client from scratch and honestly it was way more interesting than i expected. turns out downloading files is just fancy socket programming with extra steps.

## what it does

- decodes bencoded data because apparently json was too mainstream for 2001
- parses .torrent files (they're just dictionaries with extra anxiety)
- talks to HTTP trackers to find peers who have the file
- does the BitTorrent handshake (basically a secret handshake but for computers)
- downloads individual pieces from peers
- downloads entire files by reusing the same TCP connection like a responsible developer
- verifies everything with SHA-1 hashes because trust issues

## System Architecture
<img width="700" height="925" alt="image" src="https://github.com/user-attachments/assets/d38229a3-e17a-4dd4-bd46-fe2b89264d0a" />

## Peer Protocol Handshake Sequence
<img width="713" height="1049" alt="image" src="https://github.com/user-attachments/assets/f655aad7-6f74-430e-b888-b0ebf3515d98" />

## Message Flow During Piece Download
<img width="713" height="1049" alt="image" src="https://github.com/user-attachments/assets/2c9664bd-0963-437c-82e9-dbc5b50ef107" />


## the tech stack

- Bun runtime (because life's too short for slow JavaScript)
- TypeScript (because any types are better than no types)
- Raw TCP sockets (no libraries, we're doing this the hard way)
- A concerning amount of Buffer manipulation

## how to use

make sure you have bun installed then:

```bash
# decode some bencode
./your_program.sh decode "d3:foo3:bar5:helloi52ee"

# check out a torrent file
./your_program.sh info sample.torrent

# see who has the file
./your_program.sh peers sample.torrent

# do a handshake with a peer (yes this is a real command)
./your_program.sh handshake sample.torrent <peer_ip>:<peer_port>

# download a specific piece
./your_program.sh download_piece -o /tmp/piece-0 sample.torrent 0

# download the whole file (the main event)
./your_program.sh download -o /tmp/complete.txt sample.torrent
```

## the architecture

```
app/
├── commands/          # CLI command handlers
├── encoding/          # turning data into bytes
├── parsing/           # turning bytes back into data
├── network/           # PeerConnection class (the star of the show)
└── main.ts           # where it all begins
```

the `PeerConnection` class does the heavy lifting. it maintains a persistent TCP connection and handles all the BitTorrent peer protocol stuff. connection reuse ftw.

## things i learned

- BitTorrent is surprisingly elegant for a 20+ year old protocol
- TCP socket programming is fun when you're not fighting with it
- "just one more piece" becomes "why is it 3am"
- promises and socket callbacks are frenemies
- verifying hashes feels like getting a participation trophy but for bytes

## what's next

version 2 will probably have:

- downloading from multiple peers simultaneously
- actually being a peer (uploading pieces)
- magnet links support
- DHT because centralized trackers are so 2008
- idk man... lets see

---

if this helps you understand BitTorrent or you just think it's neat, cool. if you find bugs, they're features actually.
