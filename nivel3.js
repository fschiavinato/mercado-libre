const http = require('http');
const isMutant = require('./nivel1.js').isMutant
const sqlite = require('sqlite3').verbose()
const db = new sqlite.Database('./database.sqlite')
// const worker = require('worker_threads')

const host = '127.0.0.1';
const port = 8080;

var cache = {
    dirty: true,
    value: undefined,
    lock: false
}

var server = http.createServer(async (req, res) => {
    if(req.url ==='/mutant/' && req.method === 'POST') {
        let body = []
        req.on('data', (chunk) => {
            body.push(chunk);
          }).on('end', async () => {  
            var dna = JSON.parse(body).dna
            
            while(cache.lock) {
                await new Promise(resolve => setTimeout(resolve, 1))
            };
            cache.lock = true
            
            cache.dirty = true
            if(isMutant(dna))
            {
                res.statusCode = 200
                res.setHeader('Content-Type', 'text/plain');
                res.end('OK')
            } else {
                res.statusCode = 403
                res.end()
            }
            db.prepare('INSERT INTO dna(value, mutant) VALUES(?, ?)').run([JSON.stringify(dna), isMutant(dna)])
            cache.lock = false
          });
        
    } else if(req.url ==='/stats' && req.method === 'GET') {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/json')
        
        while(cache.lock) {
            await new Promise(resolve => setTimeout(resolve, 1));
        }

        if(cache.dirty) {
            cache.lock = true
            cache.dirty = false
            db.all("SELECT COUNT(*) as cant, mutant FROM dna GROUP BY mutant", (err, rows) => {

                const getCant = (result) => (
                    result.length===0? 0 : result[0].cant
                )
                const [humans, mutants] = [
                        getCant(rows.filter(row => row.mutant === 0)),
                        getCant(rows.filter(row => row.mutant === 1))
                    ]
                
                cache.value = {
                    count_mutant_dna: mutants,
                    count_human_dna: humans,
                    ratio: mutants / (humans+mutants)
                }
                res.end(JSON.stringify(cache.value))
                
            })
            cache.lock = false
        } else {
            res.end(JSON.stringify(cache.value))
        }
    } else {
        res.statusCode = 404
        res.end()
    }
   
});


server.start = () => {
    db.run('CREATE TABLE IF NOT EXISTS dna(value TEXT, mutant BOOLEAN)')
    server.listen(server.port)
}

server.host = 'localhost'
server.port = '8080'

exports.default = server

if(module.parent) {
} else {
    server.start()
}