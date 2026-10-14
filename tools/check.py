#!/usr/bin/env python3
"""Hana repo check. Standard library only. Run from the repo root:

    python3 tools/check.py            # check this repo
    python3 tools/check.py --root DIR # check another folder (used by the self-test)

Exit code 0 means no errors. Warnings do not fail the check.

What this does NOT do yet: it does not verify owner or voucher signatures.
That needs an open Ed25519 library and a decided signature format (SPEC.md).
Until then a passing check means "well-formed", not "authentic".

It does check the price safeguards in SPEC.md section 5.4: every menu version is
kept, versions form a hash chain, every change to a price, delivery fee or
minimum order is announced inside the file, and the price history only grows.
"""
import argparse
import hashlib
import json
import math
import re
import sys
from datetime import datetime
from pathlib import Path

ERRORS = []
WARNINGS = []


def err(path, msg):
    ERRORS.append(f"ERROR   {path}: {msg}")


def warn(path, msg):
    WARNINGS.append(f"WARNING {path}: {msg}")


HEX64 = re.compile(r"^[0-9a-f]{64}$")
SLUG = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
BIZ_PHONE = re.compile(r"^\+8801\d{9}$")
LOCAL_OR_INTL_MOBILE = re.compile(r"(?<!\d)(?:\+?8801[3-9]\d{8}|01[3-9]\d{8})(?!\d)")
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")
STAMP = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$")
RELATIVE_LOCATION = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_./-]*$")
PLUS_FULL = re.compile(r"^[23456789CFGHJMPQRVWX]{8}\+[23456789CFGHJMPQRVWX]{2,3}$")
OLC_ALPHABET = "23456789CFGHJMPQRVWX"
# Spelling rule from SPEC.md section 1.1. Built in pieces so this file passes its own check.
FORBIDDEN_WORDS = ["Chatto" + "gram"]
# Founding commitments (GOVERNANCE.md section 1): no fee or paid-placement fields.
FORBIDDEN_KEYS = {"commission", "sponsored", "promoted", "paid_placement",
                  "advertisement", "ad", "tracker", "analytics", "referral_fee",
                  "featured", "pinned", "boost", "priority", "rank", "service_fee", "platform_fee",
                  "surge", "fee_per_km", "fee_rules"}
# Wide Bangladesh bounds. Only meant to catch swapped or wrong coordinates.
LAT_RANGE = (20.5, 26.7)
LON_RANGE = (88.0, 92.8)
# Photo limits (SPEC.md section 5.3). Proposed values.
PHOTO_MAX_BYTES = 300_000
PHOTO_MAX_SIDE = 1600
PHOTO_MAX_COUNT = 12

TEXT_SUFFIXES = {".md", ".json", ".html", ".css", ".py", ".yml", ".yaml", ".txt"}
SKIP_DIRS = {".git", "node_modules", "_work", "__pycache__"}
SKIP_FILES = {"pico.classless.min.css"}


def is_int(x):
    return isinstance(x, int) and not isinstance(x, bool)


def is_num(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool)


def load_json(path, root):
    rel = path.relative_to(root)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        err(rel, "file is missing")
    except json.JSONDecodeError as e:
        err(rel, f"not valid JSON ({e})")
    return None


