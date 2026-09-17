# Websocket Gateway

A 2021–2022 Socket.IO 3 experiment with Redis-backed fan-out, configurable
namespaces, and Node/PM2 clustering. This repository preserves that architecture;
it is not a current production gateway recommendation or a throughput claim.

## Reproduce the example

Use Node.js 22+ and a local Redis server. The September 2026 maintenance pass
restores the missing Mocha and PM2 dependencies and adds a bounded integration
suite; it does not upgrade the historical Socket.IO/Redis adapters.

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
| `npm run lint` | Existing StandardJS formatter/linter; it modifies files. |

Example overrides for a separate local Redis/gateway pair:

```sh
PORT=3100 REDIS_URL=127.0.0.1 REDIS_PORT=6380 npm start
PORT=3100 SOCKET_URL=http://127.0.0.1 npm test
```

## Verification and limits

CI starts Redis 7 and the single-process example before running the integration
suite on Node 22. PM2, multi-host fan-out, sticky-session behavior and the Docker
assets in `scripts/` are not covered by that check. The Docker files are historical
experiments and have not been validated as a deployment path in this maintenance
pass. There is no authentication, durable message replay or delivery guarantee.

The original MIT [license](LICENSE) is unchanged.
