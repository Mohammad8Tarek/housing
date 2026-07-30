const net = require("net");
const http = require("http");

const httpServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk.toString()));
  req.on("end", () => {
    res.writeHead(200);
    res.end("Received body: " + body);
  });
});

const netServer = net.createServer({ pauseOnConnect: true }, (socket) => {
  socket.once("data", (data) => {
    socket.unshift(data);
    socket.pause();
    httpServer.emit("connection", socket);
  });
  socket.resume();
});

netServer.listen(10003, () => {
  console.log("Listening on 10003");
  const req = http.request(
    { port: 10003, method: "POST", path: "/" },
    (res) => {
      let resBody = "";
      res.on("data", (chunk) => (resBody += chunk.toString()));
      res.on("end", () => {
        console.log("Response:", resBody);
        netServer.close();
      });
    },
  );
  req.write("Hello World");
  req.end();
});
