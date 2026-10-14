import { createServer } from 'node:http';

import { createExpressDemoApp } from './express-demo/express-demo.app';

function getPort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 3001;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('EXPRESS_PORT must be an integer between 1 and 65535.');
  }
  return port;
}

const port = getPort(process.env.EXPRESS_PORT);
const server = createServer(createExpressDemoApp());

server.listen(port, () => {
  console.info(`Express demo listening on port ${port}.`);
});

server.on('error', (error: NodeJS.ErrnoException) => {
  console.error(`Express demo failed to start (${error.code ?? error.name}).`);
  process.exitCode = 1;
});
