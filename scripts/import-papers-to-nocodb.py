"""
从 Excel 导入论文/作者数据到 NocoDB
用法: python3 scripts/import-papers-to-nocodb.py
"""
import pandas as pd
import json
import os
import sys
import time

# 从 .env.local 加载
env_path = os.path.join(os.path.dirname(__file__), "../.env.local")
if os.path.exists(env_path):
    for line in open(env_path):
        m = __import__("re").match(r"^([^#=]+)=(.*)$", line)
        if m:
            os.environ.setdefault(m.group(1).strip(), m.group(2).strip().strip('"').strip("'"))

NOCODB_URL = os.environ.get("NOCODB_URL", "http://localhost:8040")
NOCODB_TOKEN = os.environ.get("NOCODB_API_TOKEN", "")
NOCODB_BASE_ID = os.environ.get("NOCODB_BASE_ID", "")

if not NOCODB_TOKEN or not NOCODB_BASE_ID:
    print("请设置 NOCODB_API_TOKEN 和 NOCODB_BASE_ID")
    sys.exit(1)

HEADERS = {"xc-token": NOCODB_TOKEN, "Content-Type": "application/json"}

def api(method, path, body=None):
    url = f"{NOCODB_URL}{path}"
    import urllib.request
    req = urllib.request.Request(url, method=method, headers=HEADERS)
    if body is not None:
        req.data = json.dumps(body, ensure_ascii=False, default=str).encode("utf-8")
    try:
        with urllib.request.urlopen(req) as resp:
            text = resp.read().decode()
            return json.loads(text) if text and resp.status != 204 else None
    except urllib.error.HTTPError as e:
        print(f"  API Error {e.code}: {e.read().decode()[:200]}")
        raise

EXCEL = "/home/z/桌面/paper_db_airtable_ready.xlsx"

# ── 作者表字段 ──
AUTHOR_COLUMNS = [
    {"title": "作者ID", "column_name": "author_id", "uidt": "SingleLineText"},
    {"title": "中文名", "column_name": "author_name_cn", "uidt": "SingleLineText"},
    {"title": "英文名", "column_name": "author_name_en", "uidt": "SingleLineText"},
    {"title": "标准化名", "column_name": "author_name_norm", "uidt": "SingleLineText"},
    {"title": "课题组", "column_name": "group_name", "uidt": "SingleSelect",
     "colOptions": {"options": [{"title": "优化组"}, {"title": "体系组"}]}},
    {"title": "内部成员", "column_name": "is_internal", "uidt": "Checkbox"},
]

# ── 论文表字段 ──
def sel(opts):
    return {"options": [{"title": str(o)} for o in opts]}

