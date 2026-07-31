const net = require('net');
const http = require('http');

const httpServer = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Hello from HTTP');
});
httpServer.listen(4000, '127.0.0.1');

const mux = net.createServer((socket) => {
  socket.once('data', (chunk) => {
    socket.pause();
    const isPms = chunk[0] === 0x02;
    const targetPort = isPms ? 10006 : 4000;
    
    const proxy = net.createConnection({ port: targetPort, host: '127.0.0.1' }, () => {
      proxy.write(chunk);
      socket.pipe(proxy);
      proxy.pipe(socket);
      socket.resume();
    });
    
    proxy.on('error', (err) => {
      console.log('Proxy error:', err.message);
      socket.end();
    });
    socket.on('error', (err) => {
      console.log('Socket error:', err.message);
      proxy.end();
    });
  });
});
mux.listen(10005, '0.0.0.0', () => console.log('Mux ready'));
