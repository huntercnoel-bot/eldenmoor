# mpserver.py — Eldenmoor multiplayer server (pure Python standard library).
#
# One server, one port. It serves the game files (no-cache) over HTTP *and*
# handles a WebSocket connection on the same port for:
#   - accounts (register / login, passwords hashed with PBKDF2)
#   - presence (who is online)
#   - live positions (see other players move)        [used in stage 2]
#   - friends + direct messages                       [used in stage 3]
#
# Run:  py mpserver.py 8000

import asyncio, json, os, sys, hashlib, base64, struct, hmac, secrets

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = os.path.dirname(os.path.abspath(__file__))
ACCOUNTS_FILE = os.path.join(ROOT, 'accounts.json')
WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

# ---------------------------------------------------------------- accounts ---
def load_accounts():
    try:
        with open(ACCOUNTS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return {}

def save_accounts():
    try:
        with open(ACCOUNTS_FILE, 'w', encoding='utf-8') as f:
            json.dump(accounts, f, indent=2)
    except Exception as e:
        print('account save error:', e)

accounts = load_accounts()

def hash_pw(password, salt_hex):
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt_hex), 100000).hex()

def find_key(user):
    low = user.lower()
    for k in accounts:
        if k.lower() == low:
            return k
    return None

def register(user, password):
    user = (user or '').strip()
    if len(user) < 3 or len(user) > 16:
        return (False, 'Username must be 3-16 characters.')
    if not all(c.isalnum() or c in '_-' for c in user):
        return (False, 'Use letters, numbers, _ or - only.')
    if len(password or '') < 4:
        return (False, 'Password must be at least 4 characters.')
    if find_key(user):
        return (False, 'That name is already taken.')
    salt = secrets.token_hex(16)
    accounts[user] = {'salt': salt, 'hash': hash_pw(password, salt), 'friends': []}
    save_accounts()
    return (True, 'Account created — now log in!')

def verify(user, password):
    key = find_key(user or '')
    if not key:
        return None
    acc = accounts[key]
    if hmac.compare_digest(hash_pw(password or '', acc['salt']), acc['hash']):
        return key
    return None

# ------------------------------------------------------------- websockets ----
clients = {}  # username -> Client

class Client:
    def __init__(self, writer):
        self.writer = writer
        self.user = None
        self.x = 0.0
        self.z = 0.0
        self.ry = 0.0

def ws_accept(key):
    return base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()

def ws_frame(text):
    payload = text.encode('utf-8')
    n = len(payload)
    out = bytearray([0x81])  # FIN + text opcode
    if n < 126:
        out.append(n)
    elif n < 65536:
        out.append(126); out += struct.pack('>H', n)
    else:
        out.append(127); out += struct.pack('>Q', n)
    out += payload
    return bytes(out)

async def ws_read(reader):
    hdr = await reader.readexactly(2)
    b1, b2 = hdr[0], hdr[1]
    opcode = b1 & 0x0f
    masked = b2 & 0x80
    length = b2 & 0x7f
    if length == 126:
        length = struct.unpack('>H', await reader.readexactly(2))[0]
    elif length == 127:
        length = struct.unpack('>Q', await reader.readexactly(8))[0]
    mask = await reader.readexactly(4) if masked else b'\x00\x00\x00\x00'
    data = await reader.readexactly(length)
    if masked:
        data = bytes(data[i] ^ mask[i % 4] for i in range(length))
    if opcode == 0x8:    # close
        return None
    if opcode in (0x1, 0x2):
        return data.decode('utf-8', 'ignore')
    return ''            # ping / other: ignore

async def send(client, obj):
    try:
        client.writer.write(ws_frame(json.dumps(obj)))
        await client.writer.drain()
    except Exception:
        pass

async def broadcast(obj, exclude=None):
    for c in list(clients.values()):
        if c is not exclude:
            await send(c, obj)

async def send_friends(client):
    acc = accounts.get(client.user, {})
    fl = [{'user': f, 'online': (f in clients)} for f in acc.get('friends', [])]
    await send(client, {'t': 'friends', 'list': fl})

