import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { getEnv } from '@/config';

export async function registerCors(app: FastifyInstance) {
  const env = getEnv();

  await app.register(cors, {
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}
