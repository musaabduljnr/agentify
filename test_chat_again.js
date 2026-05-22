const http = require('http');

const data = JSON.stringify({
  businessId: "185476ce-10d0-484c-83cc-7500ab557002",
  message: "hello",
  pageUrl: "http://localhost:3000/test-widget.html"
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/widget/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', d => body += d);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});

req.on('error', error => {
  console.error(error);
});

req.write(data);
req.end();
