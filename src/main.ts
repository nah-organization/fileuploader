import https from 'https';
import fs from 'fs';
import random from './random';
import { maxUploadSize, topRedirect } from './envs';
import { createHashThroughStream } from './streamThroughHash';
import { sizeLimitTransform } from './sizeLimitTransform';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const qrcodeBaseURL = 'http://localhost:4000/?url=';

function main(hostname: string, port: number, httpsOptions: https.ServerOptions) {
    const baseURL = `https://${hostname}${port === 443 ? '' : ':' + port}/`;

    const server = https.createServer(httpsOptions, (req, res) => {
        const url = new URL(req.url ?? '', `https://${hostname}/`);
        const path = url.pathname.slice(1).split('/');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, DELETE');
        res.setHeader('Access-Control-Allow-Headers', '*');
        res.setHeader('Allow', 'OPTIONS, GET, POST, DELETE');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        if (!(req.method === 'GET' || req.method === 'POST' || req.method === 'DELETE')) {
            res.writeHead(405);
            res.end();
            return;
        }
        if (path[0] === '') {
            // upload
            if (req.method === 'GET') {
                res.writeHead(302, { 'Location': topRedirect });
                res.end();
                return;
            }
            // 405
            if (req.method !== 'POST') {
                res.writeHead(405);
                res.end();
                return;
            }
            // method: post
            const filename = url.searchParams.get('file');
            if (!filename) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                // TODO: 
                res.end(JSON.stringify({ 'message': 'filename doesnt set, example: /?file=test.txt&mime=text/plain' }));
                return;
            }
            if (filename.includes('/')) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 'message': 'filename cannot contain "/", example: /?file=test.txt&mime=text/plain' }));
                return;
            }
            const mime = url.searchParams.get('mime');
            if (!mime) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 'message': 'mime doesnt set, example: /?file=test.txt&mime=text/plain' }));
                return;
            }
            if (!/\w+\/[-+.\w]+/.test(mime)) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 'message': 'invalid mime type, example: /?file=test.txt&mime=text/plain' }));
                return;
            }

            if (isNaN(+(req.headers['content-length'] ?? 0))) {
                res.writeHead(411, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 'message': 'content-length must' }));
                return;
            }

            if (+(req.headers['content-length'] ?? 0) > maxUploadSize) {
                res.writeHead(413, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 'message': 'Payload Too Large' }));
                return;
            }

            const deletePassword = random(6);

            const tmpFileName = random();
            const [hashResultPromise, hashTransform] = createHashThroughStream();
            const [sizeResultPromise, limitter] = sizeLimitTransform(maxUploadSize);
            const writeStream = fs.createWriteStream(`../files/${tmpFileName}`);
            req.pipe(limitter).pipe(hashTransform).pipe(writeStream);
            req.on('error', () => {
                limitter.destroy();
                hashTransform.destroy();
                writeStream.destroy();
            });

            Promise.all([hashResultPromise, sizeResultPromise]).then(([hash, size]) => {
                fs.rename(`../files/${tmpFileName}`, `../files/${hash}`, () => {
                    const url = random(16);
                    prisma.file.create({
                        data: {
                            path: hash,
                            mime: mime,
                            password: deletePassword,
                            filename: filename,
                            urlPath: url,
                            fileSize: size
                        }
                    }).then(file => {
                        res.writeHead(201, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            filename: filename,
                            mime: mime,
                            sha256hash: hash,
                            fileSize: size,
                            deletePassword: deletePassword,

                            downloadURL: baseURL + `${file.id}/dl/${filename}`,
                            downloadQRCodeURL: qrcodeBaseURL + encodeURIComponent(baseURL + `${file.id}/dl/${filename}`),
                        }));
                    });
                });
            }).catch(() => {
                res.writeHead(413);
                res.end(JSON.stringify({ 'message': 'Payload Too Large' }));
            });
        } else {
            const id = path[0];
            prisma.file.findFirst({
                where: {
                    urlPath: id
                }
            }).then(file => {
                if (!file || file.hidden) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 'message': 'not found' }));
                    return;
                }
                switch (path[1]) {
                    case 'dl': {
                        res.writeHead(200, {
                            'Content-Type': file.mime,
                            'Content-Disposition': `attachment; filename=${JSON.stringify(file.filename)}`,
                            'Content-Length': file.fileSize
                        });
                        res.end(fs.createReadStream(`../files/${file.path}`));
                        break;
                    }
                    case 'info': {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            filename: file.filename,
                            mime: file.mime,
                            sha256hash: file.path,
                            fileSize: file.fileSize,

                            downloadURL: baseURL + `${file.id}/dl/${file.filename}`,
                            downloadQRCodeURL: qrcodeBaseURL + encodeURIComponent(baseURL + `${file.id}/dl/${file.filename}`),
                        }));
                        break;
                    }
                    default: {
                        if (req.method === 'DELETE') {
                            prisma.file.delete({
                                where: {
                                    id: file.id
                                }
                            }).then(() => {
                                res.writeHead(204, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ 'message': 'deleted' }));
                            });
                        } else {
                            res.writeHead(404, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 'message': 'invalid url exmaple: /fileId/dl/' }));
                        }
                        break;
                    }
                }
            });
        };
    });
    server.listen(port, () => {
        console.log(`Server running at https://${hostname}:${port}/`);
    });
}
