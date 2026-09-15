# todo-app

Mobile web app for the [Supabase-backed todo system](https://github.com/bersling/todo)
(private repo). A single static `index.html`, hosted on GitHub Pages, that
talks to PostgREST directly. Sign in once with the todo user's email and
password; the session is kept in localStorage. The Supabase URL and anon
key in the page are public by design — row level security only lets the
signed-in user at the rows.

Ticking an item does not delete it: `done_at` is stamped and the item drops
into a collapsible **Completed** section under the open ones, newest first,
where ticking again brings it back. The **MOVE** list additionally shows two
hard-coded `C` / `D` bubbles per row for who does what — one `assignee`
field, so picking one person drops the other, and tapping the bubble that is
already on clears it.

Works as a desktop pane too (a narrow window): the TUI's keys are wired up —
`j`/`k` move, `h`/`l`/`tab`/`1`-`9` switch list, `a` add, `e`/`enter` edit
in place, `t` today, `d` done/undone, `C`/`D` assign and `U` unassign (on
MOVE), `r` refresh, `o` open the table, `?` shows the list.
