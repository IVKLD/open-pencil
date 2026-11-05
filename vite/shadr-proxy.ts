import type { Plugin } from 'vite'

export function shadrProxyPlugin(): Plugin {
  return {
    name: 'shadr-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (!url.startsWith('/api/shadr-proxy')) {
          return next()
        }

        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', '*')

        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.end()
          return
        }

        const targetUrl = (req.headers['x-target-url'] as string) || ''
        if (!targetUrl) {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Missing x-target-url header' }))
          return
        }

        try {
          const auth = req.headers['authorization']
          const headers: Record<string, string> = {
            Accept: 'application/json'
          }
          if (auth) headers['Authorization'] = auth
          if (req.headers['content-type']) {
            headers['Content-Type'] = req.headers['content-type']
          }

          let body: Buffer | undefined
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            const chunks: Buffer[] = []
            for await (const chunk of req) {
              chunks.push(chunk as Buffer)
            }
            body = Buffer.concat(chunks)
          }

          const response = await fetch(targetUrl, {
            method: req.method,
            headers,
            body
          })

          res.statusCode = response.status
          for (const [k, v] of response.headers.entries()) {
            if (k.toLowerCase() !== 'content-encoding') {
              res.setHeader(k, v)
            }
          }
          res.setHeader('Access-Control-Allow-Origin', '*')

          const buffer = await response.arrayBuffer()
          res.end(Buffer.from(buffer))
        } catch (err) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: String(err) }))
        }
      })
    }
  }
}