PAPER_COLUMNS = [
    {"title": "论文ID", "column_name": "paper_id", "uidt": "Number", "meta": {"isLocaleStr": ""}},
    {"title": "英文标题", "column_name": "title_en", "uidt": "LongText"},
    {"title": "中文标题", "column_name": "title_cn", "uidt": "LongText"},
    {"title": "论文类型", "column_name": "paper_type", "uidt": "SingleSelect",
     "colOptions": sel(["journal", "conference"])},
    {"title": "课题组", "column_name": "group_name", "uidt": "SingleSelect",
     "colOptions": sel(["优化组", "体系组"])},
    {"title": "发表年份", "column_name": "publish_year", "uidt": "Number", "meta": {"isLocaleStr": ""}},
    {"title": "发表日期", "column_name": "publish_date", "uidt": "Date"},
    {"title": "会议开始日期", "column_name": "conference_start_date", "uidt": "Date"},
    {"title": "会议结束日期", "column_name": "conference_end_date", "uidt": "Date"},
    {"title": "期刊/会议名", "column_name": "venue_name", "uidt": "LongText"},
    {"title": "期刊/会议名(中)", "column_name": "venue_name_cn", "uidt": "SingleLineText"},
    {"title": "会议地点", "column_name": "conference_location", "uidt": "SingleLineText"},
    {"title": "DOI", "column_name": "doi", "uidt": "SingleLineText"},
    {"title": "收录类型", "column_name": "index_type", "uidt": "SingleSelect",
     "colOptions": sel(["SCI", "中文核心", "EI", "无", "其他"])},
    {"title": "发表状态", "column_name": "publication_status", "uidt": "SingleSelect",
     "colOptions": sel(["未刊出", "已刊出", "录用待刊"])},
    {"title": "归档状态", "column_name": "archive_status", "uidt": "SingleSelect",
     "colOptions": sel(["已归档", "未归档"])},
    {"title": "通讯作者", "column_name": "corresponding_authors", "uidt": "SingleLineText"},
    {"title": "单位排名", "column_name": "institution_rank", "uidt": "SingleLineText"},
    {"title": "基金编号", "column_name": "fund_project_no", "uidt": "SingleLineText"},
    {"title": "论文链接", "column_name": "paper_url", "uidt": "URL"},
    {"title": "卷", "column_name": "volume", "uidt": "SingleLineText"},
    {"title": "期", "column_name": "issue", "uidt": "SingleLineText"},
    {"title": "页码", "column_name": "pages", "uidt": "SingleLineText"},
    {"title": "影响因子", "column_name": "impact_factor", "uidt": "Decimal"},
    {"title": "ISSN/ISBN", "column_name": "issn_or_isbn", "uidt": "LongText"},
    {"title": "CCF等级", "column_name": "ccf_category", "uidt": "SingleSelect",
     "colOptions": sel(["无", "A", "B", "C"])},
    {"title": "CAS分区", "column_name": "cas_partition", "uidt": "SingleSelect",
     "colOptions": sel(["一区", "一区TOP", "二区", "三区", "四区", "无"])},
    {"title": "JCR分区", "column_name": "jcr_partition", "uidt": "SingleSelect",
     "colOptions": sel(["一区", "二区", "三区", "无"])},
    {"title": "SCI分区", "column_name": "sci_partition", "uidt": "SingleSelect",
     "colOptions": sel(["一区", "二区", "三区", "四区", "无"])},
]

def clean_val(v):
    if pd.isna(v):
        return None
    if isinstance(v, pd.Timestamp):
        return v.strftime("%Y-%m-%d")
    return str(v) if not isinstance(v, (int, float)) else v

