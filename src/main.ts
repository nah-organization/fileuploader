import http from 'http';
import fs from 'fs';
import * as bcrypt from 'bcrypt';
import random from './random';
import { realbaseurl, maxUploadSize, qrcodeBaseURL, topRedirect } from './envs';
import { createHashThroughStream } from './streamThroughHash';
import { sizeLimitTransform } from './sizeLimitTransform';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function main(port: number) {
    const server = http.createServer((req, res) => {
        const url = new URL(req.url ?? '', `https://localhost/`);
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
            if (req.method !== 'POST') {
                res.writeHead(405);
                res.end();
                return;
            }
            // method: post
            const filename = url.searchParams.get('file');
            if (!filename) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
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


            const tmpFileName = random();
            const [hashResultPromise, hashTransform] = createHashThroughStream();
            const [sizeResultPromise, limitter] = sizeLimitTransform(maxUploadSize);
            const writeStream = fs.createWriteStream(`./files/${tmpFileName}`);
            req.pipe(limitter).pipe(hashTransform).pipe(writeStream);
            req.on('error', () => {
                limitter.destroy();
                hashTransform.destroy();
                writeStream.destroy();
            });

            Promise.all([hashResultPromise, sizeResultPromise]).then(([hash, size]) => {
                fs.rename(`./files/${tmpFileName}`, `./files/${hash}`, () => {
                    const deletePassword = random(6);
                    const url = random(16);
                    bcrypt.hash(deletePassword, 8).then(hashedPassword => {
                        prisma.file.create({
                            data: {
                                path: hash,
                                mime: mime,
                                password: hashedPassword,
                                filename: filename,
                                urlPath: url,
                                fileSize: size
                            }
                        }).then(file => {
                            res.writeHead(201, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({
                                id: url,
                                filename: filename,
                                mime: mime,
                                sha256hash: hash,
                                fileSize: size,
                                deletePassword: deletePassword,

                                downloadURL: realbaseurl + `${file.urlPath}/dl/${filename}`,
                                downloadQRCodeURL: qrcodeBaseURL + encodeURIComponent(realbaseurl + `${file.urlPath}/dl/${filename}`),
                                firebaseInfoURL: topRedirect + `file/?id=${file.urlPath}`,
                                firebaseInfoQRCodeURL: qrcodeBaseURL + encodeURIComponent(topRedirect + `file/?id=${file.urlPath}`),
                                firebaseInfoWithPasswordURL: topRedirect + `file/?id=${file.urlPath}&password=${deletePassword}`,
                                firebaseInfoWithPasswordQRCodeURL: qrcodeBaseURL + encodeURIComponent(topRedirect + `file/?id=${file.urlPath}&password=${deletePassword}`),
                            }));
                        });
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
                        fs.createReadStream(`./files/${file.path}`).pipe(res);
                        break;
                    }
                    case 'info': {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({
                            filename: file.filename,
                            mime: file.mime,
                            sha256hash: file.path,
                            fileSize: file.fileSize,

                            downloadURL: realbaseurl + `${file.id}/dl/${file.filename}`,
                            downloadQRCodeURL: qrcodeBaseURL + encodeURIComponent(realbaseurl + `${file.id}/dl/${file.filename}`),
                        }));
                        break;
                    }
                    default: {
                        if (req.method === 'DELETE') {
                            try {
                                const basic = req.headers.authorization?.split(' ')[1] ?? '';
                                const password = Buffer.from(basic, 'base64').toString('utf8').split(':')[1] ?? '';
                                bcrypt.compare(password, file.password).then(result => {
                                    if (!result) {
                                        res.writeHead(401, {
                                            'Content-Type': 'application/json',
                                            'WWW-Authenticate': 'Basic'
                                        });
                                        res.end(JSON.stringify({ 'message': 'Unauthorized' }));
                                        return;
                                    }
                                    prisma.file.update({
                                        where: {
                                            id: file.id
                                        },
                                        data: {
                                            hidden: true
                                        }
                                    }).then(() => {
                                        res.writeHead(200, { 'Content-Type': 'application/json' });
                                        res.end(JSON.stringify({ 'message': 'deleted' }));
                                    });
                                });
                            } catch (error) {
                                res.writeHead(400, {
                                    'Content-Type': 'application/json',
                                    'WWW-Authenticate': 'Basic'
                                });
                                res.end(JSON.stringify({ 'message': 'invalid authorization header' }));
                            }
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
    server.on('error', (error) => {
        console.error(error);
        prisma.$disconnect();
        server.close();
    });
    process.on('SIGINT', () => {
        console.log('bye! Have a good day!');
        prisma.$disconnect();
        server.close();
        process.exit(0);
    });
    server.listen('/socket/server.sock', () => {
        console.log(`Server running at ${realbaseurl}`);
    });
}

main(80);
