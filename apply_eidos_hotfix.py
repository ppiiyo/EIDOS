#!/usr/bin/env python3
"""EIDOS hotfix: регрессии коммита ea67e970 (P0). Идемпотентно, транзакционно."""
import os, re, sys, subprocess

ROOT = os.path.dirname(os.path.abspath(__file__))
def p(rel): return os.path.join(ROOT, rel)
if not os.path.isfile(p("package.json")):
    sys.exit("Запусти из корня репозитория EIDOS")

edits = []   # (rel, new_content)
created = [] # (rel, content)
errors = []

def read(rel):
    with open(p(rel), encoding="utf-8") as f: return f.read()

def sub_once(rel, s, old, new, label):
    if new in s and old not in s:
        print(f"  = {label}: уже применено"); return s
    if s.count(old) != 1:
        errors.append(f"{label}: ожидался 1 матч, найдено {s.count(old)} в {rel}"); return s
    print(f"  + {label}"); return s.replace(old, new)

def sub_re(rel, s, pat, repl, label, expect=None, flags=0):
    m = list(re.finditer(pat, s, flags))
    if len(m) == 0:
        errors.append(f"{label}: паттерн не найден в {rel}"); return s
    if expect is not None and len(m) != expect:
        errors.append(f"{label}: ожидалось {expect} матчей, найдено {len(m)} в {rel}"); return s
    print(f"  + {label} ({len(m)})")
    return re.sub(pat, repl, s, flags=flags)

# 1. Dockerfile: SPA собирается в корневой /app/dist (vite outDir=../../dist)
rel = "Dockerfile"; s = read(rel)
s = sub_once(rel, s, "/app/apps/workspace/dist", "/app/dist", "Dockerfile COPY /app/dist")
edits.append((rel, s))

# 2. Bitrix include.php: вернуть глобальные алиасы для CAgent/хуков (EidosConnector)
rel = "packages/connectors/bitrix/include.php"; s = read(rel)
if "'EidosConnector'" in s:
    print("  = Bitrix global aliases: уже применено")
else:
    s = s.rstrip() + "\n\n" + (
        "// Global aliases for CAgent / event handlers registered as 'EidosConnector'\n"
        "if (!class_exists('EidosConnector', false)) {\n"
        "    class_alias(\\Eidos\\Connectors\\Bitrix\\Connector::class, 'EidosConnector');\n"
        "}\n"
        "if (!class_exists('EidosHttpClient', false)) {\n"
        "    class_alias(\\Eidos\\Connectors\\Bitrix\\HttpClient::class, 'EidosHttpClient');\n"
        "}\n"
        "if (!class_exists('EidosMapper', false)) {\n"
        "    class_alias(\\Eidos\\Connectors\\Bitrix\\Mapper::class, 'EidosMapper');\n"
        "}\n"
    )
    print("  + Bitrix global aliases")
edits.append((rel, s))

# 3. store-registry: EIDOS_DATA_DIR, эфемерное демо, snapshot-before-WAL
rel = "apps/api/src/services/store-registry.ts"; s = read(rel)
s = sub_once(rel, s,
    "path.dirname(path.resolve(process.cwd(), process.env.EIDOS_DATA_DIR))",
    "path.resolve(process.cwd(), process.env.EIDOS_DATA_DIR)",
    "EIDOS_DATA_DIR resolve")
# демо — свежий temp-каталог на каждый запуск (без персистентности и без 409)
if "eidos-demo-" in s:
    print("  = demo ephemeral: уже применено")
else:
    pat = r"(private static getStorePersistencePaths\(\s*tenantId: string,\s*indexName: string\s*\): \{ walPath\?: string; snapshotPath\?: string \} \{\n)"
    repl = (r"\1    if (tenantId === 'demo') {\n"
            r"      const dir = path.join(os.tmpdir(), `eidos-demo-${process.pid}`, indexName);\n"
            r"      return {\n"
            r"        walPath: path.join(dir, 'catalog.wal.jsonl'),\n"
            r"        snapshotPath: path.join(dir, 'catalog.snapshot.json'),\n"
            r"      };\n"
            r"    }\n")
    s = sub_re(rel, s, pat, repl, "demo ephemeral paths", expect=1)
    if "import * as os from 'os';" not in s and "import os from 'os';" not in s:
        s = re.sub(r"(import \* as path from 'path';\n)", r"\1import * as os from 'os';\n", s, count=1)
        if "import * as os from 'os';" not in s:
            s = "import * as os from 'os';\n" + s
        print("  + import os")