def main():
    xls = pd.ExcelFile(EXCEL)
    authors_df = pd.read_excel(xls, "authors")
    papers_df = pd.read_excel(xls, "papers")
    pa_df = pd.read_excel(xls, "paper_author")

    print(f"数据: 作者 {len(authors_df)} | 论文 {len(papers_df)} | 关联 {len(pa_df)}\n")

    # 1. 创建作者表
    print("[1/6] 创建作者表...")
    author_tbl = api("POST", f"/api/v2/meta/bases/{NOCODB_BASE_ID}/tables", {
        "table_name": "作者", "title": "作者", "columns": AUTHOR_COLUMNS,
    })
    author_tbl_id = author_tbl["id"]
    print(f"  -> id={author_tbl_id}")

    # 2. 创建论文表
    print("[2/6] 创建论文表...")
    paper_tbl = api("POST", f"/api/v2/meta/bases/{NOCODB_BASE_ID}/tables", {
        "table_name": "论文", "title": "论文", "columns": PAPER_COLUMNS,
    })
    paper_tbl_id = paper_tbl["id"]
    print(f"  -> id={paper_tbl_id}")

    # 3. 导入作者
    print("[3/6] 导入作者记录...")
    BATCH = 50
    author_records = []
    for _, row in authors_df.iterrows():
        r = {
            "作者ID": clean_val(row.get("author_id")),
            "中文名": clean_val(row.get("author_name_cn")),
            "英文名": clean_val(row.get("author_name_en")),
            "标准化名": clean_val(row.get("author_name_norm")),
            "课题组": clean_val(row.get("group_name")),
            "内部成员": clean_val(row.get("is_internal")),
        }
        author_records.append({k: v for k, v in r.items() if v is not None})

    for i in range(0, len(author_records), BATCH):
        batch = author_records[i:i+BATCH]
        try:
            api("POST", f"/api/v2/tables/{author_tbl_id}/records", batch)
        except Exception:
            for r in batch:
                try:
                    api("POST", f"/api/v2/tables/{author_tbl_id}/records", [r])
                except Exception as e2:
                    print(f"  跳过: {r.get('作者ID')} {e2}")
        print(f"  -> {min(i+BATCH, len(author_records))}/{len(author_records)}")

    # 4. 导入论文
    print("[4/6] 导入论文记录...")
    FIELD_MAP = {
        "paper_id": "论文ID", "title_en": "英文标题", "title_cn": "中文标题",
        "paper_type": "论文类型", "group_name": "课题组", "publish_year": "发表年份",
        "publish_date": "发表日期", "conference_start_date": "会议开始日期",
        "conference_end_date": "会议结束日期", "venue_name": "期刊/会议名",
        "venue_name_cn": "期刊/会议名(中)", "conference_location": "会议地点",
        "doi": "DOI", "index_type": "收录类型", "publication_status": "发表状态",
        "archive_status": "归档状态", "corresponding_authors": "通讯作者",
        "institution_rank": "单位排名", "fund_project_no": "基金编号",
        "paper_url": "论文链接", "volume": "卷", "issue": "期", "pages": "页码",
        "impact_factor": "影响因子", "issn_or_isbn": "ISSN/ISBN",
        "ccf_category": "CCF等级", "cas_partition": "CAS分区",
        "jcr_partition": "JCR分区", "sci_partition": "SCI分区",
    }
    paper_records = []
    for _, row in papers_df.iterrows():
        r = {}
        for en, cn in FIELD_MAP.items():
            v = clean_val(row.get(en))
            if v is not None:
                r[cn] = v
        paper_records.append(r)

    for i in range(0, len(paper_records), BATCH):
        batch = paper_records[i:i+BATCH]
        try:
            api("POST", f"/api/v2/tables/{paper_tbl_id}/records", batch)
        except Exception:
            for r in batch:
                try:
                    api("POST", f"/api/v2/tables/{paper_tbl_id}/records", [r])
                except Exception as e2:
                    print(f"  跳过: 论文ID={r.get('论文ID')} {e2}")
        print(f"  -> {min(i+BATCH, len(paper_records))}/{len(paper_records)}")

    # 5. 创建 M:M Links 列
    print("[5/6] 创建论文↔作者 M:M 关联...")
    link_resp = api("POST", f"/api/v2/meta/tables/{paper_tbl_id}/columns", {
        "title": "作者",
        "column_name": "authors",
        "uidt": "Links",
        "parentId": author_tbl_id,
        "childId": paper_tbl_id,
        "type": "mm",
    })
    link_col = link_resp.get("columns", [link_resp])
    link_field_id = next((c["id"] for c in link_col if c.get("uidt") == "Links"), link_resp.get("id"))
    print(f"  -> 关联字段 id={link_field_id}")

    # 6. 建立关联
    print("[6/6] 建立论文↔作者关联...")
    # 获取 NocoDB 记录 ID 映射
    def get_all_records(table_id, key_field):
        records, offset = [], 0
        while True:
            batch = api("GET", f"/api/v2/tables/{table_id}/records?limit=100&offset={offset}")
            records.extend(batch["list"])
            if batch["pageInfo"]["isLastPage"]:
                break
            offset += 100
        return {r[key_field]: r["Id"] for r in records if r.get(key_field)}

    author_map = get_all_records(author_tbl_id, "作者ID")
    paper_map = get_all_records(paper_tbl_id, "论文ID")  # 论文ID是Number类型，返回int key
    # 同时保留str key方便匹配
    paper_map.update({str(k): v for k, v in paper_map.items()})
    print(f"  -> 映射: 论文 {len(paper_map)} | 作者 {len(author_map)}")

    linked = 0
    for _, row in pa_df.iterrows():
        pid = int(row["paper_id"])
        aid = row["author_id"]
        paper_noco_id = paper_map.get(pid)
        author_noco_id = author_map.get(aid)
        if not paper_noco_id or not author_noco_id:
            continue
        api("POST", f"/api/v2/tables/{paper_tbl_id}/links/{link_field_id}/records/{paper_noco_id}", [author_noco_id])
        linked += 1
        if linked % 100 == 0:
            print(f"  -> {linked}/{len(pa_df)}")

    print(f"\n完成! 作者 {len(author_records)} | 论文 {len(paper_records)} | 关联 {linked}")

if __name__ == "__main__":
    main()
