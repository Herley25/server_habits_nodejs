// Back-end API Restfull
import Fastify from 'fastify';

import cors from '@fastify/cors';

import {
    prisma,
} from './lib/prisma';
import {
    appRoutes,
} from './routes';

const app = Fastify();

/**
 * Permissão ao meu Front-end acessar o Back-end
 * é permitido outros parâmetros para validar quem realmente irá acessar as informações
 * é necessário em termos de segurança
 */
app.register(cors);

app.register(appRoutes);

app
  .listen({
    port: 3333,
  })
  .then(() => {
    console.log("HTTP Server running!");
  });
