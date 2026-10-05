import { lstatSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { inspectReleaseArchive, type ReleaseSelection } from '@decompozr/surface-cli/installation/release-selection';

type PassedGate = { status: 'pass' };
type VisualGate = { status: 'pass'; phone: true; desktop: true; findingsResolved: true } | { status: 'limited'; phone: true; desktop: true; findingsResolved: true; limitation: string };
export type AcceptanceReceipt = {
  format: 1;
  sha256: string;
  commit: string;
  provider: { commit: string; packageSha256: string };
  gates: { source: PassedGate; comments: PassedGate; lifecycle: PassedGate; visual: VisualGate };
};

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const digest = (value: unknown, length: number): value is string => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
const passed = (value: unknown): value is PassedGate => record(value) && value.status === 'pass';

/** Operator evidence is an explicit assertion of completed gates, not a cryptographic attestation. */
export const parseAcceptanceReceipt = (value: unknown): AcceptanceReceipt => {
  if (!record(value) || value.format !== 1 || !digest(value.sha256, 64) || !digest(value.commit, 40)
    || !record(value.provider) || !digest(value.provider.commit, 40) || !digest(value.provider.packageSha256, 64)
    || !record(value.gates) || !passed(value.gates.source) || !passed(value.gates.comments) || !passed(value.gates.lifecycle)) {
    throw new Error('Acceptance requires exact archive/source/provider identities and passing source, full prepared comments, and installed lifecycle gates.');
  }
  const visual = value.gates.visual;
  if (!record(visual) || visual.phone !== true || visual.desktop !== true || visual.findingsResolved !== true) throw new Error('Acceptance requires rendered phone and desktop visual review with all in-scope findings resolved.');
  let visualGate: VisualGate;
  if (visual.status === 'pass') visualGate = { status: 'pass', phone: true, desktop: true, findingsResolved: true };
  else if (visual.status === 'limited' && typeof visual.limitation === 'string' && visual.limitation.trim()) {
    visualGate = { status: 'limited', phone: true, desktop: true, findingsResolved: true, limitation: visual.limitation };
  } else throw new Error('Visual review must pass or explicitly describe its applicable remaining limitation.');
  return {
    format: 1, sha256: value.sha256, commit: value.commit,
    provider: { commit: value.provider.commit, packageSha256: value.provider.packageSha256 },
    gates: { source: value.gates.source, comments: value.gates.comments, lifecycle: value.gates.lifecycle, visual: visualGate },
  };
};

const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';
const exists = (path: string): boolean => lstatSync(path, { throwIfNoEntry: false }) !== undefined;
const fileMatches = (path: string, expected: Buffer | string): boolean => {
  const stat = lstatSync(path);
  return stat.isFile() && !stat.isSymbolicLink() && readFileSync(path).equals(Buffer.from(expected));
};

/** Promote existing bytes. All validation precedes mutations, and the selection is published last. */
export const promoteRelease = async (options: { archive: string; acceptance: string; out: string }): Promise<ReleaseSelection> => {
  const archive = realpathSync(resolve(options.archive));
  const rawReceipt: unknown = JSON.parse(readFileSync(resolve(options.acceptance), 'utf8'));
  const receipt = parseAcceptanceReceipt(rawReceipt);
  const candidate = await inspectReleaseArchive(archive, receipt.sha256);
  let staging: string | undefined;
  try {
    if (candidate.bundle.commit !== receipt.commit || candidate.provider.commit !== receipt.provider.commit
      || candidate.provider.packageSha256 !== receipt.provider.packageSha256) throw new Error('Acceptance identities do not match the verified candidate source and provider.');
    const out = resolve(options.out);
    const name = basename(archive);
    if (!name.endsWith('.tar.gz')) throw new Error('Candidate archive filename must end in .tar.gz.');
    const relativeArchive = `releases/${candidate.sha256}/${name}`;
    const destination = join(out, 'releases', candidate.sha256);
    const selection: ReleaseSelection = { format: 1, archive: relativeArchive, sha256: candidate.sha256, bundle: candidate.bundle };
    const checksum = `${candidate.sha256}  ${name}\n`;
    const bytes = readFileSync(archive);
    if (createHash('sha256').update(bytes).digest('hex') !== candidate.sha256) throw new Error('Candidate archive changed during verification.');
    const acceptance = json(receipt);
    const descriptor = join(out, 'release.json');
    for (const directory of [out, join(out, 'releases')]) {
      if (exists(directory) && (!lstatSync(directory).isDirectory() || lstatSync(directory).isSymbolicLink())) throw new Error('Refusing to write release output through a non-directory or symlink.');
    }
    if (exists(descriptor) && (!lstatSync(descriptor).isFile() || lstatSync(descriptor).isSymbolicLink())) throw new Error('Refusing to replace a non-file release selection.');
    if (exists(destination)) {
      if (!lstatSync(destination).isDirectory() || lstatSync(destination).isSymbolicLink()
        || !exists(join(destination, name)) || !fileMatches(join(destination, name), bytes)
        || !exists(join(destination, name + '.sha256')) || !fileMatches(join(destination, name + '.sha256'), checksum)
        || !exists(join(destination, 'acceptance.json')) || !fileMatches(join(destination, 'acceptance.json'), acceptance)) {
        throw new Error('Refusing to overwrite conflicting immutable release output.');
      }
    } else {
      mkdirSync(join(out, 'releases'), { recursive: true });
      staging = mkdtempSync(join(out, 'releases', '.promote-'));
      writeFileSync(join(staging, name), bytes, { flag: 'wx' });
      writeFileSync(join(staging, name + '.sha256'), checksum, { flag: 'wx' });
      writeFileSync(join(staging, 'acceptance.json'), acceptance, { flag: 'wx' });
      renameSync(staging, destination);
      staging = undefined;
    }
    if (exists(descriptor) && fileMatches(descriptor, json(selection))) return selection;
    staging = mkdtempSync(join(out, '.select-'));
    writeFileSync(join(staging, 'release.json'), json(selection), { flag: 'wx' });
    renameSync(join(staging, 'release.json'), descriptor);
    return selection;
  } finally {
    if (staging) rmSync(staging, { recursive: true, force: true });
    candidate.cleanup();
  }
};
