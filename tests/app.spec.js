const { test, expect } = require("@playwright/test");
const { mock } = require("./mock");
const { decode } = require("./png");

// Open item order in INBOX: the today item first, then alphabetical with
// umlauts folded (Ä sorts as A, so Ärger leads).
const OPEN = ["Zebra first (today)", "Ärger melden", "Buy milk", "Call mum"];

let m, touch;
test.beforeEach(async ({ page }, info) => {
  touch = !!info.project.use.hasTouch;
  m = await mock(page);
  await page.goto("/");
  await expect(page.locator(".item")).toHaveCount(5);
});

// tap on a phone, click on a desktop
const act = (loc) => (touch ? loc.tap() : loc.click());
const texts = (page) => page.locator(".item:not(.done) .txt").allTextContents();
const settle = (page) => page.waitForTimeout(250);
const doneCount = (page) => page.locator("#donehdr .n");

test("lists, order and the completed section", async ({ page }) => {
  await expect(page.locator("#tabs button:not(.more)")).toHaveText(["INBOX", "MOVE"]);
  await expect(page.locator("#tabs button.on")).toHaveText("INBOX");
  expect(await texts(page)).toEqual(OPEN);
  await expect(page.locator(".item.today .txt")).toHaveText("Zebra first (today)");
  await expect(doneCount(page)).toHaveText("1");
  await expect(page.locator(".item.done .txt")).toHaveText("Old done thing");
  await expect(page.locator("#count")).toHaveText("4 open");
});

test("lists past the pinned ones sit in a menu behind the last tab", async ({ page }) => {
  const more = page.locator("#tabs button.more"), menu = page.locator("#menu");
  await expect(more).toHaveText("");
  await expect(menu).toBeHidden();
  await act(more);
  await expect(menu).toBeVisible();
  await expect(menu.locator("button")).toHaveText(["IKEA"]);
  await act(menu.locator("button", { hasText: "IKEA" }));
  await expect(menu).toBeHidden();
  await expect(more).toHaveText("IKEA");
  await expect(page.locator("#tabs button.on")).toHaveCount(1);
  await expect(page.locator("#tabs button.on")).toHaveText("IKEA");
  await expect(page.locator(".item .txt")).toHaveText(["KALLAX 2x4"]);
  await expect(page.locator("#count")).toHaveText("1 open");
  // the menu lists the open one as current, and the shade closes it
  await act(more);
  await expect(menu.locator("button.on")).toHaveText("IKEA");
  await act(page.locator("#shade"));
  await expect(menu).toBeHidden();
  // the keys walk through it like any other list
  await page.keyboard.press("l");
  await expect(page.locator("#tabs button.on")).toHaveText("INBOX");
  await page.keyboard.press("h");
  await expect(more).toHaveText("IKEA");
  await page.keyboard.press("2");
  await expect(page.locator("#tabs button.on")).toHaveText("MOVE");
  await expect(more).toHaveText("");
  await page.keyboard.press("m");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
});

test("adding from the bar keeps the keyboard in the box", async ({ page }) => {
  const box = page.locator("#new");
  await act(box);
  await page.keyboard.type("Water plants");
  await page.keyboard.press("Enter");
  await expect(box).toBeFocused();
  await expect(box).toHaveValue("");
  await page.keyboard.type("Another one");
  await page.keyboard.press("Enter");
  await settle(page);
  expect(await texts(page)).toEqual(["Zebra first (today)", "Another one", "Ärger melden", "Buy milk", "Call mum", "Water plants"]);
  expect(m.posts().map((c) => c.body.text)).toEqual(["Water plants", "Another one"]);
  // the + button submits too, without taking focus from the box
  await page.keyboard.type("Via plus");
  await act(page.locator("#plus"));
  await expect(box).toHaveValue("");
  await expect(box).toBeFocused();
  await settle(page);
  expect(m.posts().length).toBe(3);
});

test("leaving the box with text in it adds the item; escape keeps the text", async ({ page }) => {
  await act(page.locator("#new"));
  await page.keyboard.type("Typed then left");
  await page.evaluate(() => document.getElementById("new").blur());   // what the keyboard's ✓ does
  await expect(page.locator(".item", { hasText: "Typed then left" })).toHaveCount(1);
  await expect(page.locator("#new")).toHaveValue("");
  await act(page.locator("#new"));
  await page.keyboard.type("Half an idea");
  await page.keyboard.press("Escape");
  await expect(page.locator("#new")).not.toBeFocused();
  await expect(page.locator("#new")).toHaveValue("Half an idea");
  await settle(page);
  expect(m.posts().map((c) => c.body.text)).toEqual(["Typed then left"]);
});

