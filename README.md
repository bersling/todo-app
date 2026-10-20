# todo-app

Mobile web app for the [Supabase-backed todo system](https://github.com/bersling/todo)
(private repo). A single static `index.html`, hosted on GitHub Pages, that
talks to PostgREST directly. Sign in once with the todo user's email and
password; the session is kept in localStorage. The Supabase URL and anon
key in the page are public by design — row level security only lets the
signed-in user at the rows.

## How it behaves

- Tap the circle to complete. The ring fills, the check draws, a strike
  runs across the text and the row folds into the collapsible
  **Completed** section under the open ones, newest first. A short
  "Done" bar offers **Undo**; ticking a completed item also brings it
  back. Ticking does not delete: `done_at` is stamped.
- Swipe a row right to complete it, left to delete it. Deleting is final
  on the server, so the "Deleted" bar's **Undo** re-creates the item.
- Tap the row to edit in place. Enter, or tapping anywhere else (another
  row, a circle, the add box), saves; Escape puts the old text back; an
  emptied item keeps its text. The list is only re-sorted once the write
  has settled, never under your finger, and never while a row animates.
- Tap the star to flag for today. Today items sit on top, bold, with a
  gap below them; everything else is alphabetical (ä sorts as a).
- The list names across the top are the tabs; the count of open items
  sits at the right. Only the lists at `position` 0–99 are pinned there;
  the rest (100 and up) sit in a menu behind one last tab, which reads
  the name of the one that is open, or just a chevron. `h`/`l`/`tab` and
  the digits walk through them all the same. **+ New list** at the foot
  of that menu adds a list (name typed, Enter), placed behind the last tab
  and opened right away; `n` does the same from the keyboard. The add box at the bottom keeps the keyboard up
  after Enter or `+`, so several items go in one after the other.
  Leaving the box with something typed adds it too: on iOS the toolbar
  above the keyboard cannot be hidden by a web app, and its ✓ only
  closes the keyboard, so it may as well finish the item. Escape leaves
  the box and keeps the text. While the keyboard is up the app is sized
  to the visible part of the screen, so the box sits on the keyboard.
- Writes are optimistic and settle on the next fetch; nothing fetched is
  painted while a write is in flight or an edit is open. Refresh on
  foreground and every 2 minutes; the last state is painted from
  localStorage on open. Reduced motion is respected.
- The **MOVE** list additionally shows two hard-coded `C` / `D` bubbles
  per row for who does what — one `assignee` field, so picking one person
  drops the other, and tapping the bubble that is already on clears it.
- Type is Archivo (Google Fonts, one family at two widths: the condensed
  cut for the list names); offline it falls back to the system font.

Works as a desktop pane too (a narrow window): the TUI's keys are wired up —
`j`/`k` move, `h`/`l`/`tab`/`1`-`9` switch list, `m` the menu of the other
lists, `n` new list, `a` add, `e`/`enter` edit
in place, `t` today, `d` done/undone, `x`/`⌫` delete, `u` undo the last
done or delete, `C`/`D` assign and `U` unassign (on MOVE), `r` refresh,
`o` open the table, `?` shows the list. The selection bar only shows
while the keyboard is in use; a tap or click hides it.

## Tests

Playwright, run in Docker so nothing is installed on the machine. Supabase
is mocked in the browser (`tests/mock.js`), so the suite needs no
credentials and touches no data. Two projects: a phone (WebKit, touch) and
a narrow desktop window.

```sh
docker run --rm --ipc=host -v "$PWD:/work" -w /work/tests \
  mcr.microsoft.com/playwright:v1.63.0-noble \
  bash -lc "npm install --no-audit --no-fund && npx playwright test"
```

Screenshots of both shapes, light and dark, land in `tests/shots/`.
