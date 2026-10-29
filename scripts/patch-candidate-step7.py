#!/usr/bin/env python3
"""Add the Candidate step-7 Selected / Rejected decision to an HRMS page.

The live server's hrms/[module]/page.tsx has its own edits, so a plain
patch does not apply. This script finds each spot by what the code does
(not by exact styling) and inserts the decision UI + save logic. Moving a
Selected candidate to Onboarding happens on the server (PUT
/api/hrms/candidate), so this file only collects the decision.

Usage:  python3 patch-candidate-step7.py "src/app/(dashboard)/hrms/[module]/page.tsx"
Writes nothing unless every required spot is found. Safe to run twice.
"""
import re
import sys

path = sys.argv[1]
src = open(path, encoding="utf-8").read()

if "bulkDecisionInputs" in src:
    print("ALREADY PATCHED - nothing to do")
    sys.exit(0)

s = src
problems = []


def sub_once(pattern, repl, label, flags=0):
    global s
    new, n = re.subn(pattern, repl, s, count=1, flags=flags)
    if n != 1:
        problems.append(label)
    else:
        s = new


# 1. decision state, next to the lead-time state
sub_once(
    r"(const \[bulkLeadTimeInputs, setBulkLeadTimeInputs\] = useState<[^>]*>>\(\{\}\);)",
    r'\1\n  // Candidate step 7 final decision (Sahil, 2026-10-27): Selected -> auto Onboarding, Rejected -> closed.\n'
    r'  const [bulkDecisionInputs, setBulkDecisionInputs] = useState<Record<string, "Selected" | "Rejected" | "">>({});',
    "lead-time state",
)

# 2. reset decisions whenever the update modal opens
sub_once(r"(setBulkLeadTimeInputs\(lt\);)", r"\1\n    setBulkDecisionInputs({});", "modal reset")

# 3. helpers before the save handler
sub_once(
    r"(\n(\s*)const handleBulkStepSave = async \(\) => \{)",
    "\n  const needsDecision = (id: string) => {\n"
    "    if (module !== 'candidate') return false;\n"
    "    const it = items.find(r => r.id === id);\n"
    "    return !!it && getActiveStep(it) === 7;\n"
    "  };\n"
    "  const missingDecision = Array.from(selectedIds).some(id => bulkToggles[id] && needsDecision(id) && !bulkDecisionInputs[id]);\n"
    r"\1",
    "save handler",
)

# 4. refuse to save without a decision
sub_once(
    r"(const toProc = Array\.from\(selectedIds\)\.filter\(id => bulkToggles\[id\]\);\s*\n\s*if \(!toProc\.length\) return;)",
    r"\1\n    if (toProc.some(id => needsDecision(id) && !bulkDecisionInputs[id])) return;",
    "save guard",
)

# 5. write the decision instead of "Done" at step 7
sub_once(
    r"upd\.lead_time_for_emp_joining_7 = bulkLeadTimeInputs\[id\] \|\| \"\";",
    "const decision = bulkDecisionInputs[id];\n"
    "        upd[`status_${n}`] = decision;\n"
    "        upd.lead_time_for_emp_joining_7 = decision === \"Selected\" ? (bulkLeadTimeInputs[id] || \"\") : \"\";",
    "step-7 save",
)

# 6. replace the step-7 lead-time box with decision buttons (+ lead time when Selected)
start = s.find("module === 'candidate' && step === 7 && (")
if start == -1:
    problems.append("step-7 box")
else:
    lead = s.find("Enter Lead Time", start)
    close_div = s.find("</div>", lead) if lead != -1 else -1
    end = s.find(")}", close_div) if close_div != -1 else -1
    input_start = s.rfind("<input", start, lead) if lead != -1 else -1
    input_end = s.find("/>", lead) + 2 if lead != -1 else -1
    if min(lead, close_div, end, input_start, input_end) < 0 or end - start > 3000:
        problems.append("step-7 box")
    else:
        lead_input = s[input_start:input_end]
        block = (
            "module === 'candidate' && step === 7 && (\n"
            '  <div className="bg-slate-50 dark:bg-navy-900 p-3 rounded-xl border border-slate-100 dark:border-navy-800 space-y-2">\n'
            '    <p className="text-[13px] font-semibold text-slate-500">Final decision (Step 7) *</p>\n'
            '    <div className="flex gap-2">\n'
            '      {(["Selected", "Rejected"] as const).map(opt => {\n'
            "        const on = bulkDecisionInputs[id] === opt;\n"
            '        const tone = opt === "Selected"\n'
            '          ? (on ? "bg-emerald-600 border-emerald-600 text-white" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50")\n'
            '          : (on ? "bg-red-600 border-red-600 text-white" : "border-red-200 text-red-600 hover:bg-red-50");\n'
            "        return (\n"
            "          <button key={opt} type=\"button\" onClick={() => setBulkDecisionInputs({ ...bulkDecisionInputs, [id]: opt })} className={`flex-1 min-h-[40px] rounded-xl border-2 text-[14px] font-semibold transition-colors ${tone}`}>\n"
            '            {opt === "Selected" ? "✓ Selected" : "✕ Rejected"}\n'
            "          </button>\n"
            "        );\n"
            "      })}\n"
            "    </div>\n"
            '    {bulkDecisionInputs[id] === "Selected" && (\n'
            "      <>\n"
            '        <p className="text-[13px] text-emerald-700">Will move to Onboarding automatically.</p>\n'
            '        <p className="text-[13px] font-semibold text-slate-400">Lead Time For Emp. Joining</p>\n'
            f"        {lead_input}\n"
            "      </>\n"
            "    )}\n"
            '    {bulkDecisionInputs[id] === "Rejected" && (\n'
            '      <p className="text-[13px] text-red-600">Candidate will be closed as Rejected. Add the reason in the remark.</p>\n'
            "    )}\n"
            "  </div>\n"
        )
        s = s[:start] + block + s[end:]

# 7. disable the save button until every step-7 row has a decision
sub_once(
    r"(<button\s+onClick=\{handleBulkStepSave\})",
    '{missingDecision && <span className="text-[13px] font-semibold text-amber-600 mr-3">Choose Selected or Rejected for every step 7 candidate</span>}\n'
    r"              \1 disabled={missingDecision}",
    "save button",
)

if problems:
    print("NOT CHANGED - could not find: " + ", ".join(problems))
    sys.exit(1)

open(path, "w", encoding="utf-8").write(s)
print("PATCHED OK")
