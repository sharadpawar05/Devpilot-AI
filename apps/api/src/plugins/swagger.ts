import type { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { getEnv, PACKAGE_VERSION } from '@/config';

export async function registerSwagger(app: FastifyInstance) {
  const env = getEnv();

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'DevPilot API',
        description: 'API for DevPilot platform',
        version: PACKAGE_VERSION,
      },
      servers: [
        {
          url: `http://localhost:${env.PORT}`,
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });
}
