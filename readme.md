# Websocket Gateway

A gateway experiment started in 2021–2022, with Redis-backed fan-out,
configurable namespaces, and Node/PM2 clustering. The September 2026 maintenance
update runs on Socket.IO 4 and the maintained Redis adapter. It remains an
example, not a production gateway recommendation or a throughput claim.

## Reproduce the example

Use Node.js 22.12+ and a local Redis server. CI tests Node 22 and 24 with Redis 7.

```sh
npm ci --ignore-scripts
cp settings.json.template settings.json
# In another terminal, start Redis; keep it bound to loopback.
redis-server --bind 127.0.0.1 --save '' --appendonly no
# Start a single gateway process:
npm start
```

The supplied settings load `tests/components/test.js` at namespace `/test`.
The component echoes `message` to its sender and broadcasts `broadCastMessage`
through the namespace. Set the component path and exported initializer in
`settings.json` for another application.

In a second terminal:

```sh
curl --fail http://localhost:3000/healthcheck
npm test
```

Tests await health, one/multiple-client echo, fan-out, staggered connections and
reconnect. `USERS=10` is the default correctness check; larger counts are an
explicit stress experiment, not the CI baseline. Connection/assertion failures
now reject the test instead of escaping an unreturned promise.

## Configuration and start modes

The committed `.env` contains local example values; environment variables override
them. `PORT` is the HTTP/Socket.IO port, `REDIS_URL` is a hostname (not a URL), and
`REDIS_PORT` is the Redis port.

| Command | Behavior |
| --- | --- |
| `npm start` | One process using `server/index.pm2.cluster.js`; PM2 is not started. |
| `npm run start:cluster` | Node cluster/sticky sessions when `CLUSTER=true`; uses `INSTANCES` and `LOADBALANCING_METHOD`. |
| `npm run start:pm2` | PM2 runs the config in `scripts/pm2.config.js` (four instances by default). Stop it with `npx pm2 delete WS`. |
| `npm test` | Runs Mocha against the already-running server/Redis. |
| `npm run test:redis` | Starts two gateways and a two-worker Node cluster against the configured Redis; checks cross-process fan-out, polling/binary echo and failed startup. Requires `settings.json` and a POSIX host. |
| `npm run lint` | Checks JavaScript with StandardJS; does not modify files. |
| `npm run lint:fix` | Applies StandardJS formatting fixes. |

Example overrides for a separate local Redis/gateway pair:

```sh
PORT=3100 REDIS_URL=127.0.0.1 REDIS_PORT=6380 npm start
PORT=3100 SOCKET_URL=http://127.0.0.1 npm test
```

## Verification and limits

CI starts Redis 7 and checks the single-process example, fan-out between two
independent gateway processes, two-worker sticky polling sessions, binary echo,
startup failure without Redis, and the four-process PM2 example on Node 22 and 24.
Cross-machine networking and the Docker assets in `scripts/` are not covered.
The Docker files are historical experiments and have not been validated as a
deployment path in this maintenance pass. There is no authentication, durable
message replay or delivery guarantee. Keep Redis on a trusted private network.

## Dependency update notes

Socket.IO 3 and the retired `socket.io-redis` package were replaced with Socket.IO
4.8 and `@socket.io/redis-adapter` 8.3. The adapter now receives explicitly managed
ioredis 5 clients; startup waits for both connections and fails if Redis cannot
be reached. The namespace component initializer and existing event names stay
the same. Socket.IO 3 clients use the same wire protocol, but custom server
components should review the [Socket.IO 4 API changes](https://socket.io/docs/v4/migrating-from-3-x-to-4-0/),
particularly immutable broadcast modifiers. See the [Redis adapter migration](https://socket.io/docs/v4/redis-adapter/#migrating-from-socketio-redis).

Unused `socket.io-emitter` and Markdown lint dependencies were removed. Tests use
Node's `fetch` and assertions instead of Axios and Chai; the Socket.IO client is
now a development dependency. Ajv, dotenv-flow, log4js, Mocha, PM2 and StandardJS
were updated and the lockfile refreshed.

PM2 7.0.4 pins js-yaml 4.3.1, which is affected by
[GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh).
A PM2-scoped override selects the compatible 4.3.2 patch. Remove that override
when PM2 includes a patched version itself. On September 17, 2026, `npm audit`
reported **0 vulnerabilities**, down from 31 in the previous lockfile. This is an
audit of reported package advisories, not a security review of the application.

The original MIT [license](LICENSE) is unchanged.
