// An in-memory stand-in for the Supabase project: enough of PostgREST for
// what the page sends (list, insert, patch by id, look up by text), and a
// signed-in session planted in localStorage so the login form never shows.
const SUPABASE = "https://wpfstejpyuetuqmayipa.supabase.co";

function seed() {
  return {
    // INBOX and MOVE are pinned across the top; IKEA (position 100+) sits in the menu
    lists: [{ name: "INBOX", position: 0 }, { name: "MOVE", position: 1 }, { name: "IKEA", position: 100 }],
    todos: [
      { id: "b1", list: "INBOX", text: "Buy milk", today: false, assignee: null, done_at: null, position: 1 },
      { id: "a1", list: "INBOX", text: "Ärger melden", today: false, assignee: null, done_at: null, position: 2 },
      { id: "t1", list: "INBOX", text: "Zebra first (today)", today: true, assignee: null, done_at: null, position: 3 },
      { id: "c1", list: "INBOX", text: "Call mum", today: false, assignee: null, done_at: null, position: 4 },
      { id: "d1", list: "INBOX", text: "Old done thing", today: false, assignee: null, done_at: "2026-09-01T10:00:00Z", position: 5 },
      { id: "m1", list: "MOVE", text: "Pack books", today: false, assignee: "C", done_at: null, position: 6 },
      { id: "m2", list: "MOVE", text: "Sell sofa", today: false, assignee: null, done_at: null, position: 7 },
      { id: "i1", list: "IKEA", text: "KALLAX 2x4", today: false, assignee: null, done_at: null, position: 8 },
    ],
  };
}

// Mounts the mock on a page. Returns handles to inspect what the page sent
// and to slow individual requests down (to reproduce races).
async function mock(page, opts = {}) {
  const db = seed();
  const calls = [];               // {method, path, body}
  const delays = { POST: 0, PATCH: 0, GET: 0 };
  let nextId = 100;

  await page.addInitScript(() => {
    localStorage.setItem("todo-session", JSON.stringify({ access: "t", refresh: "r", exp: Date.now() + 1e9 }));
    localStorage.removeItem("todo-cache");
    localStorage.removeItem("todo-tab");
    localStorage.setItem("todo-done-open", "true");
  });

  await page.route(SUPABASE + "/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const method = req.method();
    const path = url.pathname.replace("/rest/v1/", "");
    const body = req.postDataJSON ? safeJson(req) : null;
    calls.push({ method, path: path + url.search, body });
    if (delays[method]) await new Promise((r) => setTimeout(r, delays[method]));
    const json = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    const q = url.searchParams;

    if (path === "lists" && method === "POST") { db.lists.push(body); return json([body], 201); }
    if (path === "lists") return json(db.lists);
    if (path === "todos" && method === "GET") {
      let rows = db.todos.slice();
      if (q.get("done_at") === "is.null") rows = rows.filter((r) => !r.done_at);
      if (q.get("list")) rows = rows.filter((r) => r.list === q.get("list").replace(/^eq\./, ""));
      if (q.get("text")) rows = rows.filter((r) => r.text === q.get("text").replace(/^eq\./, ""));
      rows.sort((a, b) => a.position - b.position);
      if (q.get("limit")) rows = rows.slice(0, +q.get("limit"));
      return json(rows);
    }
    if (path === "todos" && method === "POST") {
      const row = { id: "n" + nextId++, today: false, assignee: null, done_at: null, position: nextId, ...body };
      db.todos.push(row);
      return json([row], 201);
    }
    if (path === "todos" && method === "DELETE") {
      const id = (q.get("id") || "").replace(/^eq\./, "");
      db.todos = db.todos.filter((r) => r.id !== id);
      return route.fulfill({ status: 204, body: "" });
    }
    if (path === "todos" && method === "PATCH") {
      const id = (q.get("id") || "").replace(/^eq\./, "");
      const row = db.todos.find((r) => r.id === id);
      if (!row) return json({ message: "no such id " + id }, 404);
      Object.assign(row, body);
      return route.fulfill({ status: 204, body: "" });
    }
    return json({ message: "unmocked " + method + " " + path }, 500);
  });

  return {
    db, calls, delays,
    patches: (id) => calls.filter((c) => c.method === "PATCH" && c.path.includes("id=eq." + id)),
    posts: () => calls.filter((c) => c.method === "POST"),
  };
}

function safeJson(req) {
  try { return req.postDataJSON(); } catch (e) { return null; }
}

module.exports = { mock, seed };
