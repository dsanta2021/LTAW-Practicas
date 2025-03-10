const http = require('http');
const server = http.createServer((req, res) => {
    res.write('Hola\n');
    res.end();
});

server.listen(8080);