test("editing an item straight after adding it patches the right id", async ({ page }) => {
  m.delays.POST = 400;   // the insert is still on its way when the edit lands
  await act(page.locator("#new"));
  await page.keyboard.type("Draft");
  await page.keyboard.press("Enter");
  const row = page.locator(".item", { hasText: "Draft" });
  await act(row.locator(".txt"));
  await page.keyboard.type(" finished");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const created = m.db.todos.find((r) => r.text === "Draft finished");
  expect(created).toBeTruthy();
  expect(m.patches(created.id).map((c) => c.body)).toEqual([{ text: "Draft finished" }]);
  await expect(page.locator("#err")).toHaveCount(0);
});

test("editing one row and then tapping another saves the first and edits the second", async ({ page }) => {
  const milk = page.locator(".item", { hasText: "Buy milk" });
  await act(milk.locator(".txt"));
  await expect(milk).toHaveClass(/editing/);
  await page.keyboard.type(" and eggs");
  const mum = page.locator(".item", { hasText: "Call mum" });
  await act(mum.locator(".txt"));
  // exactly one row is being edited, and it is the one that was tapped
  await expect(page.locator(".item.editing")).toHaveCount(1);
  await expect(page.locator(".item.editing .txt")).toHaveText("Call mum");
  await expect(page.locator(".item.editing .txt")).toBeFocused();
  // the first edit went through
  await expect(page.locator(".item", { hasText: "Buy milk and eggs" })).toHaveCount(1);
  expect(m.patches("b1").map((c) => c.body)).toEqual([{ text: "Buy milk and eggs" }]);
  // nothing is painted as selected: no keyboard was involved
  await expect(page.locator(".item.sel")).toHaveCount(0);
  await page.keyboard.type("my");
  await page.keyboard.press("Enter");
  await settle(page);
  expect(m.patches("c1").map((c) => c.body)).toEqual([{ text: "Call mummy" }]);
  expect(await texts(page)).toEqual(["Zebra first (today)", "Ärger melden", "Buy milk and eggs", "Call mummy"]);
  await expect(page.locator(".item.editing")).toHaveCount(0);
});

test("enter saves and re-sorts, escape restores, an emptied item keeps its text", async ({ page }) => {
  const milk = page.locator(".item", { hasText: "Buy milk" });
  await act(milk.locator(".txt"));
  await page.evaluate(() => document.execCommand("selectAll"));
  await page.keyboard.type("Zzz last");
  await page.keyboard.press("Enter");
  await settle(page);
  expect(await texts(page)).toEqual(["Zebra first (today)", "Ärger melden", "Call mum", "Zzz last"]);
  expect(m.patches("b1").map((c) => c.body)).toEqual([{ text: "Zzz last" }]);

  const mum = page.locator(".item", { hasText: "Call mum" });
  await act(mum.locator(".txt"));
  await page.keyboard.type(" nope");
  await page.keyboard.press("Escape");
  await expect(mum.locator(".txt")).toHaveText("Call mum");
  await expect(mum).not.toHaveClass(/editing/);
  expect(m.patches("c1")).toEqual([]);

  await act(mum.locator(".txt"));
  await page.evaluate(() => document.execCommand("selectAll"));
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Enter");
  await expect(mum.locator(".txt")).toHaveText("Call mum");
  expect(m.patches("c1")).toEqual([]);
});

test("a refresh that lands during an edit does not clobber it", async ({ page }) => {
  const milk = page.locator(".item", { hasText: "Buy milk" });
  await act(milk.locator(".txt"));
  await page.keyboard.type(" now");
  m.db.todos.push({ id: "x9", list: "INBOX", text: "Arrived meanwhile", today: false, assignee: null, done_at: null, position: 9 });
  await page.evaluate(() => refresh());
  await page.waitForTimeout(300);
  await expect(page.locator(".item.editing .txt")).toHaveText("Buy milk now");
  await expect(page.locator(".item.editing .txt")).toBeFocused();
  await page.keyboard.press("Enter");
  await settle(page);
  expect(await texts(page)).toEqual(["Zebra first (today)", "Ärger melden", "Arrived meanwhile", "Buy milk now", "Call mum"]);
  expect(m.patches("b1").map((c) => c.body)).toEqual([{ text: "Buy milk now" }]);
});

test("ticking moves an item to completed and back", async ({ page }) => {
  const milk = page.locator(".item", { hasText: "Buy milk" });
  await act(milk.locator(".tick"));
  // the tick lands and the strike draws before the row leaves
  await expect(milk).toHaveClass(/ticking/);
  await expect(doneCount(page)).toHaveText("2");
  await expect(page.locator(".item.done .txt").first()).toHaveText("Buy milk");
  await expect(page.locator("#toast")).toHaveClass(/show/);
  await expect(page.locator("#toastmsg")).toHaveText("Done");
  await settle(page);
  expect(m.db.todos.find((r) => r.id === "b1").done_at).toBeTruthy();
  await act(page.locator(".item.done", { hasText: "Buy milk" }).locator(".tick"));
  await expect(doneCount(page)).toHaveText("1");
  await settle(page);
  expect(m.db.todos.find((r) => r.id === "b1").done_at).toBeNull();
  expect(await texts(page)).toEqual(OPEN);
});

