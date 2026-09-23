#!/usr/bin/env python3
"""Check repository Markdown destinations/anchors and Surface R/D/E traceability.

Read-only, standard-library checker. Uses tracked plus nonignored untracked files;
ignores fenced/inline code and external URLs. It does not fetch external links,
validate runtime behavior, or certify rendered/accessibility acceptance.
"""
from pathlib import Path
from urllib.parse import unquote, urlsplit
import os
import re
import subprocess
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]


def prose(text):
    lines, fence = [], None
    for line in text.splitlines():
        marker = re.match(r"^\s*(`{3,}|~{3,})", line)
        if marker:
            mark = marker.group(1)
            if fence is None:
                fence = mark
            elif mark[0] == fence[0] and len(mark) >= len(fence):
                fence = None
            lines.append("")
        else:
            lines.append(line if fence is None else "")
    return "\n".join(lines)


def anchors(text):
    found, counts = set(), {}
    for line in prose(text).splitlines():
        match = re.match(r"^#{1,6}\s+(.+?)\s*#*\s*$", line)
        if not match:
            continue
        title = re.sub(r"\[([^]]+)\]\([^)]*\)", r"\1", match.group(1))
        title = re.sub(r"<[^>]*>", "", title).lower()
        slug = "".join(c for c in title if c in "-_ " or unicodedata.category(c)[0] not in "PS").replace(" ", "-")
        number = counts.get(slug, 0)
        counts[slug] = number + 1
        found.add(slug if not number else f"{slug}-{number}")
    found.update(re.findall(r'<[^>]+\b(?:id|name)=[\'"]([^\'"]+)[\'"]', text))
    return found


def main():
    paths = subprocess.check_output(["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], cwd=ROOT).decode().split("\0")
    documents = {ROOT / p: (ROOT / p).read_text() for p in sorted(set(paths)) if p.endswith(".md") and (ROOT / p).is_file()}
    errors, checked, external, source_fragments = [], 0, 0, 0
    inline = re.compile(r'!?\[[^\]\n]*\]\((<[^>]+>|[^\s)]+)(?:\s+[\'"][^\n]*?[\'"])?\)')
    definitions = re.compile(r'^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)', re.M)
    for path, content in documents.items():
        clean = re.sub(r'(`+).*?\1', '', prose(content))
        refs = [(m.group(1).strip('<>'), clean.count('\n', 0, m.start()) + 1) for pattern in [inline, definitions] for m in pattern.finditer(clean)]
        for destination, line in refs:
            url = urlsplit(destination)
            if url.scheme or url.netloc:
                external += 1
                continue
            target = (ROOT / unquote(url.path).lstrip('/')) if url.path.startswith('/') else (path.parent / unquote(url.path) if url.path else path)
            target = Path(os.path.normpath(target))
            label = f'{path.relative_to(ROOT)}:{line}: {destination}'
            checked += 1
            if not target.exists():
                errors.append(label + ' (missing target)')
            elif url.fragment and target.suffix.lower() == '.md':
                if unquote(url.fragment) not in anchors(target.read_text()):
                    errors.append(label + ' (missing anchor)')
            elif url.fragment:
                source_fragments += 1

    # Every current requirement/design definition must appear in the evaluation
    # index; every indexed ID must have a definition. This checks coverage, not meaning.
    def ids(directory, pattern):
        return set(re.findall(pattern, '\n'.join(p.read_text() for p in (ROOT / directory).glob('*.md'))))
    requirements = ids('docs/requirements', r'<a id="(r-\d+)"')
    designs = set()
    for path in (ROOT / 'docs/design').glob('*.md'):
        designs.update(re.findall(r'^## (D-\d+):', path.read_text(), re.M))
    evaluation_index = (ROOT / 'docs/evaluations/README.md').read_text()
    indexed = set(re.findall(r'\b[RD]-\d+\b', evaluation_index))
    defined = {item.upper() for item in requirements} | designs
    for item in sorted(defined - indexed):
        errors.append(f'{item}: missing from evaluation index')
    for item in sorted(indexed - defined):
        errors.append(f'{item}: indexed but no canonical definition')
    evaluations = []
    for path in (ROOT / 'docs/evaluations').glob('*.md'):
        evaluations.extend(re.findall(r'^## (E-\d+):', path.read_text(), re.M))
    if len(evaluations) != len(set(evaluations)):
        errors.append('Duplicate evaluation gate identifier')
    print(f'{len(documents)} Markdown files; {checked} local references; {external} external references skipped; {source_fragments} non-Markdown fragments not checked.')
    print(f'Traceability: {len(requirements)} requirements, {len(designs)} design contracts, {len(evaluations)} evaluation gates.')
    if errors:
        print('\n'.join(errors))
        return 1
    print('PASS: local destinations, Markdown anchors and identifier coverage.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