async def handle_message(client, msg):
    try:
        d = json.loads(msg)
    except Exception:
        return
    t = d.get('t')

    if t == 'register':
        ok, m = register(d.get('u', ''), d.get('p', ''))
        await send(client, {'t': 'registered', 'ok': ok, 'msg': m})

    elif t == 'login':
        user = verify(d.get('u', ''), d.get('p', ''))
        if not user:
            await send(client, {'t': 'logged_in', 'ok': False, 'msg': 'Wrong username or password.'})
            return
        if user in clients:
            await send(client, {'t': 'logged_in', 'ok': False, 'msg': 'That account is already logged in.'})
            return
        client.user = user
        clients[user] = client
        await send(client, {'t': 'logged_in', 'ok': True, 'user': user})
        others = [{'user': c.user, 'x': c.x, 'z': c.z, 'ry': c.ry} for c in clients.values() if c is not client]
        await send(client, {'t': 'players', 'list': others})
        await broadcast({'t': 'pjoin', 'user': user, 'x': client.x, 'z': client.z, 'ry': client.ry}, exclude=client)
        await send_friends(client)
        print('login:', user, '(online:', len(clients), ')')

    elif t == 'pos' and client.user:
        client.x = float(d.get('x', 0)); client.z = float(d.get('z', 0)); client.ry = float(d.get('ry', 0))
        await broadcast({'t': 'ppos', 'user': client.user, 'x': client.x, 'z': client.z, 'ry': client.ry}, exclude=client)

    elif t == 'chat' and client.user:
        to = find_key(d.get('to', '') or '')
        text = str(d.get('text', ''))[:200]
        tgt = clients.get(to) if to else None
        if tgt:
            await send(tgt, {'t': 'chat', 'from': client.user, 'text': text})
            await send(client, {'t': 'chat', 'from': client.user, 'to': to, 'text': text, 'self': True})
        else:
            await send(client, {'t': 'sys', 'msg': (d.get('to') or '?') + ' is not online.'})

    elif t == 'say' and client.user:
        text = str(d.get('text', ''))[:200].strip()
        if text:
            await broadcast({'t': 'say', 'from': client.user, 'text': text})

    elif t == 'friend_add' and client.user:
        key = find_key(d.get('u', '') or '')
        if not key:
            await send(client, {'t': 'sys', 'msg': 'No player by that name.'}); return
        acc = accounts[client.user]
        if key != client.user and key not in acc['friends']:
            acc['friends'].append(key); save_accounts()
        await send_friends(client)

    elif t == 'friend_remove' and client.user:
        key = find_key(d.get('u', '') or '')
        acc = accounts[client.user]
        if key and key in acc['friends']:
            acc['friends'].remove(key); save_accounts()
        await send_friends(client)

    elif t == 'friend_list' and client.user:
        await send_friends(client)

# ------------------------------------------------------- static file serve ---
def guess_type(fp):
    if fp.endswith('.html'): return 'text/html; charset=utf-8'
    if fp.endswith('.js'):   return 'text/javascript; charset=utf-8'
    if fp.endswith('.css'):  return 'text/css; charset=utf-8'
    if fp.endswith('.json'): return 'application/json'
    if fp.endswith('.svg'):  return 'image/svg+xml'
    return 'application/octet-stream'

async def serve_file(writer, path):
    path = path.split('?', 1)[0]
    if path in ('/', ''):
        path = '/index.html'
    fp = os.path.normpath(os.path.join(ROOT, path.lstrip('/')))
    if not fp.startswith(ROOT) or not os.path.isfile(fp):
        body = b'Not found'
        writer.write(b'HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n' + body)
    else:
        with open(fp, 'rb') as f:
            body = f.read()
        head = ('HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %d\r\n'
                'Cache-Control: no-store, no-cache, must-revalidate, max-age=0\r\n'
                'Connection: close\r\n\r\n' % (guess_type(fp), len(body)))
        writer.write(head.encode('latin1') + body)
    try:
        await writer.drain()
    except Exception:
        pass

# ------------------------------------------------------------- connections ---
async def handle_conn(reader, writer):
    try:
        request_line = await reader.readline()
        if not request_line:
            writer.close(); return
        parts = request_line.decode('latin1', 'ignore').split()
        path = parts[1] if len(parts) >= 2 else '/'
        headers = {}
        while True:
            line = await reader.readline()
            if line in (b'\r\n', b'\n', b''):
                break
            if b':' in line:
                k, v = line.decode('latin1', 'ignore').split(':', 1)
                headers[k.strip().lower()] = v.strip()

        if headers.get('upgrade', '').lower() == 'websocket':
            key = headers.get('sec-websocket-key', '')
            resp = ('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\n'
                    'Connection: Upgrade\r\nSec-WebSocket-Accept: ' + ws_accept(key) + '\r\n\r\n')
            writer.write(resp.encode('latin1'))
            await writer.drain()
            client = Client(writer)
            try:
                while True:
                    m = await ws_read(reader)
                    if m is None:
                        break
                    if m:
                        await handle_message(client, m)
            except (asyncio.IncompleteReadError, ConnectionError, OSError):
                pass
            finally:
                if client.user and clients.get(client.user) is client:
                    del clients[client.user]
                    await broadcast({'t': 'pleave', 'user': client.user})
                    print('logout:', client.user, '(online:', len(clients), ')')
                try: writer.close()
                except Exception: pass
        else:
            await serve_file(writer, path)
            try: writer.close()
            except Exception: pass
    except Exception:
        try: writer.close()
        except Exception: pass

async def main():
    server = await asyncio.start_server(handle_conn, '', PORT)
    print('Eldenmoor multiplayer server running on http://localhost:%d  (files + ws on same port)' % PORT)
    async with server:
        await server.serve_forever()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
