#!/usr/bin/env python3
"""Remove duplicate msgid entries from .po file, keeping only the first occurrence."""

import sys
from collections import OrderedDict

def remove_duplicates(po_file):
    with open(po_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    entries = []  # List of (msgid, msgstr, raw_lines)
    seen_msgids = OrderedDict()  # Track first occurrence of each msgid
    current_entry = []
    current_msgid = None

    # Header lines before first msgid
    header_lines = []
    in_header = True

    i = 0
    while i < len(lines):
        line = lines[i]

        # Track header (everything before first msgid)
        if in_header and not line.startswith('msgid '):
            header_lines.append(line)
            i += 1
            continue

        if line.startswith('msgid '):
            in_header = False
            # Save previous entry if exists
            if current_entry:
                if current_msgid and current_msgid not in seen_msgids:
                    seen_msgids[current_msgid] = len(entries)
                    entries.append(current_entry)
                current_entry = []

            # Extract msgid value
            current_msgid = line[6:].strip().strip('"')
            current_entry.append(line)
        else:
            current_entry.append(line)

        i += 1

    # Don't forget last entry
    if current_entry:
        if current_msgid and current_msgid not in seen_msgids:
            seen_msgids[current_msgid] = len(entries)
            entries.append(current_entry)

    # Write back
    with open(po_file, 'w', encoding='utf-8') as f:
        # Write header
        f.writelines(header_lines)

        # Write unique entries
        for entry_lines in entries:
            f.writelines(entry_lines)

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: remove-po-duplicates.py <po_file>")
        sys.exit(1)

    remove_duplicates(sys.argv[1])
    print(f"Removed duplicates from {sys.argv[1]}")
