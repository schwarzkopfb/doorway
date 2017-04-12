'use strict'

const http     = require('http'),
      test     = require('tap'),
      WebSocket = require('ws'),
      Rule     = require('../../lib/rule'),
      dispatch = require('../../lib/handlers/dispatch').dispatchWebSocket,
      proxy    = http.createServer(listener).listen(onListening),
      servers  = [],
      rules    = []

let port = 4848

test.plan(8)
test.tearDown(() => {
    proxy.close()
    servers.forEach(server => server.close())
})

createServer('hello 1', 'world 1')
createServer('world 2', 'hello 2')

rules.push(Rule.fromPattern('example.com?', `http://127.0.0.1:4848{0}`, Rule.behavior.forward))
rules.push(new Rule(/^test\.com(.*)$/, `http://127.0.0.1:4849{0}`, Rule.behavior.forward))

function onListening() {
    proxy.on('upgrade', onUpgrade)

    sendMessage('example.com', '', 'hello 1', 'world 1')
    sendMessage('test.com', '/test', 'world 2', 'hello 2')
    sendMessageAndExpectDisconnection('')
    sendMessageAndExpectDisconnection('unknown-host')
}

function onUpgrade(req, socket, head) {
    dispatch(req, socket, head, rules)
}

function listener(req, res) {
    res.end('test')
}

function createServer(expectedMessage, answer) {
    const server = new WebSocket.Server({ port: port++ })

    server.on('connection', ws => {
        ws.on('message', msg => {
            test.equals(msg, expectedMessage)

            ws.send(answer)
        })
    })

    servers.push(server)
}

function sendMessage(host, url, message, expectedAnswer) {
    const ws = new WebSocket(`ws://127.0.0.1:${proxy.address().port}${url}`, null, {
        headers: { host }
    })

    ws.on('open', () => ws.send(message))
    ws.on('message', msg => test.equals(msg, expectedAnswer))
}

function sendMessageAndExpectDisconnection(host) {
    const ws = new WebSocket(`ws://127.0.0.1:${proxy.address().port}`, null, {
        headers: { host }
    })

    ws.on('error', err => {
        test.type(err, Error)
        test.equals(err.code, 'ECONNRESET')
    })
}
