import re, sys, time
from pathlib import Path

tstamp = time.strftime("%Y%m%d-%H%M%S")
changes = []

def backup(p: Path):
    bp = p.with_suffix(p.suffix + f".bak.{tstamp}")
    bp.write_text(p.read_text(encoding="utf-8"), encoding="utf-8")
    return bp

def replace_once(text, pattern, repl, flags=re.M):
    new, n = re.subn(pattern, repl, text, flags=flags)
    return new, n

def find_providers_dir():
    here = Path(__file__).resolve()
    search_roots = []
    for anc in [here.parent] + list(here.parents):
        search_roots.extend([anc, anc / "server", anc / "backend", anc / "app", anc / "src"])
    seen = set()
    for root in search_roots:
        if root in seen: 
            continue
        seen.add(root)
        if root.exists():
            for p in root.rglob("calendarsvc/providers"):
                if p.is_dir():
                    return p
    return None

def ensure_imports(text):
    want = ["from collections import defaultdict", "from typing import Dict"]
    have = {line.strip() for line in text.splitlines() if line.startswith("from ")}
    to_add = [w for w in want if w not in have]
    return ("\n".join(to_add) + ("\n" if to_add else "")) + text

def patch_provider(provider: Path):
    original = provider.read_text(encoding="utf-8")
    if "USER_DB:" in original:
        return False, "provider already per-user"
    text = ensure_imports(original)
    text = re.sub(r"(?m)^(\s*class\s+\w+\(.*\):)", "USER_DB: Dict[str, dict] = defaultdict(dict)\n\n\\1", text, count=1)
    text, _ = replace_once(text, r"def\s+list_events\(\s*self\s*(,.*?)?\):", r"def list_events(self, user_id: str\\1):")
    text, _ = replace_once(text, r"def\s+create_event\(\s*self\s*,", r"def create_event(self, user_id: str, ")
    text, _ = replace_once(text, r"def\s+update_event\(\s*self\s*,", r"def update_event(self, user_id: str, ")
    text, _ = replace_once(text, r"def\s+delete_event\(\s*self\s*,", r"def delete_event(self, user_id: str, ")
    if "DB" in text or "self.db" in text:
        text = re.sub(r"\bself\.db\b", "USER_DB[user_id]", text)
        text = re.sub(r"\bDB\b", "USER_DB[user_id]", text)
    else:
        text = re.sub(r"(def\s+list_events\(.*?\):\s*\n\s*)([^\n])", r"\\1    db = USER_DB[user_id]\n    \\2", text)
        text = re.sub(r"(def\s+create_event\(.*?\):\s*\n\s*)([^\n])", r"\\1    db = USER_DB[user_id]\n    \\2", text)
        text = re.sub(r"(def\s+update_event\(.*?\):\s*\n\s*)([^\n])", r"\\1    db = USER_DB[user_id]\n    \\2", text)
        text = re.sub(r"(def\s+delete_event\(.*?\):\s*\n\s*)([^\n])", r"\\1    db = USER_DB[user_id]\n    \\2", text)
    if text != original:
        backup(provider)
        provider.write_text(text, encoding="utf-8")
        changes.append(f"patched {provider}")
        return True, "provider patched"
    return False, "no change"

def patch_routes(providers_dir: Path):
    root = providers_dir.parents[1]  # server dir
    py_files = list(root.rglob("*.py"))
    def pass_user_id(path: Path):
        txt = path.read_text(encoding="utf-8")
        orig = txt
        txt = re.sub(r"\b([A-Za-z_][A-Za-z0-9_]*)\.list_events\(\)", r"\\1.list_events(user[\"user_id\"])", txt)
        txt = re.sub(r"\.create_event\(", r".create_event(user[\"user_id\"], user[\"user_id\"], ", txt)
        txt = re.sub(r"\.update_event\(", r".update_event(user[\"user_id\"], user[\"user_id\"], ", txt)
        txt = re.sub(r"\.delete_event\(", r".delete_event(user[\"user_id\"], user[\"user_id\"], ", txt)
        if txt != orig:
            backup(path)
            path.write_text(txt, encoding="utf-8")
            changes.append(f"patched {path}")
    for f in py_files:
        s = f.read_text(encoding="utf-8")
        if "/calendar/list" in s or "/calendar/mutate" in s:
            pass_user_id(f)

def main():
    providers_dir = find_providers_dir()
    if not providers_dir:
        print("ERROR: calendarsvc/providers directory not found.")
        sys.exit(1)
    candidates = list(providers_dir.glob("mock.py"))
    if not candidates:
        # fall back to any provider module under providers/
        candidates = list(providers_dir.glob("*.py"))
    if not candidates:
        print("ERROR: no provider module found under", providers_dir)
        sys.exit(1)
    provider = candidates[0]
    ok, msg = patch_provider(provider)
    print("PROVIDER:", msg)
    patch_routes(providers_dir)
    if changes:
        print("CHANGES:")
        for c in changes:
            print(" -", c)
    else:
        print("No changes made (already up-to-date).")
    sys.exit(0)

if __name__ == "__main__":
    main()
