import os
import requests
from bs4 import BeautifulSoup
import csv
import time
import random
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

# 全局共享状态（多线程并发下的线程安全数据结构）
_books_lock = threading.Lock()        # 保护共享 books 列表
_seen_lock = threading.Lock()         # 保护去重集合
_progress_lock = threading.Lock()     # 保护进度上报，避免输出交错
_last_progress = [-1]                 # 记录上次上报的进度，避免重复打印

HEADERS_LIST = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/114.0.1823.51',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
]

TOTAL_BOOKS = 1000


def _report_progress(count):
    """线程安全地上报采集进度，仅在百分比变化时打印。"""
    pct = int(count / TOTAL_BOOKS * 100)
    with _progress_lock:
        if pct > _last_progress[0]:
            _last_progress[0] = pct
            print(f"Progress:{pct}", flush=True)


def _is_target_reached(books):
    """判断是否已达到采集总量。"""
    with _books_lock:
        return len(books) >= TOTAL_BOOKS


def _add_book(books, seen_titles, book):
    """线程安全地追加图书并执行去重。返回是否为新增记录。"""
    title = book.get('title')
    if not title:
        return False
    with _seen_lock:
        if title in seen_titles:
            return False
        seen_titles.add(title)
    with _books_lock:
        books.append(book)
    _report_progress(len(books))
    return True


def _parse_one_item(item, tag):
    """解析单个 .subject-item DOM 节点为结构化字段。"""
    title = item.select_one('.info h2 a')['title'].strip()
    pub_info = item.select_one('.pub').get_text().strip().split('/')
    author = pub_info[0].strip()
    publisher = pub_info[-3].strip() if len(pub_info) >= 3 else '未知'
    rating_node = item.select_one('.rating_nums')
    rating = rating_node.get_text().strip() if rating_node else '0.0'
    return {
        'title': title,
        'author': author,
        'publisher': publisher,
        'rating': rating,
        'category': tag  # 保留图书品类字段，支撑多维度统计分析
    }


def scrape_one_tag(tag, books, seen_titles):
    """抓取单个 tag（品类）下的所有分页。每个 tag 内部串行翻页，
    tag 之间由线程池并发执行，兼顾采集效率与豆瓣反爬限制。"""
    page = 0
    while not _is_target_reached(books):
        headers = {'User-Agent': random.choice(HEADERS_LIST)}
        url = f"https://book.douban.com/tag/{tag}?start={page*20}"
        try:
            response = requests.get(url, headers=headers, timeout=15)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            items = soup.select('.subject-item')
            if not items:
                break  # 该 tag 没有更多数据

            for item in items:
                if _is_target_reached(books):
                    break
                try:
                    _add_book(books, seen_titles, _parse_one_item(item, tag))
                except Exception as e:
                    print(f"Error parsing book item: {e}")
                    continue

            page += 1
            time.sleep(random.uniform(2, 5))  # 单 tag 翻页延迟，降低被封风险
        except Exception as e:
            print(f"Error scraping {tag} page {page}: {e}")
            time.sleep(10)
            continue


def scrape_douban_books():
    tags = ['小说', '文学', '历史', '哲学', '科技', '传记', '经济', '艺术']
    books = []
    seen_titles = set()

    data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
    os.makedirs(data_dir, exist_ok=True)

    # 多 tag 并发抓取：线程池控制并发度，避免对目标站点压力过大
    max_workers = min(len(tags), 5)
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(scrape_one_tag, tag, books, seen_titles)
            for tag in tags
        ]
        for fut in as_completed(futures):
            try:
                fut.result()
            except Exception as e:
                print(f"Task error: {e}")

    csv_path = os.path.join(data_dir, 'books.csv')
    with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.DictWriter(
            f, fieldnames=['title', 'author', 'publisher', 'rating', 'category']
        )
        writer.writeheader()
        writer.writerows(books)

    print(f"Total scraped: {len(books)}", flush=True)
    print("Progress:100", flush=True)


if __name__ == '__main__':
    scrape_douban_books()