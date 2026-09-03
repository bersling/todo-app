# todo-app

Mobile web app for the [Google-Sheet-backed todo system](https://github.com/bersling/todo)
(private repo). A single static `index.html`, hosted on GitHub Pages, that
reads and writes through the sheet's Apps Script web app.

The Apps Script URL in the page is public knowledge; the auth token is not
in this repo — the page asks for it once and keeps it in localStorage
(or seed it by opening `index.html?key=<token>`).

Works as a desktop pane too (a narrow Chrome `--app` window): the TUI's keys
are wired up — `j`/`k` move, `h`/`l`/`tab`/`1`-`9` switch list, `a` add,
`e`/`enter` edit in place, `t` today, `d` done, `r` refresh, `o` open
the sheet, `?` shows the list.
