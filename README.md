# QuoteFlap

A split-flap board for your screen — the kind that used to clatter away in
airport terminals — except every time it settles, it's showing you a quote
you've (probably) never read before. Behind 493,000+ cleaned, deduplicated
quotes, one flip at a time.

This project started life as **FlipOff**, a wonderful split-flap emulator by
[magnum6actual](https://github.com/magnum6actual) — the board, the tiles, the
scramble, the recorded clack of a real flap display are all theirs. Go star
the original: **https://github.com/magnum6actual/flipoff**. QuoteFlap keeps
the board and swaps the rotating demo messages for half a million real quotes.

## Getting started

You need Python 3 and nothing else. No npm, no build step, no config file.

```bash
python tools/server.py        # serves on http://localhost:8000
```

Open the page. That's it.

**For a TV or dedicated display**, use the kiosk launchers to get a true
fullscreen window with no interaction:

- Windows: double-click `tools/start-tv.cmd`
- Linux/macOS: run `tools/start-tv.sh`

Either starts the server if needed and opens the browser in kiosk mode —
already fullscreen, no toolbars. (Browsers deliberately never let a plain
web page fullscreen itself without a gesture, so kiosk mode is the way to
get fullscreen-on-open.)

## What it does

- **One quote per refresh.** Every page load flips the board to a new random
  quote with the full scramble animation, then settles.
- **The author waits politely.** The name never appears on the board itself —
  it fades in underneath *after* the tiles finish. Toggle it with the **A**
  button if you'd rather not know.
- **A quote pool, not a firehose.** The page asks the server for 10 quotes at
  a time and works through them one by one — you'll never see the same quote
  twice in a batch. When the pool runs down to 7, it quietly fetches 10 more.
- **Tiny on the wire.** Your browser never downloads the dataset (the full
  file is ~118 MB; a page load moves about a kilobyte). All the heavy lifting
  stays on the server.

## The controls

| Input | What it does |
| --- | --- |
| Refresh the page | New random quote |
| `↻` button (bottom-right) | New random quote |
| `Enter` / `Space` / `←` / `→` | New random quote |
| `A` button | Show/hide the author line |
| `H` button | How often the server rotates its quote collection |
| `M` | Mute/unmute the flap sound |
| `Esc` | Close the shortcuts overlay |
| `⛶` button (top-right) | Toggle fullscreen (same as F11 visually; `Esc` exits) |
| `?` (bottom-left) | Keyboard shortcut reminder |

The `H` setting deserves a word: the server keeps one ~25 MB slice of the
dataset in memory (instead of all 118 MB) and swaps to a different slice
every so often, so the quote variety refreshes itself. You pick how often —
1, 2, 4, 12, or 24 hours — and the choice survives restarts.

## Runs on almost anything

- **Modern smart TVs** (Android/Google TV, Fire TV, Apple TV, Samsung Tizen
  and LG webOS from roughly 2018 onward) — yes.
- **Phones and tablets** — yes, verified: the board resizes cleanly with no
  sideways scrolling, and the corner buttons stay reachable.
- **Genuinely old TVs** (pre-2017 browsers that can't run modern JavaScript) —
  they automatically get a simpler fallback page: plain text on the same dark
  background, a big *ANOTHER QUOTE* button, and an auto-advance mode
  (every 30s/1m/5m/15m) so nobody has to babysit the remote. No animation,
  but the quotes keep coming.
- **Hisense VIDAA** — the browser on many of these sets is too limited to
  count on. A cheap streaming stick solves it permanently.

## The dataset

494,201 unique quotes, assembled from four public collections, deduplicated,
and cleaned — including splitting author names that were embedded in the
quote text itself ("…all. Petra Hermans" became quote + author properly).

Our thanks to the people who assembled these:

- **[Michele Riva](https://github.com/micheleriva)** —
  [the-quotes-database](https://github.com/micheleriva/the-quotes-database)
- **[JamesFT](https://github.com/JamesFT)** —
  [Database-Quotes-JSON](https://github.com/JamesFT/Database-Quotes-JSON)
- **[dwyl](https://github.com/dwyl)** — [quotes](https://github.com/dwyl/quotes)
- **Shivali Goel, Rishi Madhok & Shweta Garg** —
  [Quotes-500K](https://huggingface.co/datasets/jstet/quotes-500k)
  ([original release](https://github.com/ShivaliGoel/Quotes-500K)), the
  source of the overwhelming majority of the collection

This project is non-commercial — the quotes are displayed for enjoyment, not
profit, and the dataset authors' terms ask for exactly that kind of use. If
you're one of the authors and want credit adjusted, please open an issue.

## Tinkering

- **Regenerate the dataset:** `python tools/merge_quotes.py` re-downloads all
  four sources, re-merges, re-cleans, and rewrites both the full
  `data/quotes.json` and the server's 25 MB chunks.
- **Port or rotation default:** `python tools/server.py 3000` changes the
  port. The rotation default is 1h and lives in `data/rotate-hours.txt`
  (or just press `H`).
- **Editing the front-end:** the HTML loads `js/app.js`. If you edit a JS or
  CSS file, bump its `?v=` number in whichever file references it — assets
  are cached for a year on purpose, and the version bump is what tells
  browsers there's something new.

## License

MIT, same as the original FlipOff. The board is theirs; the quotes are
everyone's.
