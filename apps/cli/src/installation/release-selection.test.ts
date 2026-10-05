import { test, expect } from 'bun:test';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { validateArchivePaths, readReleaseSelection, inspectReleaseArchive } from './release-selection.ts';

const archive = (entries: {path: string; type?: string; link?: string}[]) => gzipSync(Buffer.concat([...entries.map(entry => {
  const header = Buffer.alloc(512); header.write(entry.path, 0, 100); header.write('00000000000', 124); header.write(entry.type ?? '0', 156); if (entry.link) header.write(entry.link, 157, 100); return header;
}), Buffer.alloc(1024)]));

test('archive rejects traversal, escaping links, symlink-parent writes and special entries before extraction', () => {
  const root = {path: 'candidate/', type: '5'};
  expect(() => validateArchivePaths(archive([root, {path: 'candidate/file'}]), 'candidate')).not.toThrow();
  for (const bad of [
    [{path: 'candidate/../escape'}], [{path: '/absolute'}], [{path: 'candidate/./file'}], [{path: 'candidate//file'}], [{path: 'candidate/link', type: '2', link: '../../escape'}],
    [{path: 'candidate/link', type: '2', link: 'dir'}, {path: 'candidate/link/file'}], [{path: 'candidate/device', type: '3'}],
  ]) expect(() => validateArchivePaths(archive([root, ...bad]), 'candidate')).toThrow();
});

test('portable selection rejects traversal and real symlink escape; corrupt archive fails hash first', async () => {
  const root = mkdtempSync('/tmp/surface-selection-');
  try {
    const bundle = {format: 1, version: '0.1.0-test.1', commit: 'a'.repeat(40), platform: process.platform, arch: process.arch, bun: Bun.version, files: {'app.js': 'b'.repeat(64)}};
    mkdirSync(join(root, 'out')); writeFileSync(join(root, 'out/candidate.tar.gz'), 'bad');
    const file = join(root, 'out/release.json');
    const save = (path: string) => writeFileSync(file, JSON.stringify({format: 1, archive: path, sha256: 'c'.repeat(64), bundle}));
    save('candidate.tar.gz'); expect(readReleaseSelection(file).archive).toBe(realpathSync(join(root, 'out/candidate.tar.gz')));
    await expect(inspectReleaseArchive(join(root, 'out/candidate.tar.gz'), 'c'.repeat(64))).rejects.toThrow('checksum');
    save('../outside.tar.gz'); expect(() => readReleaseSelection(file)).toThrow('selection');
    writeFileSync(join(root, 'outside.tar.gz'), 'data'); symlinkSync('../outside.tar.gz', join(root, 'out/link.tar.gz'));
    save('link.tar.gz'); expect(() => readReleaseSelection(file)).toThrow('escapes');
  } finally {rmSync(root, {recursive: true, force: true});}
});
