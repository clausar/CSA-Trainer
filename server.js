const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    // Remove query string from URL
    let filePath = '.' + req.url.split('?')[0];
    if (filePath === './') {
        filePath = './index.html';
    }

    const extname = String(path.extname(filePath)).toLowerCase();
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                res.writeHead(404);
                res.end('File not found');
            } else {
                res.writeHead(500);
                res.end('Server error: ' + error.code);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

// Get local IP
const os = require('os');
const interfaces = os.networkInterfaces();
let localIP = 'localhost';

for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
            localIP = iface.address;
            break;
        }
    }
}

server.listen(PORT, '0.0.0.0', () => {
    console.log('\n=================================');
    console.log('🚀 Servidor iniciado com sucesso!');
    console.log('=================================\n');
    console.log('Acede no computador:');
    console.log(`   http://localhost:${PORT}`);
    console.log('\nAcede no TELEFONE (mesmo WiFi):');
    console.log(`   http://${localIP}:${PORT}`);
    console.log('\n=================================');
    console.log('Pressiona Ctrl+C para parar');
    console.log('=================================\n');
});
