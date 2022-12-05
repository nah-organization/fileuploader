import * as crypto from "crypto";

export default function (length: number = 32) {
    return crypto.randomBytes(Math.ceil(length * 3 / 4)).toString('base64').slice(0, length).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
