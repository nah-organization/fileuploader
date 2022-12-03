import * as crypto from "crypto";
import { Transform } from "stream";

export function createHashThroughStream(): [Promise<string>, Transform] {
    const hash = crypto.createHash('sha256');
    const transform = new Transform({
        transform(chunk: Buffer, encoding, callback) {
            this.push(chunk);
            hash.update(chunk);
            callback();
        },
    });

    const promise = new Promise<string>((resolve, reject) => {
        transform.on('end', () => {
            resolve(hash.digest('hex'));
        });
        transform.on('close', () => {
            reject();
        });
    });

    return [promise, transform];
}