def walk_strings(obj, path, rel):
    """Reject markup in any string and forbidden fee or tracking keys."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k.lower() in FORBIDDEN_KEYS:
                err(rel, f"field '{k}' is not allowed (founding commitments: no fees or paid placement)")
            walk_strings(v, f"{path}.{k}", rel)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            walk_strings(v, f"{path}[{i}]", rel)
    elif isinstance(obj, str):
        if "<" in obj or ">" in obj:
            err(rel, f"{path}: contains '<' or '>' (menu text must be plain text, no HTML)")


def olc_decode_full(code):
    """Centre (lat, lon) of a full Open Location Code. Open algorithm, from the published spec."""
    c = code.replace("+", "").upper()
    lat, lon, res = -90.0, -180.0, 20.0
    pairs = c[:10]
    for i in range(0, len(pairs), 2):
        lat += OLC_ALPHABET.index(pairs[i]) * res
        lon += OLC_ALPHABET.index(pairs[i + 1]) * res
        if i + 2 < len(pairs):
            res /= 20
    latres = lonres = res
    for ch in c[10:]:
        latres /= 5
        lonres /= 4
        idx = OLC_ALPHABET.index(ch)
        lat += (idx // 4) * latres
        lon += (idx % 4) * lonres
    return lat + latres / 2, lon + lonres / 2


def check_polygon(geo, where, rel):
    if not isinstance(geo, dict) or geo.get("type") != "Polygon":
        err(rel, f"{where}: must be a GeoJSON Polygon")
        return
    rings = geo.get("coordinates")
    if not isinstance(rings, list) or not rings:
        err(rel, f"{where}: polygon has no coordinates")
        return
    for ri, ring in enumerate(rings):
        if not isinstance(ring, list) or len(ring) < 4:
            err(rel, f"{where}: ring {ri} needs at least 4 points")
            continue
        if ring[0] != ring[-1]:
            err(rel, f"{where}: ring {ri} is not closed (first and last point must match)")
        for pi, pt in enumerate(ring):
            if not (isinstance(pt, list) and len(pt) >= 2 and all(is_num(n) for n in pt[:2])):
                err(rel, f"{where}: ring {ri} point {pi} is not [lon, lat]")
                continue
            lon, lat = pt[0], pt[1]
            if not (LON_RANGE[0] <= lon <= LON_RANGE[1] and LAT_RANGE[0] <= lat <= LAT_RANGE[1]):
                err(rel, f"{where}: ring {ri} point {pi} ({lon}, {lat}) is outside Bangladesh. "
                         "GeoJSON order is [longitude, latitude]. Are they swapped?")
                return


def check_areas(root):
    data = load_json(root / "areas.json", root)
    ids = set()
    if not isinstance(data, dict):
        return ids
    rel = "areas.json"
    if data.get("city") != "Chittagong":
        err(rel, 'city must be exactly "Chittagong"')
    areas = data.get("areas")
    if not isinstance(areas, list):
        err(rel, "'areas' must be a list")
        return ids
    no_boundary, kinds = [], {}
    for i, a in enumerate(areas):
        w = f"areas[{i}]"
        if not isinstance(a, dict):
            err(rel, f"{w}: must be an object")
            continue
        aid = a.get("id")
        if not isinstance(aid, str) or not SLUG.match(aid):
            err(rel, f"{w}: id must be lowercase letters, digits and hyphens")
        elif aid in ids:
            err(rel, f"{w}: duplicate id '{aid}'")
        else:
            ids.add(aid)
        if not isinstance(a.get("name"), str) or not a["name"].strip():
            err(rel, f"{w}: name is required (English spelling)")
        if not isinstance(a.get("source"), str) or not a["source"].strip():
            err(rel, f"{w}: 'source' is required (where the boundary came from, with its licence, "
                     "or why there is no boundary yet)")
        if "boundary" in a:
            check_polygon(a["boundary"], f"{w}.boundary", rel)
        else:
            no_boundary.append(aid)
        kind = a.get("kind")
        if kind not in ("city", "station", "ward"):
            err(rel, f"{w}: kind must be city, station or ward")
        elif kind == "ward" and not (is_int(a.get("number")) and 1 <= a["number"] <= 99):
            err(rel, f"{w}: a ward needs its number")
        kinds[aid] = kind
    for i, a in enumerate(areas):
        if isinstance(a, dict) and "part_of" in a:
            po = a["part_of"]
            if not isinstance(po, list) or not all(isinstance(x, str) for x in po):
                err(rel, f"areas[{i}].part_of must be a list of area ids")
                continue
            for x in po:
                if x == a.get("id"):
                    err(rel, f"areas[{i}] ('{x}') cannot be part of itself")
                elif x not in ids:
                    err(rel, f"areas[{i}].part_of: '{x}' is not in areas.json")
                else:
                    want = {"station": "city", "ward": "station"}.get(a.get("kind"))
                    if want and kinds.get(x) != want:
                        err(rel, f"areas[{i}] ('{a.get('id')}'): a {a.get('kind')} must be part of a {want}")
        elif isinstance(a, dict) and a.get("kind") in ("station", "ward"):
            err(rel, f"areas[{i}] ('{a.get('id')}'): part_of is required for a {a.get('kind')}")
    if [k for k in kinds.values() if k == "city"] != ["city"]:
        err(rel, "there must be exactly one area of kind city (the City Corporation)")
    if no_boundary:
        warn(rel, f"{len(no_boundary)} of {len(areas)} areas have no boundary yet, so they can only be matched by name")
    return ids


# ---------------------------------------------------------------- prices

def money_map(menu):
    """Every amount of money a customer relies on, keyed by a stable id."""
    m = {}
    for it in menu.get("items") or []:
        if not isinstance(it, dict) or not isinstance(it.get("id"), str):
            continue
        if "price" in it:
            m[f"item:{it['id']}"] = it["price"]
        for op in it.get("options") or []:
            if isinstance(op, dict) and isinstance(op.get("id"), str):
                m[f"item:{it['id']}:{op['id']}"] = op.get("price")
    delivery = menu.get("delivery")
    for z in (delivery.get("zones") if isinstance(delivery, dict) else None) or []:
        if isinstance(z, dict) and isinstance(z.get("id"), str):
            m[f"zone:{z['id']}:fee"] = z.get("fee")
            m[f"zone:{z['id']}:min_order"] = z.get("min_order")
    return m


def diff_money(old, new):
    """Changes needed to get from the old money map to the new one."""
    out = []
    for k in sorted(set(old) | set(new)):
        if old.get(k) != new.get(k):
            out.append({"key": k, "old": old.get(k), "new": new.get(k)})
    return out


def change_set(changes):
    return {(c.get("key"), c.get("old"), c.get("new")) for c in changes if isinstance(c, dict)}


def parse_stamp(s):
    try:
        return datetime.fromisoformat(s)
    except (TypeError, ValueError):
        return None


def check_announcement(data, rel, label="announcement"):
    a = data.get(label)
    if not isinstance(a, dict):
        err(rel, f"'{label}' is required (SPEC.md section 5.4)")
        return None
    if not (isinstance(a.get("published"), str) and STAMP.match(a["published"]) and parse_stamp(a["published"])):
        err(rel, f"{label}.published must be a date and time with an offset, like 2026-10-15T09:00:00+06:00")
    if not isinstance(a.get("summary"), str) or not a["summary"].strip():
        err(rel, f"{label}.summary is required (plain text, one or two sentences)")
    ch = a.get("changes")
    if not isinstance(ch, list):
        err(rel, f"{label}.changes must be a list")
        return None
    for i, c in enumerate(ch):
        if not (isinstance(c, dict) and isinstance(c.get("key"), str) and isinstance(c.get("label"), str)
                and (c.get("old") is None or is_int(c["old"])) and (c.get("new") is None or is_int(c["new"]))):
            err(rel, f"{label}.changes[{i}] needs key, label, old and new (whole taka or null)")
    return a


def check_version_chain(menu_dir, root):
    """SPEC.md section 5.4: kept versions, hash chain, announced changes, append-only history."""
    rel = menu_dir.relative_to(root)
    vdir = menu_dir / "versions"
    if not vdir.is_dir():
        err(rel, "versions/ folder is required (every menu version is kept)")
        return
    files = {}
    for p in vdir.glob("*.json"):
        if p.stem.isdigit():
            files[int(p.stem)] = p
    if not files:
        err(rel, "versions/ has no N.json files")
        return
    nums = sorted(files)
    if nums != list(range(1, nums[-1] + 1)):
        err(rel, f"versions must be numbered 1..{nums[-1]} with no gaps, found {nums}")
        return
    latest_bytes = files[nums[-1]].read_bytes()
    mp = menu_dir / "menu.json"
    if not mp.exists() or mp.read_bytes() != latest_bytes:
        err(rel, f"menu.json must be byte-for-byte the same as versions/{nums[-1]}.json")
    prev = None
    prev_bytes = None
    prev_when = None
    for n in nums:
        vrel = files[n].relative_to(root)
        raw = files[n].read_bytes()
        try:
            cur = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as e:
            err(vrel, f"not valid JSON ({e})")
            return
        if cur.get("version") != n:
            err(vrel, f"'version' is {cur.get('version')!r} but the file is {n}.json")
        if prev is not None and cur.get("id") != prev.get("id") and cur.get("replaces") != prev.get("id"):
            err(vrel, "id changed between versions without 'replaces' naming the old id")
        ann = cur.get("announcement") if isinstance(cur.get("announcement"), dict) else {}
        when = parse_stamp(ann.get("published"))
        if prev is None:
            if n != 1:
                err(vrel, "first version found is not 1")
            if ann.get("changes") not in ([], None):
                err(vrel, "version 1 has nothing to compare with: announcement.changes must be empty")
            if cur.get("price_history") != []:
                err(vrel, "version 1 must have price_history: []")
            if cur.get("previous") not in (None, ""):
                err(vrel, "version 1 must not have 'previous'")
        else:
            want_prev = hashlib.sha256(prev_bytes).hexdigest()
            if cur.get("previous") != want_prev:
                err(vrel, f"'previous' must be the SHA-256 of versions/{n - 1}.json ({want_prev})")
            real = diff_money(money_map(prev), money_map(cur))
            declared = ann.get("changes") if isinstance(ann.get("changes"), list) else []
            if change_set(declared) != change_set(real):
                missing = change_set(real) - change_set(declared)
                extra = change_set(declared) - change_set(real)
                if missing:
                    err(vrel, f"price changes NOT announced: {sorted(missing, key=str)}")
                if extra:
                    err(vrel, f"announcement lists changes that did not happen: {sorted(extra, key=str)}")
            prior_hist = prev.get("price_history") if isinstance(prev.get("price_history"), list) else []
            expected = list(prior_hist)
            if declared:
                expected.append({"version": n, "published": ann.get("published"),
                                 "summary": ann.get("summary"), "changes": declared})
            if cur.get("price_history") != expected:
                err(vrel, "price_history must be the earlier history plus this version's announced changes. "
                          "Earlier entries cannot be edited or removed.")
            if when and prev_when and when < prev_when:
                err(vrel, "announcement.published is earlier than the previous version's")
        prev, prev_bytes, prev_when = cur, raw, when or prev_when


# ---------------------------------------------------------------- photos

def check_photos(photos, where, rel):
    if photos is None:
        return
    if not isinstance(photos, list):
        err(rel, f"{where} must be a list")
        return
    if len(photos) > PHOTO_MAX_COUNT:
        err(rel, f"{where}: at most {PHOTO_MAX_COUNT} photos")
    for i, ph in enumerate(photos):
        w = f"{where}[{i}]"
        if not isinstance(ph, dict):
            err(rel, f"{w} must be an object")
            continue
        if not isinstance(ph.get("alt"), str) or not ph["alt"].strip():
            err(rel, f"{w}.alt is required (plain description of the photo)")
        src = ph.get("sources")
        if not isinstance(src, list) or not src:
            err(rel, f"{w}.sources needs at least one https address of the image file itself")
        else:
            for s in src:
                if not (isinstance(s, str) and s.startswith("https://")):
                    err(rel, f"{w}.sources must be https addresses, got {s!r}")
        if not isinstance(ph.get("sha256"), str) or not HEX64.match(ph["sha256"]):
            err(rel, f"{w}.sha256 must be the 64-character lowercase hex SHA-256 of the exact image bytes")
        for f in ("width", "height"):
            v = ph.get(f)
            if not is_int(v) or not (0 < v <= PHOTO_MAX_SIDE):
                err(rel, f"{w}.{f} must be a whole number from 1 to {PHOTO_MAX_SIDE}")
        b = ph.get("bytes")
        if not is_int(b) or not (0 < b <= PHOTO_MAX_BYTES):
            err(rel, f"{w}.bytes must be a whole number from 1 to {PHOTO_MAX_BYTES}")


# ---------------------------------------------------------------- menu

def temp_id(name, phone):
    """Temporary id of a volunteer-entered listing. Name and phone only, so fixing the
    neighbourhood later does not change the id."""
    return hashlib.sha256(f"{name.strip().lower()}|{phone}".encode("utf-8")).hexdigest()


def check_menu(menu_path, root, area_ids):
    rel = menu_path.relative_to(root)
    data = load_json(menu_path, root)
    if not isinstance(data, dict):
        return None
    walk_strings(data, "menu", rel)
    rid = menu_path.parent.name
    claimed = data.get("claimed")
    if not isinstance(claimed, bool):
        err(rel, "'claimed' must be true or false (false = listed by a volunteer, not yet claimed by the owner)")
        claimed = True
    if data.get("id") != rid:
        err(rel, f"id must match the folder name '{rid}'")
    if not is_int(data.get("version")) or data["version"] < 1:
        err(rel, "version must be a whole number, 1 or more")
    for f in ("name", "neighbourhood", "address"):
        if not isinstance(data.get(f), str) or not data[f].strip():
            err(rel, f"'{f}' is required")
    if area_ids and data.get("neighbourhood") not in area_ids:
        err(rel, f"neighbourhood '{data.get('neighbourhood')}' is not in areas.json")
    phone = data.get("business_phone")
    if not isinstance(phone, str) or not BIZ_PHONE.match(phone):
        err(rel, "business_phone is required, written like +8801XXXXXXXXX (no spaces)")
    if not claimed:
        if not (isinstance(data.get("name"), str) and isinstance(phone, str)
                and data.get("id") == temp_id(data["name"], phone)):
            err(rel, "an unclaimed listing's id must be SHA-256 of lowercase 'name|business_phone'")
        if not isinstance(data.get("listing_note"), str) or not data["listing_note"].strip():
            err(rel, "unclaimed listings need a listing_note saying who entered it, from what, and that the "
                     "restaurant has not confirmed it")
        if data.get("signature") not in (None, ""):
            err(rel, "an unclaimed listing has no owner, so it cannot carry an owner signature")
    else:
        if not HEX64.match(str(data.get("id", ""))):
            err(rel, "a claimed listing's id must be the 64-character hash of the owner's public key")
        if not isinstance(data.get("signature"), str) or not data["signature"]:
            err(rel, "signature is required for a claimed listing (not verified yet by this tool)")
    loc = data.get("location")
    if isinstance(loc, dict):
        lat, lon = loc.get("lat"), loc.get("lon")
        if not (is_num(lat) and is_num(lon) and LAT_RANGE[0] <= lat <= LAT_RANGE[1]
                and LON_RANGE[0] <= lon <= LON_RANGE[1]):
            err(rel, "location lat/lon missing or outside Bangladesh (check the order)")
        elif data.get("plus_code"):
            pc = data["plus_code"]
            if not (isinstance(pc, str) and PLUS_FULL.match(pc)):
                err(rel, "plus_code must be a full Plus Code like 7MJH9R66+7MF")
            else:
                plat, plon = olc_decode_full(pc)
                if abs(plat - lat) > 0.0006 or abs(plon - lon) > 0.0006:
                    err(rel, f"location does not match plus_code (the code decodes to {plat:.6f}, {plon:.6f})")
    elif loc is not None:
        err(rel, "location must be an object with lat and lon")
    hours = data.get("hours")
    if hours is None and not claimed:
        pass  # "hours not stated" is allowed for an unclaimed listing
    elif not isinstance(hours, dict) or set(hours) != set(DAYS):
        err(rel, "hours must have exactly the keys mon, tue, wed, thu, fri, sat, sun")
    else:
        for d in DAYS:
            spans = hours[d]
            if not isinstance(spans, list):
                err(rel, f"hours.{d} must be a list (empty means closed)")
                continue
            for s in spans:
                if not (isinstance(s, list) and len(s) == 2 and all(isinstance(t, str) and TIME.match(t) for t in s)):
                    err(rel, f"hours.{d}: each span must be [\"HH:MM\", \"HH:MM\"] in 24-hour time")
                elif s[0] == s[1]:
                    err(rel, f"hours.{d}: start and end are the same. An end earlier than the start "
                             "means closing after midnight, for example [\"19:00\", \"04:00\"]")
    delivery = data.get("delivery")
    zones = delivery.get("zones") if isinstance(delivery, dict) else None
    zone_ids = set()
    if not isinstance(zones, list) or not zones:
        err(rel, "delivery.zones is required (at least one zone)")
    else:
        for i, z in enumerate(zones):
            w = f"delivery.zones[{i}]"
            if not isinstance(z, dict):
                err(rel, f"{w}: must be an object")
                continue
            zid = z.get("id")
            if not isinstance(zid, str) or not SLUG.match(zid):
                err(rel, f"{w}.id is required (lowercase letters, digits and hyphens)")
            elif zid in zone_ids:
                err(rel, f"{w}: duplicate zone id '{zid}'")
            else:
                zone_ids.add(zid)
            for f in ("fee", "min_order", "eta_min"):
                v = z.get(f)
                if v is None and not claimed:
                    continue  # "not stated" is allowed for an unclaimed listing
                if not is_int(v) or v < 0:
                    err(rel, f"{w}.{f} must be a whole number, 0 or more (whole taka, no decimals)")
            shape = z.get("shape")
            if shape == "named":
                names = z.get("areas")
                if not isinstance(names, list) or not names:
                    err(rel, f"{w}: 'areas' must be a non-empty list")
                else:
                    for n in names:
                        if area_ids and n not in area_ids:
                            err(rel, f"{w}: area '{n}' is not in areas.json")
            elif shape == "circle":
                if not (is_num(z.get("lat")) and is_num(z.get("lon"))
                        and LAT_RANGE[0] <= z["lat"] <= LAT_RANGE[1] and LON_RANGE[0] <= z["lon"] <= LON_RANGE[1]):
                    err(rel, f"{w}: circle needs lat and lon inside Bangladesh")
                if not is_num(z.get("radius_m")) or not (0 < z["radius_m"] <= 30000):
                    err(rel, f"{w}: radius_m must be more than 0 and at most 30000")
            elif shape == "polygon":
                check_polygon(z.get("geojson"), f"{w}.geojson", rel)
            else:
                err(rel, f"{w}: shape must be named, circle or polygon")
    pledges = data.get("pledges")
    for p in ("rider_identity", "data_handling"):
        entry = pledges.get(p) if isinstance(pledges, dict) else None
        if not isinstance(entry, dict) or not isinstance(entry.get("signed"), bool):
            err(rel, f"pledge '{p}' must be present with signed true or false (SPEC.md section 7)")
        elif claimed and entry["signed"] is not True:
            err(rel, f"pledge '{p}' must be signed by the owner for a claimed listing")
        elif not claimed and entry["signed"] is True:
            err(rel, f"pledge '{p}' cannot be signed on an unclaimed listing: only the owner can sign it")
    contact = data.get("contact")
    if not isinstance(contact, list) or not contact:
        err(rel, "contact needs at least one channel (SMS or phone is the baseline)")
    items = data.get("items")
    seen_items = set()
    if not isinstance(items, list) or not items:
        err(rel, "items must be a non-empty list")
    else:
        for i, it in enumerate(items):
            w = f"items[{i}]"
            if not isinstance(it, dict):
                err(rel, f"{w}: must be an object")
                continue
            iid = it.get("id")
            if not isinstance(iid, str) or not SLUG.match(iid):
                err(rel, f"{w}.id is required (lowercase letters, digits and hyphens, stable over time)")
            elif iid in seen_items:
                err(rel, f"{w}: duplicate item id '{iid}'")
            else:
                seen_items.add(iid)
            if not isinstance(it.get("name"), str) or not it["name"].strip():
                err(rel, f"{w}: name is required")
            has_price, has_opts = "price" in it, "options" in it
            if has_price == has_opts:
                err(rel, f"{w}: give either 'price' or 'options', not both and not neither")
            if has_price and (not is_int(it["price"]) or it["price"] < 0):
                err(rel, f"{w}.price must be a whole number of taka, 0 or more (no decimals)")
            if has_opts:
                opts = it["options"]
                if not isinstance(opts, list) or len(opts) < 2:
                    err(rel, f"{w}.options needs at least two options (use 'price' for a single price)")
                else:
                    oids = set()
                    for j, op in enumerate(opts):
                        ow = f"{w}.options[{j}]"
                        if not (isinstance(op, dict) and isinstance(op.get("id"), str) and SLUG.match(op["id"])
                                and isinstance(op.get("label"), str) and op["label"].strip()):
                            err(rel, f"{ow} needs an id (slug) and a label")
                            continue
                        if op["id"] in oids:
                            err(rel, f"{ow}: duplicate option id '{op['id']}'")
                        oids.add(op["id"])
                        if not is_int(op.get("price")) or op["price"] < 0:
                            err(rel, f"{ow}.price must be a whole number of taka, 0 or more")
            check_photos(it.get("photos"), f"{w}.photos", rel)
    check_photos(data.get("photos"), "photos", rel)
    check_announcement(data, rel)
    ph = data.get("price_history")
    if not isinstance(ph, list):
        err(rel, "price_history is required (a list, empty for version 1)")
    return data


def check_index(root, area_ids):
    data = load_json(root / "index.json", root)
    if not isinstance(data, dict):
        return
    rel = "index.json"
    if data.get("city") != "Chittagong":
        err(rel, 'city must be exactly "Chittagong"')
    rs = data.get("restaurants")
    if not isinstance(rs, list):
        err(rel, "'restaurants' must be a list")
        return
    seen = set()
    for i, r in enumerate(rs):
        w = f"restaurants[{i}]"
        if not isinstance(r, dict):
            err(rel, f"{w}: must be an object")
            continue
        walk_strings(r, w, rel)
        rid = r.get("id")
        if not isinstance(rid, str) or not HEX64.match(rid):
            err(rel, f"{w}: id must be a 64-character lowercase hex hash")
        elif rid in seen:
            err(rel, f"{w}: duplicate id (merge, do not repeat)")
        else:
            seen.add(rid)
        if not isinstance(r.get("name"), str) or not r["name"].strip():
            err(rel, f"{w}: name is required")
        if area_ids and r.get("neighbourhood") not in area_ids:
            err(rel, f"{w}: neighbourhood '{r.get('neighbourhood')}' is not in areas.json")
        mh = r.get("menu_hash")
        if not isinstance(mh, str) or not HEX64.match(mh):
            err(rel, f"{w}: menu_hash must be a 64-character lowercase hex SHA-256")
        locs = r.get("locations")
        if not isinstance(locs, list) or not locs:
            err(rel, f"{w}: at least one location is required")
        else:
            for L in locs:
                ok = isinstance(L, str) and (L.startswith("https://") or
                                             (RELATIVE_LOCATION.match(L) and ".." not in L and "://" not in L))
                if not ok:
                    err(rel, f"{w}: locations must be https addresses or a path inside this repo, got {L!r}")
        mp = root / "menus" / str(rid) / "menu.json"
        if isinstance(rid, str) and mp.exists() and isinstance(mh, str):
            raw = mp.read_bytes()
            actual = hashlib.sha256(raw).hexdigest()
            if actual != mh:
                err(rel, f"{w}: menu_hash does not match menus/{rid}/menu.json (file hash is {actual})")
            try:
                menu = json.loads(raw.decode("utf-8"))
                if "claimed" in r and r["claimed"] != menu.get("claimed"):
                    err(rel, f"{w}: 'claimed' does not match the menu file")
                if "version" in r and r["version"] != menu.get("version"):
                    err(rel, f"{w}: 'version' does not match the menu file")
            except (ValueError, UnicodeDecodeError):
                pass


def check_peers(root):
    data = load_json(root / "peers.json", root)
    if isinstance(data, dict):
        for i, p in enumerate(data.get("peers") or []):
            url = p if isinstance(p, str) else (p.get("url") if isinstance(p, dict) else None)
            if not (isinstance(url, str) and url.startswith("https://")):
                err("peers.json", f"peers[{i}]: must be an https address")


def check_vouches(root):
    vdir = root / "vouches"
    vouchers = load_json(root / "vouchers.json", root)
    keys = set()
    if isinstance(vouchers, dict):
        for v in vouchers.get("vouchers") or []:
            if isinstance(v, dict) and isinstance(v.get("key"), str):
                keys.add(v["key"])
    if not vdir.is_dir():
        return
    for p in sorted(vdir.glob("*.json")):
        rel = p.relative_to(root)
        d = load_json(p, root)
        if not isinstance(d, dict):
            continue
        walk_strings(d, "vouch", rel)
        for f in ("restaurant_id", "voucher_key", "date", "signature"):
            if not isinstance(d.get(f), str) or not d[f]:
                err(rel, f"'{f}' is required")
        if isinstance(d.get("restaurant_id"), str) and not HEX64.match(d["restaurant_id"]):
            err(rel, "restaurant_id must be a 64-character lowercase hex hash")
        if keys and d.get("voucher_key") not in keys:
            err(rel, "voucher_key is not in vouchers.json")


def check_text_files(root):
    for p in sorted(root.rglob("*")):
        if not p.is_file() or p.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in p.relative_to(root).parts) or p.name in SKIP_FILES:
            continue
        rel = p.relative_to(root)
        try:
            text = p.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            warn(rel, "not UTF-8 text, skipped")
            continue
        low = text.lower()
        for w in FORBIDDEN_WORDS:
            if w.lower() in low:
                err(rel, 'uses the spelling this project never uses. Write "Chittagong".')
        in_menu = rel.parts[0] in ("menus", "tools")
        for m in LOCAL_OR_INTL_MOBILE.finditer(text):
            if in_menu:
                continue  # a restaurant's own business number belongs in its menu
            warn(rel, f"looks like a mobile number ({m.group(0)[:6]}...). Only a restaurant's own "
                      "business number belongs in this repo. Remove any customer or rider number.")
            break



# ---------------------------------------------------------------- interface uniformity (theme/UNIFORMITY.md)

UI_CLASSES = set("""active badge bold border bottom brand brand-mark brand-name button card-title center-align checkbox
chip circle dark field fill flush gap-top group-title l label left left-align link list m max medium muted no-border
no-elevate no-space overline-label page-title prefix price primary-container radio responsive right-align round row s
section-title small small-space small-text snackbar space suffix surface-container-high surface-container-highest switch
tertiary-container textarea top-align transparent vertical vertical-padding wrap""".split())


def check_ui(root):
    """Allowed classes only, no inline styles, no Beer CSS margin helpers."""
    for rel in ("index.html", "app.js"):
        p = root / rel
        if not p.exists():
            continue
        text = p.read_text(encoding="utf-8")
        found = []
        for m in re.finditer(r'class="([^"]*)"', text):
            found += m.group(1).split()
        for m in re.finditer(r'class:\s*([^,}]+)', text):
            for q in re.finditer(r'(={2,3}\s*)?"([^"]*)"(\s*\?)?', m.group(1)):
                if not q.group(1) and not q.group(3):  # skip strings that are compared, not used as classes
                    found += q.group(2).split()
        for m in re.finditer(r'classList\.(?:add|toggle|remove)\("([^"]+)"', text):
            found.append(m.group(1))
        for c in sorted(set(found)):
            if "margin" in c:
                err(rel, f"class '{c}': Beer CSS margin helpers are not used (theme/UNIFORMITY.md, Spacing)")
            elif c not in UI_CLASSES:
                err(rel, f"class '{c}' is not in the allowed list (theme/UNIFORMITY.md)")
        if re.search(r'style="|style:\s*"', text):
            err(rel, "inline styles are not allowed (theme/UNIFORMITY.md, Spacing)")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default=".", help="repo root to check")
    root = Path(ap.parse_args().root).resolve()
    area_ids = check_areas(root)
    check_index(root, area_ids)
    check_peers(root)
    mdir = root / "menus"
    if mdir.is_dir():
        for d in sorted(p for p in mdir.iterdir() if p.is_dir()):
            if (d / "menu.json").exists() or (d / "versions").exists():
                check_menu(d / "menu.json", root, area_ids)
                check_version_chain(d, root)
    check_vouches(root)
    check_text_files(root)
    check_ui(root)
    for line in WARNINGS + ERRORS:
        print(line)
    print()
    print(f"{len(ERRORS)} error(s), {len(WARNINGS)} warning(s).")
    print("NOTE: signatures are not verified yet. A pass means well-formed, not authentic.")
    sys.exit(1 if ERRORS else 0)


if __name__ == "__main__":
    main()
