const http = require('http');
const isMutant = require('./nivel1.js').isMutant

const hostname = '127.0.0.1';
const port = 8080;

const server = http.createServer((req, res) => {
    if(req.url ==='/mutant/' && req.method === 'POST') {
        let body = []
        req.on('data', (chunk) => {
            body.push(chunk);
          }).on('end', () => {
            if(isMutant(JSON.parse(body).dna))
            {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'text/plain');
                res.end('OK')
            } else {
                res.statusCode = 403;
                res.end()
            }
          });
        
    } else {
        res.statusCode = 404
        res.end()
    }
   
});

server.listen(port, hostname);