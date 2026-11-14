#!/usr/bin/env python3
"""Print the UDID of an available iPhone simulator on the newest installed iOS runtime.

Used by .github/workflows/build-ios.yml. Prefers a non-"Pro Max"/"Plus" model so screenshots
have a standard 6.1"-6.3" layout; falls back to any iPhone.
"""
import json
import re
import subprocess
import sys

data = json.loads(subprocess.check_output(["xcrun", "simctl", "list", "devices", "available", "--json"]))


def runtime_version(key: str):
    m = re.search(r"iOS-(\d+)-(\d+)", key)
    return (int(m.group(1)), int(m.group(2))) if m else None


candidates = []
for runtime, devices in data.get("devices", {}).items():
    version = runtime_version(runtime)
    if version is None:
        continue
    for d in devices:
        name = d.get("name", "")
        if not name.startswith("iPhone"):
            continue
        large = ("Max" in name) or ("Plus" in name)
        candidates.append((version, not large, name, d["udid"]))

if not candidates:
    sys.exit("No available iPhone simulator")

candidates.sort(reverse=True)
version, _, name, udid = candidates[0]
print(f"Using {name} (iOS {version[0]}.{version[1]}) {udid}", file=sys.stderr)
print(udid)
