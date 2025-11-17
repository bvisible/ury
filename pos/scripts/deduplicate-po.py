#!/usr/bin/env python3
"""Remove duplicate msgid entries from .po file while preserving header."""

import sys
import re

def deduplicate_po(po_file):
    with open(po_file, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split into entries by msgid pattern
    # First, get the header (everything before first real msgid that's not "")
    parts = re.split(r'\n(msgid "(?!\\n")[^\n"]+"\nmsgstr)', content)

    if not parts:
        print("No content found")
        return

    # First part is the header
    header = parts[0]

    # Ensure header ends with newline
    if not header.endswith('\n'):
        header += '\n'

    # Now process entries: parts[1], parts[2], parts[3], parts[4]...
    # parts[1] is msgid line, parts[2] is rest until next msgid
    seen = {}
    unique_entries = []

    i = 1
    while i < len(parts):
        if i + 1 < len(parts):
            msgid_line = parts[i]
            rest = parts[i + 1]

            # Extract the msgid value to use as key
            match = re.match(r'msgid "([^"]+)"', msgid_line)
            if match:
                msgid_value = match.group(1)

                # Only add if not seen before
                if msgid_value not in seen:
                    seen[msgid_value] = True
                    unique_entries.append(msgid_line + rest)

        i += 2

    # Write back
    with open(po_file, 'w', encoding='utf-8') as f:
        f.write(header)
        for entry in unique_entries:
            if not entry.startswith('\n'):
                f.write('\n')
            f.write(entry)

    print(f"Processed {len(seen)} unique entries")

if __name__ == '__main__':
    if len(sys.argv) != 2:
        print("Usage: deduplicate-po.py <po_file>")
        sys.exit(1)

    deduplicate_po(sys.argv[1])
