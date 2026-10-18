import 'dotenv/config';
import Fastify from 'fastify';
import { loadEnv } from '@/config';
import { buildServerOptions } from '@/core/http/server-options';
import { registerPlugins } from '@/plugins';
import { apiV1Routes } from '@/routes';

const env = loadEnv();

const app = Fastify(buildServerOptions(env));

async function bootstrap() {
  await registerPlugins(app);

  await app.register(
    async (v1) => {
      await v1.register(apiV1Routes);
    },
    { prefix: env.API_PREFIX },
  );

  const shutdown = async () => {
    app.log.info('Shutting down gracefully...');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Server running on http://${env.HOST}:${env.PORT}`);
    app.log.info(`API docs available at http://localhost:${env.PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

bootstrap();
