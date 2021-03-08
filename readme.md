[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)

# Websocket Gateway

Simple websocket Gateway (scaleup ready) base on [socket.io](https://socket.io/).

## How to use

1. Copy a new of `settings.json.template` file rename it `settings.json`
2. address your component file that wants to use websocket (get help from the test file; `./tests/components/test.js`)
3. Run the server by hitting `npm start` (same as `npm run start:cluster`) OR:
4. If you run `npm start`, the NodeJs will loadbalancing the request base on `INSTANCES` you have in `./env`.
5. Otherwise if you wanna more instances even more than system threads, you can run `npm run start:pm2` Which provides balancing requests from PM2 and you have more control over each sample.

## .env

```bash
PORT=3000       # server port
HOST=localhost  # server host address

REDIS_URL=localhost # redis host address
REDIS_PORT=6379     # redis port

# String: enum["random", "round-robin","least-connection"]
LOADBALANCING_METHOD=round-robin
CLUSTER=true
INSTANCES=3   # The number of instances you wanna load balancing request with
```

## SCRIPTS

```bash
 $ npm run test          # mocha tests/client.test.js
 $ npm run lint          # standard --fix --verbose | snazzy
 $ npm run start         # node server/index.pm2.cluster.js
 $ npm run start:cluster # node server/index.node.cluster.js
 $ npm run start:pm2     # pm2 start ./scripts/pm2.config.js
```

### TO-DD

- [ ] docker
- [ ] document
- [ ] more tests
  - [ ] ping pong (ping latancy)
