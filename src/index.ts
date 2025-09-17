import 'dotenv/config';
import logger from './lib/logger';
import createApp from './server/app';

const PORT = Number(process.env.PORT ?? 3001);

async function start() {
  try {
    const app = createApp();
    app.listen(PORT, () => {
      logger.info('AI Todo Chat server listening', { port: PORT });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

void start();
