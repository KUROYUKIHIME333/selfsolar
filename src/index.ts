import Fastify from 'fastify';
import view from '@fastify/view';
import ejs from 'ejs';
import staticPlugin from '@fastify/static';
import formbody from '@fastify/formbody';
import webRoutes from './routes/web.route.js';
import apiRoutes from './routes/api.route.js';
import { fileURLToPath } from 'url';

const app = Fastify({ logger: true });

// parse application/x-www-form-urlencoded (formulaires HTML)
await app.register(formbody);

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
await app.register(apiRoutes);

app.listen({ port: 3000, host: '0.0.0.0' });
