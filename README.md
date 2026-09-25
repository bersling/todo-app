# todo-app

Mobile web app for the [Supabase-backed todo system](https://github.com/bersling/todo)
(private repo). A single static `index.html`, hosted on GitHub Pages, that
talks to PostgREST directly. Sign in once with the todo user's email and
password; the session is kept in localStorage. The Supabase URL and anon
key in the page are public by design — row level security only lets the
signed-in user at the rows.

## How it behaves

- Tap the circle to complete. Ticking does not delete: `done_at` is
  stamped and the item drops into a collapsible **Completed** section
  under the open ones, newest first, where ticking again brings it back.
- Tap the row to edit in place. Enter, or tapping anywhere else (another
  row, a circle, the add box), saves; Escape puts the old text back; an
  emptied item keeps its text. The list is only re-sorted once the write
  has settled, never under your finger.
- Tap the star to flag for today. Today items sit on top, bold, above a
  divider; everything else is alphabetical (ä sorts as a).
- The add box at the bottom keeps the keyboard up after Enter or `+`, so
  several items go in one after the other.
- Writes are optimistic and settle on the next fetch; nothing fetched is
  painted while a write is in flight or an edit is open. Refresh on
  foreground and every 2 minutes; the last state is painted from
  localStorage on open.
- The **MOVE** list additionally shows two hard-coded `C` / `D` bubbles
  per row for who does what — one `assignee` field, so picking one person
  drops the other, and tapping the bubble that is already on clears it.

Works as a desktop pane too (a narrow window): the TUI's keys are wired up —
`j`/`k` move, `h`/`l`/`tab`/`1`-`9` switch list, `a` add, `e`/`enter` edit
in place, `t` today, `d` done/undone, `C`/`D` assign and `U` unassign (on
MOVE), `r` refresh, `o` open the table, `?` shows the list. The selection
bar only shows while the keyboard is in use; a tap or click hides it.

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