test("the + button is whole, not clipped", async ({ page }) => {
  const bar = await page.locator("#bar").boundingBox();
  const plus = await page.locator("#plus").boundingBox();
  const svg = await page.locator("#plus svg").boundingBox();
  const vp = page.viewportSize();
  expect(plus.x).toBeGreaterThanOrEqual(bar.x);
  expect(plus.y).toBeGreaterThanOrEqual(bar.y);
  expect(plus.x + plus.width).toBeLessThanOrEqual(bar.x + bar.width);
  expect(plus.y + plus.height).toBeLessThanOrEqual(bar.y + bar.height);
  expect(plus.y + plus.height).toBeLessThanOrEqual(vp.height);
  expect(svg.x).toBeGreaterThan(plus.x);
  expect(svg.y).toBeGreaterThan(plus.y);
  expect(svg.x + svg.width).toBeLessThan(plus.x + plus.width);
  expect(svg.y + svg.height).toBeLessThan(plus.y + plus.height);
});

test("the circle sits on the text's first line and the check sits in the circle", async ({ page }) => {
  // circle centre vs the middle of the first text line
  const row = page.locator(".item", { hasText: "Buy milk" });
  const tick = await row.locator(".tick").boundingBox();
  const txt = await row.locator(".txt").boundingBox();
  const lh = await row.locator(".txt").evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
  expect(Math.abs(tick.y + tick.height / 2 - (txt.y + lh / 2))).toBeLessThanOrEqual(1);

  // the check mark, painted in the background colour on the filled circle
  const done = page.locator(".item.done .tick");
  const png = decode(await done.screenshot({ scale: "css" }));
  const cx = (png.width - 1) / 2, cy = (png.height - 1) / 2, r = png.width / 2 - 2.5;
  const rgb = (s) => s.match(/\d+/g).slice(0, 3).map(Number);
  const [bgc, accent] = await page.evaluate(() => [
    getComputedStyle(document.body).backgroundColor,
    getComputedStyle(document.querySelector(".item.done .tick .fill")).backgroundColor,
  ]).then((a) => a.map(rgb));
  const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
  let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1, n = 0;
  for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
    if (Math.hypot(x - cx, y - cy) > r) continue;         // outside the fill
    const p = png.at(x, y);
    if (dist(p, bgc) > dist(p, accent)) continue;         // accent, not check
    n++; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  expect(n).toBeGreaterThan(4);
  expect(Math.abs((minX + maxX) / 2 - cx)).toBeLessThanOrEqual(1.5);
  expect(Math.abs((minY + maxY) / 2 - cy)).toBeLessThanOrEqual(1.5);
});

test("assignee bubbles on the MOVE list", async ({ page }) => {
  await act(page.locator("#tabs button", { hasText: "MOVE" }));
  await expect(page.locator(".item")).toHaveCount(2);
  const books = page.locator(".item", { hasText: "Pack books" });
  await expect(books.locator(".bub.on")).toHaveText("C");
  await act(books.locator(".bub", { hasText: "D" }));
  await expect(books.locator(".bub.on")).toHaveText("D");
  await act(books.locator(".bub", { hasText: "D" }));
  await expect(books.locator(".bub.on")).toHaveCount(0);
  await settle(page);
  expect(m.patches("m1").map((c) => c.body)).toEqual([{ assignee: "D" }, { assignee: null }]);
  await expect(page.locator(".item", { hasText: "Sell sofa" }).locator(".bub")).toHaveCount(2);
});

