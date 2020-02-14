const http = require('http');
const isMutant = require('../nivel1.js').isMutant
const sqlite = require('sqlite')
const numCPUs = require('os').cpus().length;
const cluster = require('cluster');
const dbName = './database.sqlite'

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

            var db = await sqlite.open(dbName)
            await db.run('INSERT INTO dna(value, mutant) VALUES(?, ?)', [JSON.stringify(dna), isMutant(dna)])
            await db.close()
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
            var db = await sqlite.open(dbName)
            const rows = await db.all("SELECT COUNT(*) as cant, mutant FROM dna GROUP BY mutant")
            await db.close()

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
            cache.lock = false

        } else {
            res.end(JSON.stringify(cache.value))
        }
    } else {
        res.statusCode = 404
        res.end()
    }
});

server.start = async () => {
    if (cluster.isMaster) {
        var db = await sqlite.open(dbName)
        await db.run('CREATE TABLE IF NOT EXISTS dna(value TEXT, mutant BOOLEAN)')
        
        for (var i = 0; i < numCPUs; i++) {
          cluster.fork()
            .on('message', msg => {
                process.send(msg)
            });
        }
        console.log(`Worker ${process.pid} started`);
      
        cluster.on('exit', (worker, code, signal) => {
            if (signal) {
              console.log(`worker was killed by signal: ${signal}`);
            } else if (code !== 0) {
              console.log(`worker exited with error code: ${code}`);
            } else {
              console.log('worker success!');
            }
        });
      } else {
        console.log(`Worker ${process.pid} started`);
        server.listen(server.port, server.host, async () => {
            process.send('listening')
        })
      }
}

server.port = 8080

exports.default = server

server.start()