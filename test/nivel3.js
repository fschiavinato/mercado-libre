const sqlite = require('sqlite')
const dbPromise = sqlite.open(__dirname+'/../database.sqlite', { Promise })  
const port = 8080
const host = 'localhost'
var http = require('http')
const assert = require('assert')
const { fork } = require('child_process')
var keepAliveAgent = new http.Agent({ keepAlive: true})


const agregar = async (dna) => 
    new Promise((resolve,reject) => {
        var payload = JSON.stringify(dna)
        var req = http.request({method: 'POST', 
            path: '/mutant/', 
            host: host, 
            port: port,
            agent: keepAliveAgent,
            headers: {
                'Content-Type': 'text/json',
                'Content-Length': Buffer.byteLength(payload)
            }}, resolve)
        req.on('error', (e) => {
            reject(e)
        })
        req.write(payload)
        req.end()
})

const leer = async () => 
    new Promise((resolve, reject) => {
        let body = []
        var req = http.request({ 
            path: '/stats', 
            host: host, 
            port: port,
            agent: keepAliveAgent
        }, res => {
                res.on('data', (chunk) => {
                    body.push(chunk);
                }).on('end', () => {  
                    var count = JSON.parse(body)
                    resolve(count)
                });
            })
        req.on('error', (e) => {
            reject(e)
        })
        req.end()
})

const mutanteHorizontal = (n) => { 
    var res = Array(2*n).fill('')
    return res.map((value, index) =>
        index % 2==0?
            "A".repeat(2*n)
        :
            "B".repeat(2*n)
    )
}

const mutanteVertical = (n) => { 
    var res = Array(2*n).fill('')
    return res.map((value, index) => {
        for(let j =0 ; j < 2*n ; j++) {
            value += j % 2 ==0? "A" : "B"
        }
        return value
    })
}

const mutanteDiagAsc = (n) => { 
    var res = Array(2*n).fill('').map(value => Array(2*n).fill(' '))
    for(let i = 0; i<2*n; i++) {
        for(let j = 0; j<2*n; j++) {
            res[i][j] = ((i+j) % 4 == 0 || (i+j) % 4 == 1?
                    'A'
                :   'B'
            )
        }
    }
    return res.map(row => row.join(""))
}

const mutanteDiagDesc = (n) => { 
    var res = Array(2*n).fill('').map(value => Array(2*n).fill(' '))
    for(let i = 0; i<2*n; i++) {
        for(let j = 0; j<2*n; j++) {
            res[i][j] = ((i-j) % 4 == 0 || (i-j) % 4 == 1?
                    'A'
                :   'B'
            )
        }
    }
    return res.map(row => row.join(""))
}

const humano = (n) => {
    var res = Array(2*n).fill('').map(value => Array(2*n).fill(' '))
    for(let i = 0; i<2*n; i++) {
        for(let j = 0; j<2*n; j++) {
            res[i][j] = ((i+j + Math.floor((i)/3)) % 2 == 0?
                    'A'
                :   'B'
            )
        }
    }
    return res.map(row => row.join(""))
}

const exampleSize = 20

const ejemplos = [
    mutanteVertical(exampleSize),
    mutanteHorizontal(exampleSize),
    mutanteDiagAsc(exampleSize),
    mutanteDiagDesc(exampleSize),
    humano(exampleSize)
]


const clear = async (db) => (
    db.run('DELETE FROM dna')
)

dbPromise.then(async db => {
    await clear(db)
    var server = fork('./nivel3.js')
    server.once('message', async code => {
        console.log('server up')
        try {
            await testCorrect()
            console.log('correctness test ok')
            await testStress().catch(e => {})
            console.log('stress test ok')
            db.close()
            server.kill()
        }
        catch(e) {
            console.log(e)
            db.close()
            server.kill()   
        }
    })
})

const testCorrect = async () => {
    const readers = 1
    const writers = 100
    var pending = []
    for(let i=0; i<writers; i++) {
        pending.push(agregar({dna: ejemplos[i % ejemplos.length]}))
    }
    pending = await pending.reduce(async (accum, task) => {
        await task
        return accum
    }, [])

    for(let i=0; i<readers; i++) {
        pending.push(leer())
    }
    pending = await pending.reduce(async (accum, task) => 
    {   
        await task
        return accum
    }, [])
}

const testStress = async () => {
    const readers = 30000
    const writers = 1
    var pending = []
    for(let i=0; i<writers; i++) {
        pending.push(agregar({dna: ejemplos[i % ejemplos.length]}))
    }
    pending = await pending.reduce(async (accum, task) => {
        await task
        return accum
    }, [])

    for(let i=0; i<readers; i++) {
        pending.push(leer())
    }
    pending = await pending.reduce(async (accum, task) => 
    {   
        await task
        return accum
    }, [])
}