test("keyboard: the selection follows the item through an edit, the pointer clears it", async ({ page }, info) => {
  test.skip(touch, "desktop keys");
  await page.keyboard.press("j");
  await expect(page.locator(".item.sel .txt")).toHaveText("Zebra first (today)");
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await expect(page.locator(".item.sel .txt")).toHaveText("Buy milk");
  await page.keyboard.press("Enter");
  await expect(page.locator(".item.editing .txt")).toBeFocused();
  await page.evaluate(() => document.execCommand("selectAll"));
  await page.keyboard.type("Zzz milk");
  await page.keyboard.press("Enter");
  await settle(page);
  // re-sorted to the end, still the selected one; the next key acts on it
  expect(await texts(page)).toEqual(["Zebra first (today)", "Ärger melden", "Call mum", "Zzz milk"]);
  await expect(page.locator(".item.sel .txt")).toHaveText("Zzz milk");
  await page.keyboard.press("t");
  await settle(page);
  expect(m.patches("b1").map((c) => c.body)).toEqual([{ text: "Zzz milk" }, { today: true }]);
  await expect(page.locator(".item.sel")).toHaveClass(/today/);
  await page.keyboard.press("d");
  await expect(doneCount(page)).toHaveText("2");
  await expect(page.locator(".item.sel .txt")).toHaveText("Zzz milk");
  await page.keyboard.press("d");
  await expect(doneCount(page)).toHaveText("1");
  // a click hides the selection bar; the next key brings it back on that item
  await page.locator(".item", { hasText: "Call mum" }).locator(".txt").click();
  await expect(page.locator(".item.sel")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.keyboard.press("k");
  await expect(page.locator(".item.sel")).toHaveCount(1);
});

test("undo brings a ticked item back", async ({ page }) => {
  await act(page.locator(".item", { hasText: "Call mum" }).locator(".tick"));
  await expect(doneCount(page)).toHaveText("2");
  await act(page.locator("#undo"));
  await expect(doneCount(page)).toHaveText("1");
  await expect(page.locator("#toast")).not.toHaveClass(/show/);
  await settle(page);
  expect(m.patches("c1").map((c) => c.body.done_at === null)).toEqual([false, true]);
  expect(await texts(page)).toEqual(OPEN);
});

test("delete with x, undo re-creates the item", async ({ page }) => {
  test.skip(touch, "desktop keys");
  await page.keyboard.press("j");
  await page.keyboard.press("j");
  await expect(page.locator(".item.sel .txt")).toHaveText("Ärger melden");
  await page.keyboard.press("x");
  await expect(page.locator(".item", { hasText: "Ärger melden" })).toHaveCount(0);
  await expect(page.locator("#toastmsg")).toHaveText("Deleted");
  // the selection moved on to the next item
  await expect(page.locator(".item.sel .txt")).toHaveText("Buy milk");
  await settle(page);
  expect(m.calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual(["todos?id=eq.a1"]);
  await page.keyboard.press("u");
  await expect(page.locator(".item", { hasText: "Ärger melden" })).toHaveCount(1);
  await settle(page);
  const back = m.posts().map((c) => c.body);
  expect(back).toEqual([{ list: "INBOX", text: "Ärger melden", today: false, assignee: null, done_at: null }]);
  expect(await texts(page)).toEqual(OPEN);
});

test("swipe right completes, swipe left deletes", async ({ page }) => {
  test.skip(touch, "dragged with the mouse; touch drags are not scriptable in WebKit here");
  const drag = async (text, dx) => {
    const box = await page.locator(".item", { hasText: text }).locator(".txt").boundingBox();
    const x = box.x + 20, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x + (dx * i) / 6, y);
    await page.mouse.up();
  };
  await drag("Buy milk", 140);
  await expect(doneCount(page)).toHaveText("2");
  await expect(page.locator(".item.editing")).toHaveCount(0);
  await drag("Call mum", -140);
  await expect(page.locator(".item", { hasText: "Call mum" })).toHaveCount(0);
  await expect(page.locator("#toastmsg")).toHaveText("Deleted");
  // a short drag is not a swipe: nothing happens, and it is not a tap either
  await drag("Ärger melden", 30);
  await settle(page);
  await expect(page.locator(".item", { hasText: "Ärger melden" })).toHaveCount(1);
  await expect(page.locator(".item.editing")).toHaveCount(0);
  await settle(page);
  expect(m.patches("b1").map((c) => c.body.done_at !== null)).toEqual([true]);
  expect(m.calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual(["todos?id=eq.c1"]);
});

test("screenshots for a look", async ({ page }, info) => {
  await page.screenshot({ path: `shots/${info.project.name}-light.png` });
  await act(page.locator("#tabs button.more"));
  await page.waitForTimeout(200);   // the chevron turns
  await page.screenshot({ path: `shots/${info.project.name}-menu.png` });
  await act(page.locator("#shade"));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForTimeout(300);   // let the colour transitions finish
  await page.screenshot({ path: `shots/${info.project.name}-dark.png` });
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForTimeout(300);
  await act(page.locator(".item", { hasText: "Buy milk" }).locator(".txt"));
  await page.screenshot({ path: `shots/${info.project.name}-editing.png` });
  await page.keyboard.press("Escape");
  await act(page.locator(".item", { hasText: "Call mum" }).locator(".tick"));
  await page.waitForTimeout(380);
  await page.screenshot({ path: `shots/${info.project.name}-ticking.png` });
  await expect(page.locator("#toast")).toHaveClass(/show/);
  await page.screenshot({ path: `shots/${info.project.name}-toast.png` });
});
