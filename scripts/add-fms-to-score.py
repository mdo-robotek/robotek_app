#!/usr/bin/env python3
"""Count every FMS step's doer in the Score (Sahil, 2026-10-27).

Adds an "Other FMS" category (I2R, I2R Packing, GRN, HRMS FMS, New Launch —
each step counted for the doer in that module's step setup) to:
  - src/app/api/score/route.ts           (score calculation)
  - src/app/(dashboard)/score/page.tsx   (breakdown, table, history)

Usage:  python3 add-fms-to-score.py <route.ts> <page.tsx>
Finds each spot by what the code does; writes nothing unless every spot in
a file is found. Safe to run twice.
"""
import re
import sys

route_path, page_path = sys.argv[1], sys.argv[2]


def patch(path, edits):
    s = open(path, encoding="utf-8").read()
    if "fmsStats" in s:
        print(f"{path}: ALREADY PATCHED")
        return True
    missing = []
    for label, fn in edits:
        new = fn(s)
        if new is None:
            missing.append(label)
        else:
            s = new
    if missing:
        print(f"{path}: NOT CHANGED - could not find: {', '.join(missing)}")
        return False
    open(path, "w", encoding="utf-8").write(s)
    print(f"{path}: PATCHED OK")
    return True


def sub1(pattern, repl, flags=0):
    def fn(s):
        new, n = re.subn(pattern, repl, s, count=1, flags=flags)
        return new if n == 1 else None
    return fn


def insert_before(anchor, text):
    def fn(s):
        i = s.find(anchor)
        return None if i == -1 else s[:i] + text + s[i:]
    return fn


FMS_BLOCK = """// Other FMS steps (I2R, I2R Packing, GRN, HRMS FMS, New Launch): each step
    // counts for the doer set in that module's step setup (Sahil, 2026-10-27).
    try {
      const { work: fmsWork } = await collectWork({ skip: ["Delegation", "Checklist", "Help Ticket", "O2D"] });
      const resolveFms = makeNameResolver(users.map((u: any) => String(u.username || "").trim()).filter(Boolean));
      fmsWork.forEach((w) => {
        const owners = resolveFms(w.responsible);
        if (!owners.length || !w.planned) return;
        const actual = w.done ? w.actual : null;
        allTasks.push({
          category: "fms",
          user: owners.join(","),
          plannedDate: w.planned,
          actualDate: actual,
          isCompleted: !!actual,
          isLate: !!(actual && actual > w.planned),
          title: `${w.module} · ${w.step} — ${w.title}${w.ref ? ` (${w.ref})` : ""}`,
          id: `${w.module}-${w.ref}-${w.step}`,
          status: actual ? "Done" : "Pending",
        });
      });
    } catch (err) {
      console.error("Score: other FMS skipped", err);
    }

    """

route_ok = patch(route_path, [
    ("imports", sub1(r'(import \{ auth \} from "@/auth";)',
                     r'\1\nimport { collectWork, makeNameResolver } from "@/lib/score-misses";')),
    ("FMS block", insert_before("// Process Scot Follow Ops Completed Tracking", FMS_BLOCK)),
    ("user filter", sub1(r"if \(t\.category === 'o2d' \|\| t\.category === 'scot'\)",
                         "if (t.category === 'o2d' || t.category === 'scot' || t.category === 'fms')")),
    ("fms metrics", sub1(r"(const scot = calculateMetrics\(userTasks\.filter\(t => t\.category === 'scot'\), from, to\);)",
                         r"\1\n      const fms = calculateMetrics(userTasks.filter(t => t.category === 'fms'), from, to);")),
    ("fms stats", sub1(r"(\n(\s*)scotStats: \{ \.\.\.scot, items: [^\n]*\n)",
                       r"\1\2fmsStats: { ...fms, items: userTasks.filter(t => t.category === 'fms' && (isDateInRange(t.plannedDate, from, to) || (t.actualDate && isDateInRange(t.actualDate, from, to)))).map(minimizeTask) },\n")),
])


def table_row(s):
    i = s.find("user.scotStats?.completed === 0")
    if i == -1:
        return None
    j = s.find("</tr>", i)
    if j == -1:
        return None
    j += len("</tr>")
    row = """
                    {user.fmsStats && user.fmsStats.total > 0 && (
                      <tr>
                        <td className="py-2.5 flex items-center gap-2 font-semibold text-[13px] sm:text-xs text-gray-900 dark:text-white"><ShoppingBagIcon className="w-5 h-5 text-teal-500 shrink-0"/> Other FMS</td>
                        <td className={`py-2.5 text-center font-semibold ${user.fmsStats.score >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {(isNegativeMode ? user.fmsStats.score - 100 : user.fmsStats.score || 0) + "%"}
                        </td>
                        <td className={`py-2.5 text-center font-semibold ${user.fmsStats.onTimeRate >= 80 ? 'text-emerald-500' : 'text-amber-500'}`}>
                          {user.fmsStats.completed === 0 ? "—" : (isNegativeMode ? user.fmsStats.onTimeRate - 100 : user.fmsStats.onTimeRate || 0) + "%"}
                        </td>
                      </tr>
                    )}"""
    return s[:j] + row + s[j:]


def history(s):
    i = s.find('data-pdf-section="history-scot"')
    if i == -1:
        return None
    j = s.find("{user.leaveStats && (", i)
    if j == -1 or j - i > 1500:
        return None
    block = """<div data-pdf-section="history-fms">
            {renderCategoryStatusSections(
              user.fmsStats?.items || [],
              "Other FMS Steps History",
              ShoppingBagIcon,
              "text-teal-600"
            )}
          </div>

          """
    return s[:j] + block + s[j:]


page_ok = patch(page_path, [
    ("breakdown", sub1(r"(\{ label: 'Scot Tracking', stats: user\.scotStats, color: 'text-purple-500', icon: PhoneIcon \},)",
                       r"\1\n                  ...(user.fmsStats?.total ? [{ label: 'Other FMS', stats: user.fmsStats, color: 'text-teal-500', icon: ShoppingBagIcon }] : []),")),
    ("all items", sub1(r"(\.\.\.\(user\.scotStats\?\.items \|\| \[\]\),\n)",
                       r"\1      ...(user.fmsStats?.items || []),\n")),
    ("table row", table_row),
    ("history", history),
])

sys.exit(0 if route_ok and page_ok else 1)