# загружаем снапшот перед реплеем WAL (в getMetadata и createIndex)
if "store.loadSnapshotFromDisk(persistence.snapshotPath)" in s:
    print("  = snapshot-before-WAL: уже применено")
else:
    s = sub_once(
        rel,
        s,
        "    if (persistence.walPath) {\n      store.replayWalFromDisk(persistence.walPath);\n    }",
        "    if (persistence.snapshotPath) {\n      void store.loadSnapshotFromDisk(persistence.snapshotPath);\n    }\n    if (persistence.walPath) {\n      store.replayWalFromDisk(persistence.walPath);\n    }",
        "snapshot-before-WAL (getMetadata)"
    )
    s = sub_once(
        rel,
        s,
        "    if (!config.store && persistence.walPath) {\n      store.replayWalFromDisk(persistence.walPath);\n    }",
        "    if (!config.store && persistence.snapshotPath) {\n      void store.loadSnapshotFromDisk(persistence.snapshotPath);\n    }\n    if (!config.store && persistence.walPath) {\n      store.replayWalFromDisk(persistence.walPath);\n    }",
        "snapshot-before-WAL (createIndex)"
    )
edits.append((rel, s))

# 4. vector-store: демо-сид не пишет WAL (иначе реплей ставит production-флаг → 409)
rel = "apps/api/src/services/vector-store.ts"; s = read(rel)
if re.search(r"if \(!this\.isSeedingDemo\) \{\s*\n\s*this\.wal\.append\(\{", s):
    print("  = demo WAL guard: уже применено")
else:
    pat = r"([ \t]*)(this\.wal\.append\(\{\n[ \t]*type: existedBefore \? 'UPDATE_NODE' : 'INSERT_NODE',[\s\S]*?\n\1\}\);)"
    def wrap(m):
        ind = m.group(1)
        return f"{ind}if (!this.isSeedingDemo) {{\n{m.group(0)}\n{ind}}}"
    s2 = re.sub(pat, wrap, s, count=1)
    if s2 == s: errors.append("demo WAL guard: паттерн не найден в vector-store.ts")
    else: print("  + demo WAL guard"); s = s2
edits.append((rel, s))

# 5. security.ts: не слать credentials при wildcard origin
rel = "apps/api/src/plugins/security.ts"; s = read(rel)
s = sub_once(rel, s, "credentials: true,", "credentials: !isWildcardOrigin,", "CORS credentials")
edits.append((rel, s))

# 6. eidos.search: version.php для деприкейтнутого инсталлера
rel = "connectors/bitrix/eidos.search/install/version.php"
if os.path.isfile(p(rel)):
    print("  = version.php: уже есть")
else:
    created.append((rel,
        "<?php\n$arModuleVersion = [\n    'VERSION' => '3.4.1',\n"
        "    'VERSION_DATE' => '2026-11-12 00:00:00',\n];\n"))
    print("  + version.php")

if errors:
    print("\nОШИБКИ — ничего не записано:")
    for e in errors: print("  !", e)
    sys.exit(1)

for rel, content in edits:
    with open(p(rel), "w", encoding="utf-8") as f: f.write(content)
for rel, content in created:
    os.makedirs(os.path.dirname(p(rel)), exist_ok=True)
    with open(p(rel), "w", encoding="utf-8") as f: f.write(content)
print("\n✅ Правки применены.")

# php -l, если доступен
php = subprocess.run(["which","php"],capture_output=True,text=True).stdout.strip()
if php:
    bad = 0
    for base in ("packages/connectors/bitrix","connectors/bitrix"):
        for dp,_,fs in os.walk(p(base)):
            for f in fs:
                if f.endswith(".php"):
                    r = subprocess.run([php,"-l",os.path.join(dp,f)],capture_output=True,text=True)
                    if r.returncode != 0: bad += 1; print("  PHP FAIL:", r.stdout.strip())
    print(f"php -l: {'OK' if bad==0 else str(bad)+' ошибок'}")
else:
    print("php не найден — прогони `find . -name '*.php' -exec php -l {} \\;` вручную")
