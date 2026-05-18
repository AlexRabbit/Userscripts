import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function stripComments(code) {
    let out = '';
    let i = 0;
    const len = code.length;
    let state = 'code';
    let quote = '';
    let templateDepth = 0;

    while (i < len) {
        const c = code[i];
        const n = code[i + 1];

        if (state === 'code') {
            if (c === '/' && n === '/') {
                i += 2;
                while (i < len && code[i] !== '\n') i++;
                continue;
            }
            if (c === '/' && n === '*') {
                i += 2;
                while (i < len - 1 && !(code[i] === '*' && code[i + 1] === '/')) i++;
                i += 2;
                continue;
            }
            if (c === '"' || c === "'" || c === '`') {
                quote = c;
                state = quote === '`' ? 'template' : 'string';
                templateDepth = 0;
                out += c;
                i++;
                continue;
            }
            out += c;
            i++;
            continue;
        }

        if (state === 'string') {
            out += c;
            if (c === '\\' && i + 1 < len) {
                out += code[i + 1];
                i += 2;
                continue;
            }
            if (c === quote) state = 'code';
            i++;
            continue;
        }

        if (state === 'template') {
            out += c;
            if (c === '\\' && i + 1 < len) {
                out += code[i + 1];
                i += 2;
                continue;
            }
            if (c === '`' && templateDepth === 0) {
                state = 'code';
                i++;
                continue;
            }
            if (c === '$' && n === '{') {
                templateDepth++;
                i += 2;
                continue;
            }
            if (c === '}' && templateDepth > 0) {
                templateDepth--;
            }
            i++;
        }
    }

    return out
        .split('\n')
        .map((line) => line.replace(/[ \t]+$/, ''))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n');
}

function processFile(filePath) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const m = raw.match(/^(\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\r?\n)/);
    const header = m ? m[1] : '';
    const body = m ? raw.slice(header.length) : raw;
    const cleaned = header + stripComments(body);
    fs.writeFileSync(filePath, cleaned.endsWith('\n') ? cleaned : cleaned + '\n', 'utf8');
    console.log('stripped', path.basename(filePath));
}

const targets = fs
    .readdirSync(root)
    .filter((f) => f.endsWith('_Rabbit.js'))
    .map((f) => path.join(root, f));

targets.push(path.join(root, 'lib', 'adguard-bootstrap.js'));

for (const t of targets) {
    if (fs.existsSync(t)) processFile(t);
}
