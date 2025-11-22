import sqlite3
import pandas as pd
from collections import Counter
import json
from pathlib import Path

CSV_PATH = "data/elections/hackathon_1.csv"
DB_PATH = "elections.db"

def load_csv(path: str) -> pd.DataFrame:
    df = pd.read_csv(path)

    def make_payee_name(row):
        etype = str(row.get("entity_type", "")).upper()
        if etype == "ORG":
            return str(row.get("payee_last_name", "")).strip()
        first = str(row.get("payee_first_name") or "").strip()
        last = str(row.get("payee_last_name") or "").strip()
        return (first + " " + last).strip() or last

    df["payee_name_clean"] = df.apply(make_payee_name, axis=1)
    df["committee_name"] = df["committee_name"].astype(str).str.strip()
    df["payee_name_clean"] = df["payee_name_clean"].astype(str).str.strip()

    df["candidate_name"] = df.get("candidate_name", "").astype(str).str.strip()
    df["candidate_party"] = df.get("candidate_party", "").astype(str).str.strip()

    if "expenditure_amount" not in df.columns:
        raise ValueError("CSV missing 'expenditure_amount' column.")

    df = df[~df["expenditure_amount"].isna()]
    df = df[df["expenditure_amount"] != 0]
    df = df[df["committee_name"] != ""]
    df = df[df["payee_name_clean"] != ""]

    return df

def normalize_party(raw_party: str | None) -> str | None:
    if not raw_party:
        return None
    up = raw_party.upper()
    if "DEM" in up or up == "D":
        return "D"
    if "REP" in up or up == "R":
        return "R"
    return raw_party

def init_db(db_path: str):
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    schema_sql = """
    CREATE TABLE IF NOT EXISTS raw_disbursements (
        id INTEGER PRIMARY KEY,
        committee_id TEXT,
        committee_name TEXT,
        expenditure_amount REAL,
        expenditure_date TEXT,
        payee_first_name TEXT,
        payee_last_name TEXT,
        entity_type TEXT,
        candidate_id TEXT,
        candidate_name TEXT,
        candidate_office TEXT,
        candidate_office_state TEXT,
        candidate_office_district TEXT,
        candidate_party TEXT,
        raw_json TEXT
    );

    CREATE TABLE IF NOT EXISTS entities (
        id INTEGER PRIMARY KEY,
        name TEXT UNIQUE,
        type TEXT,
        party TEXT,
        notes TEXT
    );

    CREATE TABLE IF NOT EXISTS edges (
        id INTEGER PRIMARY KEY,
        source_entity_id INTEGER,
        target_entity_id INTEGER,
        relation_type TEXT,
        total_amount REAL,
        first_date TEXT,
        last_date TEXT,
        FOREIGN KEY (source_entity_id) REFERENCES entities(id),
        FOREIGN KEY (target_entity_id) REFERENCES entities(id)
    );
    """
    cur.executescript(schema_sql)
    conn.commit()
    return conn

def insert_raw_disbursements(conn, df: pd.DataFrame):
    cur = conn.cursor()
    cols = [
        "committee_id", "committee_name",
        "expenditure_amount", "expenditure_date",
        "payee_first_name", "payee_last_name",
        "entity_type",
        "candidate_id", "candidate_name",
        "candidate_office", "candidate_office_state",
        "candidate_office_district", "candidate_party"
    ]

    for _, row in df.iterrows():
        values = [row.get(c, None) for c in cols]
        raw_json = json.dumps(row.to_dict(), default=str)
        cur.execute("""
            INSERT INTO raw_disbursements (
                committee_id, committee_name,
                expenditure_amount, expenditure_date,
                payee_first_name, payee_last_name,
                entity_type,
                candidate_id, candidate_name,
                candidate_office, candidate_office_state,
                candidate_office_district, candidate_party,
                raw_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, values + [raw_json])
    conn.commit()

def upsert_entity(cur, name: str, type_: str, party: str = None, notes: str = None):
    cur.execute(
        "INSERT OR IGNORE INTO entities (name, type, party, notes) VALUES (?, ?, ?, ?)",
        (name, type_, party, notes)
    )
    cur.execute("SELECT id FROM entities WHERE name = ?", (name,))
    row = cur.fetchone()
    return row[0] if row else None

def build_entities(conn, df: pd.DataFrame):
    cur = conn.cursor()

    committees = df.groupby(["committee_id", "committee_name"])
    for (_, cname), group in committees:
        parties = [p for p in group["candidate_party"].unique() if p]
        party = normalize_party(Counter(parties).most_common(1)[0][0]) if parties else None
        upsert_entity(cur, cname, "committee", party)

    payees = df.groupby(["payee_name_clean", "entity_type"])
    for (pname, etype), _ in payees:
        if not pname: continue
        etype_clean = "company" if str(etype).upper() == "ORG" else "person"
        upsert_entity(cur, pname, etype_clean)

    candidates = df.groupby(["candidate_id", "candidate_name", "candidate_party"])
    for (_, cname, cparty), _ in candidates:
        if cname:
            upsert_entity(cur, cname, "candidate", normalize_party(cparty))

    conn.commit()

def build_edges(conn, df: pd.DataFrame):
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM entities")
    name_to_id = {name: id_ for id_, name in cur.fetchall()}

    grouped = df.groupby(["committee_name", "payee_name_clean"])
    for (cname, pname), group in grouped:
        sid = name_to_id.get(cname)
        tid = name_to_id.get(pname)
        if not sid or not tid:
            continue

        total_amount = float(group["expenditure_amount"].sum())
        dates = group["expenditure_date"].dropna().astype(str)
        first_date = dates.min() if not dates.empty else None
        last_date = dates.max() if not dates.empty else None

        cur.execute("""
            INSERT INTO edges (
                source_entity_id, target_entity_id,
                relation_type, total_amount, first_date, last_date
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (sid, tid, "spends_to", total_amount, first_date, last_date))

    conn.commit()

def main():
    df = load_csv(CSV_PATH)

    if Path(DB_PATH).exists():
        Path(DB_PATH).unlink()

    conn = init_db(DB_PATH)
    insert_raw_disbursements(conn, df)
    build_entities(conn, df)
    build_edges(conn, df)
    conn.close()

if __name__ == "__main__":
    main()
