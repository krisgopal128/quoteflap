#!/usr/bin/env python3
"""Merge quote datasets into flipoff/data/quotes.json (ALL unique quotes, no truncation).

Sources:
  1-3. GitHub JSON datasets (see SOURCES)
  4. Quotes-500K CSV (hf.co/datasets/jstet/quotes-500k) at $TEMP/quotes500k.csv
"""
import csv
import glob
import json
import os
import re
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, os.pardir, "data", "quotes.json"))
CSV_IN = os.path.join(os.environ.get("TEMP", "."), "quotes500k.csv")

SOURCES = [
    ("micheleriva",
     "https://raw.githubusercontent.com/micheleriva/the-quotes-database/master/src/data/quotes.json",
     "utf-8", "quote", "author"),
    ("JamesFT",
     "https://raw.githubusercontent.com/JamesFT/Database-Quotes-JSON/master/quotes.json",
     "latin-1", "quoteText", "quoteAuthor"),
    ("dwyl",
     "https://raw.githubusercontent.com/dwyl/quotes/master/quotes.json",
     "utf-8", "text", "author"),
]


def fetch(url, encoding):
    with urllib.request.urlopen(url) as r:
        return r.read().decode(encoding)


def items(payload):
    data = json.loads(payload)
    return data["quotes"] if isinstance(data, dict) else data


def norm(s):
    return re.sub(r"\s+", " ", str(s or "")).strip()


# --- split author names embedded at the end of quote text -----------------
# e.g. "Morality says it all. - Petra Hermans" -> text + author "Petra Hermans"

def _looks_name(s):
    words = s.split()
    if not 1 < len(words) <= 4:
        return False
    return all(re.match(r"^[A-Z][A-Za-z.'\u2019\-]*$", w) for w in words)


def split_author(text, author):
    """Strip a trailing embedded author; return (text, author)."""
    global SPLIT_COUNT
    text = str(text).strip()
    m = re.search(r"\s[-\u2013\u2014]\s*(.{2,40})$", text)
    if m and _looks_name(m.group(1).strip()):
        SPLIT_COUNT += 1
        return text[:m.start()].rstrip(" \t.,;:\"'"), m.group(1).strip()
    m = re.search(r"[.!?\"]\s+([A-Z][^.!?]{2,40})$", text)
    if m and _looks_name(m.group(1).strip()):
        cand = m.group(1).strip()
        if not author or author == "Unknown" or cand.lower() == author.lower():
            SPLIT_COUNT += 1
            return text[:m.start() + 1].rstrip(), cand
    return text, author


SPLIT_COUNT = 0


def add(seen, merged, text, author):
    global SPLIT_COUNT
    text, author = split_author(norm(text), norm(author))
    if not text:
        return False
    key = text.lower()
    if key in seen:
        return False
    seen.add(key)
    merged.append([text, author or "Unknown"])
    return True


def main():
    seen, merged, report = set(), [], []

    for name, url, enc, k_text, k_author in SOURCES:
        raw = [q for q in items(fetch(url, enc)) if norm(q.get(k_text))]
        added = sum(add(seen, merged, norm(q.get(k_text)), norm(q.get(k_author)))
                    for q in raw)
        report.append((name, len(raw), added))

    if os.path.exists(CSV_IN):
        total = added = 0
        with open(CSV_IN, encoding="utf-8", errors="replace", newline="") as f:
            for row in csv.DictReader(f):
                total += 1
                text = norm(row.get("quote"))
                if text and add(seen, merged, text, norm(row.get("author"))):
                    added += 1
        report.append(("Quotes-500K csv", total, added))
    else:
        print("WARNING: %s not found, skipped" % CSV_IN)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, separators=(",", ":"))

    # Also write ~25MB chunks; the server loads one at a time and rotates
    # hourly, instead of holding the full dataset in RAM.
    chunks_dir = os.path.join(os.path.dirname(OUT), "chunks")
    os.makedirs(chunks_dir, exist_ok=True)
    for old in glob.glob(os.path.join(chunks_dir, "quotes-*.json")):
        os.remove(old)
    n_chunks = 5
    per = (len(merged) + n_chunks - 1) // n_chunks
    for i in range(n_chunks):
        part = merged[i * per:(i + 1) * per]
        if not part:
            break
        p = os.path.join(chunks_dir, "quotes-%02d.json" % i)
        with open(p, "w", encoding="utf-8") as f:
            json.dump(part, f, ensure_ascii=False, separators=(",", ":"))
        print("chunk %s: %d quotes (%.1f MB)" % (os.path.basename(p), len(part),
                                                 os.path.getsize(p) / 1e6))

    for name, total, added in report:
        print("%s: downloaded %d, unique added %d" % (name, total, added))
    print("embedded authors split from text: %d" % SPLIT_COUNT)
    print("TOTAL UNIQUE: %d -> %s (%.1f MB)"
          % (len(merged), OUT, os.path.getsize(OUT) / 1e6))
    assert len(merged) > 10000, "merged dataset too small: %d" % len(merged)


if __name__ == "__main__":
    main()
