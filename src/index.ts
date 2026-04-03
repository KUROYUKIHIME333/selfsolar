import Fastify from 'fastify'
import path from 'path'
import view from '@fastify/view'
import ejs from 'ejs'
import staticPlugin from '@fastify/static'
import webRoutes from './routes/web.js'

const app = Fastify({ logger: true })

// static files (css/js)
app.register(staticPlugin, {
  root: path.join(__dirname, '../public/statics'),
  prefix: '/public/statics/',
})

// EJS views
app.register(view, {
  engine: { ejs },
  root: path.join(__dirname, '../public/views'),
  layout: 'layouts/main.ejs'
})

// routes
app.register(webRoutes)

app.listen({ port: 3000, host: '0.0.0.0' })
