import Fastify from 'fastify';
import path from 'path';
import view from '@fastify/view';
import ejs from 'ejs';
import staticPlugin from '@fastify/static';
import webRoutes from './routes/web.js';
import { fileURLToPath } from 'url';

const app = Fastify({ logger: true });

// static files (css/js)
await app.register(staticPlugin, {
  root: fileURLToPath(new URL('../public/statics', import.meta.url)),
  prefix: '/public/statics/',
});

// EJS views
await app.register(view, {
  engine: { ejs },
  root: fileURLToPath(new URL('../public/views', import.meta.url)),
  layout: 'layouts/main.ejs'
});

// routes
await app.register(webRoutes);

app.listen({ port: 3000, host: '0.0.0.0' });
