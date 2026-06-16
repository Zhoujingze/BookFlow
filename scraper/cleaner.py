import os
import sys
import csv
import json

# 编码检测：对应简历"编码检测"。若未安装 chardet 则退化为 utf-8-sig（兼容 BOM）
try:
    import chardet
    HAS_CHARDET = True
except ImportError:
    HAS_CHARDET = False

BASE_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
INPUT_PATH = os.path.join(BASE_DIR, 'books.csv')
OUTPUT_PATH = os.path.join(BASE_DIR, 'books_clean.json')

_last_progress = [-1]


def report_progress(pct):
    """与爬虫一致的进度协议：仅在百分比变化时打印 Progress:数字"""
    if pct > _last_progress[0]:
        _last_progress[0] = pct
        print(f"Progress:{pct}", flush=True)


def detect_encoding(file_path):
    """检测 CSV 源文件编码，支撑稳健读取。"""
    if not HAS_CHARDET:
        return 'utf-8-sig'
    with open(file_path, 'rb') as f:
        raw = f.read(1024 * 1024)
    result = chardet.detect(raw) or {}
    enc = (result.get('encoding') or 'utf-8-sig').lower()
    # 中文 Windows 常见编码归并，避免 DictReader 解析失败
    if enc in ('gb2312', 'gbk', 'gb18030'):
        return 'gb18030'
    return 'utf-8-sig'


def norm_row(row):
    """规范化字典 key：去除 BOM 与首尾空白，兼容中英文列名。"""
    return {
        (str(k).lstrip('\ufeff').strip() if k else k): v
        for k, v in row.items()
    }


def pick(row, *keys):
    for k in keys:
        v = row.get(k)
        if v is not None and str(v).strip() != '':
            return v
    return ''


# ========== 规则引擎：与 Node 版本语义对齐 ==========

def validation_rules(row):
    """任一规则不满足即丢弃该行（噪声过滤）。"""
    if not str(pick(row, 'title', '书名', '图书名称')).strip():
        return False
    if not str(pick(row, 'author', '作者')).strip():
        return False
    try:
        float(pick(row, 'rating', '评分'))
    except (TypeError, ValueError):
        return False
    return True


def transform_rules(row):
    """结构化字段提取与归一化。"""
    rating = float(pick(row, 'rating', '评分') or 0)
    publisher = str(pick(row, 'publisher', '出版社')).strip() or '未知出版社'
    category = str(pick(row, 'category', '品类', '分类')).strip() or '未分类'
    return {
        'title': str(pick(row, 'title', '书名', '图书名称')).strip(),
        'author': ' '.join(str(pick(row, 'author', '作者')).split()),
        'publisher': publisher,
        'rating': f"{rating:.1f}",
        'category': category,
    }


def apply_rules(row):
    if not validation_rules(row):
        return None
    return transform_rules(row)


def main():
    if not os.path.exists(INPUT_PATH):
        print(f"输入文件不存在: {INPUT_PATH}", file=sys.stderr)
        sys.exit(1)

    encoding = detect_encoding(INPUT_PATH)
    print(f"检测到文件编码: {encoding}", file=sys.stderr)

    # 第一遍：统计总行数（用于进度计算）
    with open(INPUT_PATH, 'r', encoding=encoding, newline='') as f:
        total = sum(1 for _ in csv.DictReader(f))
    if total == 0:
        print("输入文件无数据行", file=sys.stderr)
        sys.exit(1)

    cleaned = []
    seen_titles = set()  # 重复项擦除

    # 第二遍：逐行应用规则引擎
    with open(INPUT_PATH, 'r', encoding=encoding, newline='') as f:
        reader = csv.DictReader(f)
        for i, raw in enumerate(reader):
            row = norm_row(raw)
            record = apply_rules(row)
            if record:
                # 重复项擦除（以标题为唯一键）
                if record['title'] not in seen_titles:
                    seen_titles.add(record['title'])
                    cleaned.append(record)
            report_progress(int((i + 1) / total * 100))

    # 序列化为轻量化 JSON 供上层消费
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)

    print(f"清洗完成，有效数据 {len(cleaned)} 条 -> {OUTPUT_PATH}", file=sys.stderr)
    report_progress(100)


if __name__ == '__main__':
    main()
