const http = require('http');
const isMutant = require('./nivel1.js').isMutant
const sqlite = require('sqlite')
const numCPUs = require('os').cpus().length;
// const numCPUs = 1
const cluster = require('cluster');
const dbName = './database.sqlite'
require('events').EventEmitter.defaultMaxListeners = 0;

const sleep = async (time) => new Promise((resolve, reject) => setTimeout(resolve, time))

var cache = undefined
var write_lock = false
var write_db_lock = true

var server = {}

const insert = async (dna, mutant) => {
    var db = await sqlite.open(dbName)
    await db.run('INSERT INTO dna(value, mutant) VALUES(?, ?)', [JSON.stringify(dna), mutant])
    await db.close()
}

const select = async () => {
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

    return {
        count_mutant_dna: mutants,
        count_human_dna: humans,
        ratio: mutants / (humans+mutants)
    }
}

process.on('message', (msg)=> {
    if(msg === 'write_ready') {
        //console.log('libero write_db_lock')
        write_db_lock = false
    }
    if(msg.op === 'update') {
        cache = msg.value
        // console.log(msg.value)
    }
})

const requestListener = (async (req, res) => {
    if(req.url ==='/mutant/' && req.method === 'POST') {
        let body = []
        req.on('data', (chunk) => {
            body.push(chunk);
          }).once('end', async () => {  
            var dna = JSON.parse(body).dna
            
            while(write_lock) await sleep(1);
            write_lock = true

            process.send('write')
            while(write_db_lock) await sleep(1);
            write_db_lock = true
            //console.log(`recibi permiso ${process.pid}`)
            var mutant = isMutant(dna)
            if(mutant)
            {
                res.statusCode = 200
                res.setHeader('Content-Type', 'text/plain');
                res.end('OK')
            } else {
                res.statusCode = 403
                res.end()
            }
            await insert(dna, mutant)
            process.send('finish')
            write_lock = false

          });
        
    } else if(req.url ==='/stats' && req.method === 'GET') {
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/json')
        res.end(JSON.stringify(cache))

    } else {
        res.statusCode = 404
        res.end()
    }
});

server.start = async () => {
    if (cluster.isMaster) {
        var db = await sqlite.open(dbName)
        await db.run('CREATE TABLE IF NOT EXISTS dna(value TEXT, mutant BOOLEAN)')
        var writing = false
        var value = await select()
        var children = []
        for (var i = 0; i < numCPUs; i++) {
            children.push(cluster.fork())
            // children[i].idx = i
        }
        children.forEach((child, index) => {
            child.on('message', async msg => {
                if(msg==='ready' && process.send) {
                    process.send(msg)               
                }
                if(msg==='write') {
                    while(writing) await sleep(1)
                    writing = true
                    // console.log(`va a escribir ${child.idx}`)
                    child.send('write_ready')
                    child.once('message', async () => {
                        // console.log(`terminó de escribir ${child.idx}`)
                        value = await select()
                        children.forEach(child=> {
                            child.send({op:'update', value: value})
                        })
                        writing = false
                        // console.log('libero lock')

                    })
                }
            })
            child.send({op:'update', value: value})
        })
        //console.log(`Main ${process.pid} started`);

      
        cluster.on('exit', (worker, code, signal) => {
            if (signal) {
              //console.log(`worker was killed by signal: ${signal}`);
            } else if (code !== 0) {
              //console.log(`worker exited with error code: ${code}`);
            } else {
              //console.log('worker success!');
            }
        });
    } else {
    http.createServer(requestListener).listen(server.port, server.host, async () => {
        //console.log(`Worker ${process.pid} started`);
        process.send('ready')
    })
    }
}

server.port = 8080

exports.default = server

server.start()