import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const size = 256;
const output = join(process.cwd(), 'assets', 'icon.ico');
mkdirSync(dirname(output), { recursive: true });

const pixels = Buffer.alloc(size * size * 4);
for (let y = 0; y < size; y += 1) {
  for (let x = 0; x < size; x += 1) {
    const dx = x - size / 2;
    const dy = y - size / 2;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const index = ((size - 1 - y) * size + x) * 4;
    const inCircle = distance < 108;
    const inCore = Math.abs(dx) < 36 || Math.abs(dy) < 36;
    const alpha = inCircle ? 255 : 0;
    pixels[index] = inCore ? 235 : 42;
    pixels[index + 1] = inCore ? 245 : 124;
    pixels[index + 2] = inCore ? 255 : 18;
    pixels[index + 3] = alpha;
  }
}

const rowMaskBytes = Math.ceil(size / 32) * 4;
const andMask = Buffer.alloc(rowMaskBytes * size);
const bitmapHeader = Buffer.alloc(40);
bitmapHeader.writeUInt32LE(40, 0);
bitmapHeader.writeInt32LE(size, 4);
bitmapHeader.writeInt32LE(size * 2, 8);
bitmapHeader.writeUInt16LE(1, 12);
bitmapHeader.writeUInt16LE(32, 14);
bitmapHeader.writeUInt32LE(0, 16);
bitmapHeader.writeUInt32LE(pixels.length + andMask.length, 20);

const image = Buffer.concat([bitmapHeader, pixels, andMask]);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);

const directory = Buffer.alloc(16);
directory.writeUInt8(size >= 256 ? 0 : size, 0);
directory.writeUInt8(size >= 256 ? 0 : size, 1);
directory.writeUInt8(0, 2);
directory.writeUInt8(0, 3);
directory.writeUInt16LE(1, 4);
directory.writeUInt16LE(32, 6);
directory.writeUInt32LE(image.length, 8);
directory.writeUInt32LE(header.length + directory.length, 12);

writeFileSync(output, Buffer.concat([header, directory, image]));
console.log(output);
