import re, time
from pathlib import Path

P = Path("server/calendarsvc/providers/mock.py")
src = P.read_text(encoding="utf-8")
backup = P.with_suffix(P.suffix + f".bak.{time.strftime('%Y%m%d-%H%M%S')}")
backup.write_text(src, encoding="utf-8")

t = src

# 1) Remove any bad module-level references like "USER_DB[user_id] = {}"
t = re.sub(r"(?m)^\s*USER_DB\[\s*user_id\s*\].*$", "", t)

# 2) Normalize imports (ensure Any, Dict, List, defaultdict)
lines = [ln for ln in t.splitlines() if not re.match(r"^\s*from typing import .*Any|List|Dict.*$", ln)]
lines = [ln for ln in lines if not re.match(r"^\s*from collections import defaultdict\s*$", ln)]
t = "\n".join(lines)
header = "from typing import Any, Dict, List\nfrom collections import defaultdict\n"
if not t.startswith(header):
    t = header + t.lstrip("\n")

# 3) Ensure a single USER_DB definition at top
t = re.sub(r"(?m)^\s*USER_DB\s*:\s*.*$", "", t)
t = re.sub(r"from collections import defaultdict\n", "from collections import defaultdict\n\nUSER_DB: Dict[str, Dict[str, Any]] = defaultdict(dict)\n", t, count=1)

# 4) Ensure provider method signatures include user_id
def add_user_id(sig: str) -> str:
    # if user_id already present, leave as-is
    if re.search(r"\buser_id\s*:", sig):
        return sig
    return re.sub(r"\(\s*self\s*(,?)", r"(self, user_id: str\1", sig)

t = re.sub(r"def\s+list_events\(\s*self\s*([^)]*)\):", lambda m: add_user_id(m.group(0)), t)
t = re.sub(r"def\s+create_event\(\s*self\s*,", "def create_event(self, user_id: str, ", t)
t = re.sub(r"def\s+update_event\(\s*self\s*,", "def update_event(self, user_id: str, ", t)
t = re.sub(r"def\s+delete_event\(\s*self\s*,", "def delete_event(self, user_id: str, ", t)

# 5) If body is missing after a def line, add 'pass'
lines = t.splitlines()
fixed = []
for i, ln in enumerate(lines):
    fixed.append(ln)
    if re.match(r"^\s*def\s+\w+\(.*\):\s*$", ln):
        nxt = lines[i+1] if i + 1 < len(lines) else ""
        if not re.match(r"^\s+", nxt):
            fixed.append("    pass")
t = "\n".join(fixed) + "\n"

P.write_text(t, encoding="utf-8")
print("ok")
