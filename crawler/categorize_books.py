"""
Categorize books from book.csv and generate category tables
Analyzes book titles and creates category classification system
"""

import csv
import re
from typing import List, Dict, Tuple
from collections import Counter


class BookCategorizer:
    """
    Handles book categorization based on title keywords
    Creates category and book-category relationship tables
    """
    
    def __init__(self):
        # Define categories with their keywords
        # Category ID: (Category Name, Keywords List)
        self.categories = {
            1: ("小說文學", [
                "小說", "文學", "詩", "詩集", "散文", "故事", "傳記", "回憶錄",
                "文學獎", "文學地景", "文學導賞", "文學地圖", "文學旅人",
                "村上春樹", "東野圭吾", "三毛", "金庸", "武俠", "奇幻", "科幻",
                "推理", "懸疑", "愛情", "言情", "BL", "耽美", "輕小說",
                "轉生", "重生", "穿越", "異世界", "冒險", "冒險記", "探險",
                "守則", "魔女", "勇者", "魔王", "史萊姆", "治療師", "對魔師",
                "間諜", "家家酒", "新娘", "殿下", "殿下", "殿下", "殿下",
                "挪威的森林", "幻夜", "馬爾他之鷹", "華氏451度", "人鼠之間"
            ]),
            2: ("語言學習", [
                "日語", "日文", "日本語", "日檢", "JLPT", "N1", "N2", "N3", "N4", "N5",
                "英語", "英文", "英文", "英文", "英文", "英文", "英文", "英文",
                "IELTS", "雅思", "TOEFL", "多益", "TOEIC", "英檢",
                "韓語", "韓文", "韓檢", "韓文單字", "時事韓語",
                "法語", "法文", "德語", "德文", "德檢",
                "西語", "西班牙語", "義大利語", "義大利人",
                "泰語", "泰國語", "俄語", "俄文", "俄語字母",
                "語言", "會話", "單字", "詞彙", "文法", "聽力", "閱讀",
                "自學", "自由行", "旅遊", "旅行", "觀光"
            ]),
            3: ("健康醫療", [
                "健康", "醫療", "醫學", "醫生", "醫師", "醫院", "診斷", "照護",
                "養生", "中醫", "中藥", "穴位", "經絡", "撥筋", "穴療",
                "懷孕", "產後", "育兒", "育嬰", "新手媽媽", "兒童", "青少年",
                "癌症", "腫瘤", "肺癌", "飲食指導", "對症蔬療",
                "心臟", "胃病", "胃食道逆流", "胃酸", "膝蓋", "拇趾外翻",
                "細胞", "自噬", "大腦", "腦", "記憶", "專注力", "情緒",
                "睡眠", "休息", "體適能", "運動", "減肥", "瘦身",
                "順時鐘", "節氣", "養生智慧"
            ]),
            4: ("料理飲食", [
                "料理", "食譜", "烹飪", "烹調", "廚藝", "廚房", "做菜",
                "麵包", "烘焙", "點心", "甜點", "蛋糕", "餅乾",
                "刀工", "精準", "全魚", "魚", "海鮮",
                "家常", "家常菜", "便當", "午餐", "晚餐", "早餐",
                "香料", "調味", "漬物", "醃漬", "季節漬",
                "飲食", "美食", "餐廳", "小吃", "夜市",
                "素食", "蔬食", "營養", "營養午餐", "飲食法則"
            ]),
            5: ("商業理財", [
                "商業", "理財", "投資", "股票", "股市", "選股", "巴菲特",
                "金錢", "財務", "會計", "經濟", "金融", "銀行",
                "管理", "經營", "企業", "公司", "創業", "生意",
                "簡報", "工作法", "職場", "職場", "職場", "職場",
                "加班", "效率", "時間管理", "時間貧困",
                "博弈", "談判", "心理學", "暗黑心理學",
                "對帳單", "帳單", "金錢教室"
            ]),
            6: ("漫畫", [
                "漫畫", "漫畫版", "愛藏版", "新裝版", "特裝版",
                "BLEACH", "死神", "烏龍派出所", "俺是大哥大",
                "哨聲響起", "赤河戀影", "失憶投捕", "擅長逃跑的殿下",
                "BLUE LOCK", "藍色監獄", "SPY×FAMILY", "間諜家家酒",
                "五等分的新娘", "普通輕音社", "文豪Stray Dogs",
                "變色龍依戀掌心", "dear親愛的", "妃真與殿",
                "野莓", "百瀨同學", "少女魂畫師", "患上不出道就會死的病"
            ]),
            7: ("科學自然", [
                "科學", "數學", "物理", "化學", "生物", "自然", "自然科學",
                "方程式", "細胞", "圖鑑", "生物圖鑑", "動物圖鑑", "植物",
                "博物學", "博物學家", "地景", "地理", "地圖", "地圖集",
                "天文", "宇宙", "星球", "地球", "海洋", "河流", "山",
                "動物", "植物", "生態", "環境", "環保", "氣候",
                "設計史", "工程", "技術", "電腦", "程式", "軟體",
                "圖解", "圖鑑", "百科", "全書", "大全"
            ]),
            8: ("教育教材", [
                "教育", "教學", "教材", "課本", "課本", "教科書", "教材",
                "FUN學", "STEAM", "Preschool", "Grade", "閱讀課本",
                "考試", "模擬題", "題庫", "解析", "必考", "合格",
                "學習", "練習", "練習題", "習題", "作業",
                "老師", "教師", "教學", "教育方法", "育兒",
                "兒童", "幼兒", "學齡前", "小學", "中學", "高中",
                "套書", "系列", "全攻略", "完全解析"
            ])
        }
        
        # Default category for books that don't match any specific category
        self.default_category_id = 1  # 小說文學 as default
    
    def load_books(self, csv_path: str) -> List[Dict[str, str]]:
        """
        Load books from CSV file
        Returns list of book dictionaries
        """
        books = []
        try:
            # Try UTF-8 with BOM first, then fallback to UTF-8
            encodings = ['utf-8-sig', 'utf-8']
            
            for encoding in encodings:
                try:
                    with open(csv_path, 'r', encoding=encoding) as f:
                        reader = csv.DictReader(f)
                        
                        for row in reader:
                            # Handle BOM and whitespace in field names
                            row_clean = {}
                            for k, v in row.items():
                                # Remove BOM and strip whitespace
                                key_clean = k.strip().lstrip('\ufeff')
                                row_clean[key_clean] = v
                            
                            # Check if required fields exist
                            if 'book_id' not in row_clean or 'name' not in row_clean:
                                continue
                            
                            books.append({
                                'book_id': row_clean['book_id'].strip(),
                                'name': row_clean['name'].strip(),
                                'author': row_clean.get('author', '').strip(),
                                'publisher': row_clean.get('publisher', '').strip(),
                                'price': row_clean.get('price', '').strip()
                            })
                    
                    print(f"Loaded {len(books)} books from {csv_path}")
                    return books
                except UnicodeDecodeError:
                    continue
            
            # If all encodings failed
            raise ValueError("Could not decode CSV file with any encoding")
            
        except Exception as e:
            print(f"Error loading books: {e}")
            import traceback
            traceback.print_exc()
            raise
    
    def classify_book(self, book_name: str) -> int:
        """
        Classify a book based on its name
        Returns category_id
        """
        book_name_lower = book_name.lower()
        
        # Count matches for each category
        category_scores = {}
        
        for category_id, (category_name, keywords) in self.categories.items():
            score = 0
            for keyword in keywords:
                # Check if keyword appears in book name
                if keyword.lower() in book_name_lower:
                    score += 1
            category_scores[category_id] = score
        
        # Find category with highest score
        max_score = max(category_scores.values())
        
        if max_score > 0:
            # Return category with highest score
            best_category = [cat_id for cat_id, score in category_scores.items() 
                            if score == max_score][0]
            return best_category
        else:
            # No match found, use default category
            return self.default_category_id
    
    def categorize_all_books(self, books: List[Dict[str, str]]) -> List[Tuple[str, int]]:
        """
        Categorize all books
        Returns list of (book_id, category_id) tuples
        """
        classifications = []
        category_counts = Counter()
        
        for book in books:
            category_id = self.classify_book(book['name'])
            classifications.append((book['book_id'], category_id))
            category_counts[category_id] += 1
        
        # Print classification statistics
        print("\nClassification Statistics:")
        for category_id, count in sorted(category_counts.items()):
            category_name = self.categories[category_id][0]
            print(f"  {category_name} (ID: {category_id}): {count} books")
        
        return classifications
    
    def generate_categories_csv(self, output_path: str):
        """
        Generate categories.csv file
        """
        try:
            with open(output_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['category_id', 'name'])
                
                for category_id in sorted(self.categories.keys()):
                    category_name = self.categories[category_id][0]
                    writer.writerow([category_id, category_name])
            
            print(f"\nGenerated categories.csv: {output_path}")
        except Exception as e:
            print(f"Error generating categories.csv: {e}")
            raise
    
    def generate_book_category_csv(self, classifications: List[Tuple[str, int]], output_path: str):
        """
        Generate book_category.csv file
        """
        try:
            with open(output_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(['book_id', 'category_id'])
                
                for book_id, category_id in classifications:
                    writer.writerow([book_id, category_id])
            
            print(f"Generated book_category.csv: {output_path}")
        except Exception as e:
            print(f"Error generating book_category.csv: {e}")
            raise
    
    def process(self, input_csv: str, output_dir: str):
        """
        Main processing function
        Loads books, categorizes them, and generates output CSV files
        """
        print("Starting book categorization process...")
        
        # Load books
        books = self.load_books(input_csv)
        
        # Categorize all books
        classifications = self.categorize_all_books(books)
        
        # Generate output files
        categories_path = f"{output_dir}/categories.csv"
        book_category_path = f"{output_dir}/book_category.csv"
        
        self.generate_categories_csv(categories_path)
        self.generate_book_category_csv(classifications, book_category_path)
        
        print(f"\nProcess completed successfully!")
        print(f"Total books processed: {len(books)}")
        print(f"Categories created: {len(self.categories)}")


def main():
    """
    Main entry point
    """
    # File paths
    base_dir = "/Users/amy/Desktop/Uni/114 Third Year/Database/Final Project/README/爬書"
    input_csv = f"{base_dir}/book.csv"
    output_dir = base_dir
    
    # Create categorizer and process
    categorizer = BookCategorizer()
    categorizer.process(input_csv, output_dir)


if __name__ == "__main__":
    main()

