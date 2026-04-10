const { spawn } = require('child_process');
const http = require('http');

async function main() {
  const req = http.request({
    hostname: '127.0.0.1',
    port: 3012,
    path: '/api/chat',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-eval-mode': 'true',
    }
  }, (res) => {
    console.log(`STATUS: ${res.statusCode}`);
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      console.log(`BODY CHUNK: ${chunk}`);
    });
    res.on('end', () => {
      console.log('No more data in response.');
    });
  });

  req.on('error', (e) => {
    console.error(`problem with request: ${e.message}`);
  });

  req.write(JSON.stringify({
    message: "My 4-week-old has his days and nights completely confused. He sleeps all day and is wide awake from 1am to 5am."
  }));
  req.end();
}

main();
