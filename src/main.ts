import https from 'https';
import fs from 'fs';
import * as mysql from './mysqlprop';
import * as post from './post';
import * as crypto from 'crypto';
import log from './log';
import { message } from './error';
import imageSize from 'image-size';

export default function (hostname: string, port: number, httpsOptions: https.ServerOptions) {
    const server = https.createServer(httpsOptions, (req, res) => {
        const time = new Date();
        log(`access - [${time}]`);
        const path = req.url?.split('?')[0].slice(1).split('/') ?? [];
        log('url: ' + req.url, 1);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Request-Method', '*');
        res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
        res.setHeader('Access-Control-Allow-Headers', '*');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        if (+path[0]) {
            mysql.database.tables.files.select({ 'id': +path[0] }).then(files => {
                if (files.length === 0) {
                    fs.readFile('./public/404.html', 'utf-8', (err, data) => {
                        log('fsQuery: ./public/404.html', 2, 'fs');
                        if (err) {
                            log('fsErr: ' + err, 2, 'fs');
                        }
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.write(data);
                        res.end();
                        log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                    });
                    return;
                }
                if (files[0].path === '') {
                    fs.readFile('./public/404.html', 'utf-8', (err, data) => {
                        log('fsQuery: ./public/404.html', 2, 'fs');
                        if (err) {
                            log('fsErr: ' + err, 2, 'fs');
                        }
                        res.writeHead(404, { 'Content-Type': 'text/html' });
                        res.write(data);
                        res.end();
                        log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                    });
                    return;
                }
                post.get(req).then(postData => {
                    const token = postData.get('token');
                    if (token == undefined) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 'error': `'token' is not set` }));
                        log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                        return;
                    }
                    mysql.database.tables.fileHandler.select({ 'token': token, 'fileId': files[0].id, 'type': 'read' }).then(handler => {
                        if (handler.length === 0) {
                            res.writeHead(400, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 'error': `invalid token` }));
                            log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                            return;
                        }
                        mysql.database.tables.fileHandler.delete({ 'token': token });
                        fs.readFile('../files/' + files[0].path, (err, data) => {
                            log('fsQuery: ../files/' + files[0].path, 2, 'fs');
                            if (err) {
                                log('fsErr: ' + err, 2, 'fs');
                                fs.readFile('./public/404.html', 'utf-8', (err, data) => {
                                    log('fsQuery: ./public/404.html', 2, 'fs');
                                    if (err) {
                                        log('fsErr: ' + err, 2, 'fs');
                                    }
                                    res.writeHead(404, { 'Content-Type': 'text/html' });
                                    res.write(data);
                                    res.end();
                                    log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                                });
                                return;
                            }
                            res.writeHead(200, { 'Content-Type': files[0].dataType/*, 'Cache-Control': 'max-age=7776000'*/ });
                            res.write(data);
                            res.end();
                            log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                        });
                    });
                });
            });
        } else if (path[0] === 'upload') {
            post.get(req, 1 * 1024 * 1024 * 1024).then(postData => {
                const token = postData.get('token');
                if (token == undefined) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 'error': `'token' is not set` }));
                    log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                    return;
                }
                mysql.database.tables.fileHandler.select({ 'token': token, 'type': 'write' }).then(handler => {
                    if (handler.length === 0) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 'error': `invalid token` }));
                        log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                        return;
                    }
                    mysql.database.tables.fileHandler.delete({ 'token': token });
                    const base64 = postData.get('data');
                    if (base64 == undefined) {
                        res.writeHead(400, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 'error': `'data' is not set` }));
                        log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                        return;
                    }
                    const data = Buffer.from(base64, 'base64');
                    const path = crypto.createHash('sha256').update(base64, 'base64').digest('hex');
                    fs.writeFile('../files/' + path, data, err => {
                        log('fsQueryWrite: ../files/' + path, 2, 'fs');
                        if (err) {
                            log('fsErr: ' + err, 2, 'fs');
                            return;
                        }
                        mysql.database.tables.files.select({ 'id': handler[0].fileId }).then(files => {
                            if (files.length === 0) {
                                res.writeHead(500, { 'Content-Type': 'application/json' });
                                res.end(JSON.stringify({ 'error': `1` }));
                                log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                                message('dataError: fileHandlerにはtokenあるのにfilesにはidない');
                                return;
                            }
                            (new Promise<{
                                'width': number,
                                'height': number;
                            }>((resolve) => {
                                if ([
                                    'image/bmp',
                                    'image/vnd.microsoft.icon',
                                    'image/vnd-ms.dds',
                                    'image/gif',
                                    'image/icns',
                                    'image/x-icns',
                                    'image/jpeg',
                                    'image/ktx',
                                    'image/png',
                                    'image/x-portable-anymap',
                                    'image/x-portable-pixmap',
                                    'image/x-portable-graymap',
                                    'image/x-portable-bitmap',
                                    'image/vnd.adobe.photoshop',
                                    'image/x-photoshop',
                                    'image/svg+xml',
                                    'image/webp',
                                    'image/tiff',
                                    'image/tiff-fx'
                                ].includes(files[0].dataType)) {
                                    imageSize('../files/' + path, (err, result) => {
                                        if (err) {
                                            console.log(err);
                                            resolve({
                                                'width': 0,
                                                'height': 0
                                            });
                                            return;
                                        }
                                        if (result && result.width && result.height) {
                                            resolve({
                                                'width': result.width,
                                                'height': result.height
                                            });
                                            return;
                                        }
                                        resolve({
                                            'width': 0,
                                            'height': 0
                                        });
                                    });
                                    return;
                                }
                                resolve({
                                    'width': 0,
                                    'height': 0
                                });
                            })).then(size => {
                                mysql.database.tables.files.update({ 'id': handler[0].fileId }, {
                                    'path': path,
                                    'width': size.width,
                                    'height': size.height
                                });
                            });
                        });
                    });
                    res.writeHead(201, { 'Content-Type': 'application/json', 'X-Frame-Options': 'DENY' });
                    res.end(JSON.stringify({ 'status': 'created' }));
                    log('res.end() time: ' + (Date.now() - time.getTime()), 0);
                });
            });
        } else {
            fs.readFile('./public/404.html', 'utf-8', (err, data) => {
                log('fsQuery: ./public/404.html', 2, 'fs');
                if (err) {
                    log('fsErr: ' + err, 2, 'fs');
                }
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.write(data);
                res.end();
                log('res.end() time: ' + (Date.now() - time.getTime()), 0);
            });
        }
    });

    server.listen(port, () => {
        console.log(`Server running at https://${hostname}:${port}/`);
    });
}
