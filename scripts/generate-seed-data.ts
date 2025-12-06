/**
 * 假資料生成腳本
 * 生成 SQL 格式的假資料檔案，可直接在資料庫執行
 * 執行方式: npm run db:seed
 */

import * as fs from 'fs';
import * as path from 'path';

// Simple random number generator
function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomDate(daysAgo: number): string {
  const date = new Date();
  date.setDate(date.getDate() - randomInt(0, daysAgo));
  return date.toISOString().split('T')[0];
}

// Generate Chinese names
const surnames = ['張', '李', '王', '陳', '林', '黃', '吳', '劉', '周', '蔡', '楊', '許', '鄭', '謝', '洪'];
const givenNames = ['三', '四', '五', '明', '華', '強', '偉', '芳', '美', '麗', '靜', '敏', '建', '軍', '勇', '傑', '婷', '欣', '怡', '文'];

function generateChineseName(): string {
  return randomChoice(surnames) + randomChoice(givenNames);
}

function generatePhone(): string {
  return `09${randomInt(10000000, 99999999)}`;
}

function generateEmail(name: string): string {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'example.com'];
  return `${name.toLowerCase()}${randomInt(1, 999)}@${randomChoice(domains)}`;
}

// Book titles and authors
const bookTitles = [
  '百年孤獨', '1984', '紅樓夢', '三體', '解憂雜貨店',
  '人類大歷史', '思考，快與慢', '原則', '原子習慣', '深度工作力',
  '被討厭的勇氣', '烏合之眾', '資本論', '論語', '孫子兵法'
];

const authors = [
  '加西亞·馬奎斯', '喬治·歐威爾', '曹雪芹', '劉慈欣', '東野圭吾',
  '哈拉瑞', '丹尼爾·康納曼', '瑞·達利歐', '詹姆斯·克利爾', '卡爾·紐波特',
  '岸見一郎', '古斯塔夫·勒龐', '卡爾·馬克思', '孔子', '孫武'
];

const publishers = [
  '時報文化', '遠流出版', '聯經出版', '貓頭鷹出版', '皇冠文化',
  '天下文化', '商業周刊', '方智出版', '究竟出版', '三民書局',
  '商周出版', '麥田出版', '大塊文化', '久石文化', '經濟新潮社'
];

const categories = [
  '小說', '文學', '歷史', '科學', '商業',
  '心理學', '旅遊', '藝術', '哲學', '傳記',
  '教育', '科技'
];

// Generate data
function generateMembershipLevels(): string {
  return `-- ============================================
-- MEMBERSHIP_LEVEL - 會員等級資料
-- ============================================
INSERT INTO MEMBERSHIP_LEVEL (level_name, discount_rate, min_balance_required, max_book_allowed, hold_days) VALUES
('銅', 1.0, 500, 3, 7),
('銀', 0.92, 1500, 8, 14),
('金', 0.79, 3000, 15, 30);`;
}

function generateConditionDiscounts(): string {
  return `-- ============================================
-- CONDITION_DISCOUNT - 書況折扣資料
-- ============================================
INSERT INTO CONDITION_DISCOUNT (book_condition, discount_factor) VALUES
('Good', 1.0),
('Fair', 0.9),
('Poor', 0.6);`;
}

function generateFeeTypes(): string {
  return `-- ============================================
-- FEE_TYPE - 費用類型資料
-- ============================================
INSERT INTO FEE_TYPE (type, base_amount, rate) VALUES
('renew', 10, NULL),
('overdue', 10, NULL),
('damage_good_to_fair', NULL, 0.10),
('damage_good_to_poor', NULL, 0.40),
('damage_fair_to_poor', NULL, 0.30),
('lost', NULL, 1.00);`;
}

function generateAdmins(): string {
  const admins: string[] = [];
  const roles = ['Manager', 'Clerk'];
  const statuses = ['Active', 'Active', 'Active', 'Active', 'Left']; // Mostly active
  
  for (let i = 0; i < 15; i++) {
    const name = generateChineseName();
    const phone = generatePhone();
    const role = randomChoice(roles);
    const status = i < 12 ? 'Active' : 'Left';
    admins.push(`('${name}', '${phone}', '${role}', '${status}')`);
  }
  
  return `-- ============================================
-- ADMIN - 管理員資料
-- ============================================
INSERT INTO ADMIN (name, phone, role, status) VALUES
${admins.join(',\n')};`;
}

function generateCategories(): string {
  const categoryValues = categories.map(cat => `('${cat}')`).join(',\n');
  
  return `-- ============================================
-- CATEGORY - 書籍分類資料
-- ============================================
INSERT INTO CATEGORY (name) VALUES
${categoryValues};`;
}

function generateBooks(): string {
  const books: string[] = [];
  
  for (let i = 0; i < 15; i++) {
    const name = bookTitles[i] || `測試書籍${i + 1}`;
    const author = authors[i] || `作者${i + 1}`;
    const publisher = randomChoice(publishers);
    const price = randomInt(200, 800);
    books.push(`('${name}', '${author}', '${publisher}', ${price})`);
  }
  
  return `-- ============================================
-- BOOK - 書籍基本資訊
-- ============================================
INSERT INTO BOOK (name, author, publisher, price) VALUES
${books.join(',\n')};`;
}

function generateMembers(adminIds: number[], levelIds: number[]): string {
  const members: string[] = [];
  const statuses = ['Active', 'Active', 'Active', 'Inactive', 'Suspended'];
  
  for (let i = 0; i < 15; i++) {
    const name = generateChineseName();
    const levelId = randomChoice(levelIds);
    const adminId = randomChoice(adminIds);
    const joinDate = randomDate(365);
    const email = generateEmail(name);
    const phone = generatePhone();
    const balance = randomInt(500, 5000);
    const status = randomChoice(statuses);
    members.push(`('${name}', ${levelId}, ${adminId}, '${joinDate}', '${email}', '${phone}', ${balance}, '${status}')`);
  }
  
  return `-- ============================================
-- MEMBER - 會員資料
-- ============================================
INSERT INTO MEMBER (name, level_id, admin_id, join_date, email, phone, balance, status) VALUES
${members.join(',\n')};`;
}

function generateBookCategories(bookIds: number[], categoryIds: number[]): string {
  const bookCategories: string[] = [];
  const categoryMap: { [key: number]: number[] } = {};
  
  // Assign 1-3 categories per book
  bookIds.forEach(bookId => {
    const numCategories = randomInt(1, 3);
    const assignedCategories = new Set<number>();
    
    while (assignedCategories.size < numCategories) {
      assignedCategories.add(randomChoice(categoryIds));
    }
    
    assignedCategories.forEach(categoryId => {
      bookCategories.push(`(${bookId}, ${categoryId})`);
    });
  });
  
  return `-- ============================================
-- BOOK_CATEGORY - 書籍與分類關係
-- ============================================
INSERT INTO BOOK_CATEGORY (book_id, category_id) VALUES
${bookCategories.join(',\n')};`;
}

function generateBookCopies(bookIds: number[], bookPrices: number[]): { sql: string; copyMap: Map<number, Array<{ bookId: number; serial: number; rentalPrice: number; purchasePrice: number; condition: string }>> } {
  const copies: string[] = [];
  const copyMap = new Map<number, Array<{ bookId: number; serial: number; rentalPrice: number; purchasePrice: number; condition: string }>>();
  const conditions = ['Good', 'Fair', 'Poor'];
  const statuses = ['Available', 'Borrowed', 'Lost'];
  const conditionWeights = [0.6, 0.3, 0.1]; // 60% Good, 30% Fair, 10% Poor
  const statusWeights = [0.7, 0.25, 0.05]; // 70% Available, 25% Borrowed, 5% Lost
  
  bookIds.forEach((bookId, index) => {
    const bookPrice = bookPrices[index];
    const numCopies = randomInt(2, 4);
    const bookCopies: Array<{ bookId: number; serial: number; rentalPrice: number; purchasePrice: number; condition: string }> = [];
    
    for (let serial = 1; serial <= numCopies; serial++) {
      // Determine condition based on weights
      const rand = Math.random();
      let condition: string;
      if (rand < conditionWeights[0]) {
        condition = conditions[0];
      } else if (rand < conditionWeights[0] + conditionWeights[1]) {
        condition = conditions[1];
      } else {
        condition = conditions[2];
      }
      
      // Determine status based on weights
      const statusRand = Math.random();
      let status: string;
      if (statusRand < statusWeights[0]) {
        status = statuses[0];
      } else if (statusRand < statusWeights[0] + statusWeights[1]) {
        status = statuses[1];
      } else {
        status = statuses[2];
      }
      
      const purchaseDate = randomDate(180);
      const purchasePrice = Math.floor(bookPrice * (0.7 + Math.random() * 0.3));
      const discountFactor = condition === 'Good' ? 1.0 : condition === 'Fair' ? 0.9 : 0.6;
      const rentalPrice = Math.floor(purchasePrice * 0.1 * discountFactor);
      
      copies.push(`(${bookId}, ${serial}, '${status}', '${purchaseDate}', ${purchasePrice}, '${condition}', ${rentalPrice})`);
      bookCopies.push({ bookId, serial, rentalPrice, purchasePrice, condition });
    }
    
    copyMap.set(bookId, bookCopies);
  });
  
  return {
    sql: `-- ============================================
-- BOOK_COPIES - 書籍複本資料
-- ============================================
INSERT INTO BOOK_COPIES (book_id, copies_serial, status, purchase_date, purchase_price, book_condition, rental_price) VALUES
${copies.join(',\n')};`,
    copyMap
  };
}

function generateBookLoans(adminIds: number[], memberIds: number[]): { sql: string; loanIds: number[] } {
  const loans: string[] = [];
  const loanIds: number[] = [];
  
  for (let i = 0; i < 12; i++) {
    const loanId = i + 1;
    loanIds.push(loanId);
    const adminId = randomChoice(adminIds);
    const memberId = randomChoice(memberIds);
    const finalPrice = 0; // Will be updated by loan records
    loans.push(`(${loanId}, ${adminId}, ${memberId}, ${finalPrice})`);
  }
  
  return {
    sql: `-- ============================================
-- BOOK_LOAN - 借閱交易資料
-- ============================================
INSERT INTO BOOK_LOAN (loan_id, admin_id, member_id, final_price) VALUES
${loans.join(',\n')};`,
    loanIds
  };
}

interface LoanRecordData {
  loanId: number;
  bookId: number;
  serial: number;
  dateOut: string;
  dueDate: string;
  returnDate: string | null;
  rentalFee: number;
  renewCnt: number;
  purchasePrice: number;
  condition: string;
}

function generateLoanRecords(
  loanIds: number[],
  bookCopyMap: Map<number, Array<{ bookId: number; serial: number; rentalPrice: number; purchasePrice: number; condition: string }>>,
  memberLevelMap: Map<number, { discountRate: number; holdDays: number }>
): { sql: string; loanRecordData: LoanRecordData[] } {
  const records: string[] = [];
  const loanFinalPrices: Map<number, number> = new Map();
  const loanRecordData: LoanRecordData[] = [];
  
  loanIds.forEach(loanId => {
    const numBooks = randomInt(1, 3);
    const memberId = randomInt(1, 15); // Assuming member IDs start from 1
    const memberLevel = memberLevelMap.get(memberId) || { discountRate: 1.0, holdDays: 7 };
    
    let loanTotal = 0;
    const availableCopies: Array<{ bookId: number; serial: number; rentalPrice: number; purchasePrice: number; condition: string }> = [];
    
    // Collect available copies
    bookCopyMap.forEach((copies, bookId) => {
      copies.forEach(copy => {
        availableCopies.push({ ...copy, bookId });
      });
    });
    
    // Select random copies for this loan
    const selectedCopies = [];
    for (let i = 0; i < numBooks && availableCopies.length > 0; i++) {
      const index = randomInt(0, availableCopies.length - 1);
      selectedCopies.push(availableCopies.splice(index, 1)[0]);
    }
    
    selectedCopies.forEach(copy => {
      const dateOut = randomDate(180);
      const dueDate = new Date(dateOut);
      dueDate.setDate(dueDate.getDate() + memberLevel.holdDays);
      const dueDateStr = dueDate.toISOString().split('T')[0];
      
      // 60% returned, 40% not returned
      const returnDate = Math.random() < 0.6 ? randomDate(30) : null;
      const rentalFee = Math.floor(copy.rentalPrice * memberLevel.discountRate);
      const renewCnt = Math.random() < 0.2 ? 1 : 0;
      
      loanTotal += rentalFee;
      
      records.push(`(${loanId}, ${copy.bookId}, ${copy.serial}, '${dateOut}', '${dueDateStr}', ${returnDate ? `'${returnDate}'` : 'NULL'}, ${rentalFee}, ${renewCnt})`);
      
      // Store data for ADD_FEE generation
      loanRecordData.push({
        loanId,
        bookId: copy.bookId,
        serial: copy.serial,
        dateOut,
        dueDate: dueDateStr,
        returnDate,
        rentalFee,
        renewCnt,
        purchasePrice: copy.purchasePrice,
        condition: copy.condition
      });
    });
    
    loanFinalPrices.set(loanId, loanTotal);
  });
  
  // Update final prices in BOOK_LOAN
  const updateStatements = Array.from(loanFinalPrices.entries())
    .map(([loanId, price]) => `UPDATE BOOK_LOAN SET final_price = ${price} WHERE loan_id = ${loanId};`)
    .join('\n');
  
  return {
    sql: `-- ============================================
-- LOAN_RECORD - 借閱記錄詳情
-- ============================================
INSERT INTO LOAN_RECORD (loan_id, book_id, copies_serial, date_out, due_date, return_date, rental_fee, renew_cnt) VALUES
${records.join(',\n')};

-- Update final prices in BOOK_LOAN
${updateStatements}`,
    loanRecordData
  };
}

function generateReservations(memberIds: number[]): { sql: string; reservationIds: number[] } {
  const reservations: string[] = [];
  const reservationIds: number[] = [];
  const statuses = ['Active', 'Fulfilled', 'Cancelled'];
  const statusWeights = [0.4, 0.4, 0.2];
  
  for (let i = 0; i < 12; i++) {
    const reservationId = i + 1;
    reservationIds.push(reservationId);
    const memberId = randomChoice(memberIds);
    const reserveDate = randomDate(90);
    
    const statusRand = Math.random();
    let status: string;
    if (statusRand < statusWeights[0]) {
      status = statuses[0];
    } else if (statusRand < statusWeights[0] + statusWeights[1]) {
      status = statuses[1];
    } else {
      status = statuses[2];
    }
    
    const pickupDate = status === 'Fulfilled' ? randomDate(60) : null;
    
    reservations.push(`(${reservationId}, ${memberId}, '${reserveDate}', ${pickupDate ? `'${pickupDate}'` : 'NULL'}, '${status}')`);
  }
  
  return {
    sql: `-- ============================================
-- RESERVATION - 預約記錄
-- ============================================
INSERT INTO RESERVATION (reservation_id, member_id, reserve_date, pickup_date, status) VALUES
${reservations.join(',\n')};`,
    reservationIds
  };
}

function generateReservationRecords(reservationIds: number[], bookIds: number[]): string {
  const records: string[] = [];
  
  reservationIds.forEach(reservationId => {
    const numBooks = randomInt(1, 3);
    const selectedBooks = new Set<number>();
    
    while (selectedBooks.size < numBooks) {
      selectedBooks.add(randomChoice(bookIds));
    }
    
    selectedBooks.forEach(bookId => {
      records.push(`(${reservationId}, ${bookId})`);
    });
  });
  
  return `-- ============================================
-- RESERVATION_RECORD - 預約與書籍關係
-- ============================================
INSERT INTO RESERVATION_RECORD (reservation_id, book_id) VALUES
${records.join(',\n')};`;
}

function generateAddFees(loanRecordData: LoanRecordData[]): string {
  const fees: string[] = [];
  
  loanRecordData.forEach(record => {
    const feeDate = record.returnDate || new Date().toISOString().split('T')[0];
    
    // Renew fee (80% chance if renewed)
    if (record.renewCnt === 1 && Math.random() < 0.8) {
      fees.push(`(${record.loanId}, ${record.bookId}, ${record.serial}, 'renew', 10, '${feeDate}')`);
    }
    
    // Overdue fee (if overdue and returned)
    if (record.returnDate) {
      const returnDateObj = new Date(record.returnDate);
      const dueDateObj = new Date(record.dueDate);
      if (returnDateObj > dueDateObj) {
        const daysOverdue = Math.floor((returnDateObj.getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24));
        if (daysOverdue > 0 && Math.random() < 0.7) {
          fees.push(`(${record.loanId}, ${record.bookId}, ${record.serial}, 'overdue', ${daysOverdue * 10}, '${feeDate}')`);
        }
      }
    }
    
    // Damage fee (10% chance, only if returned)
    if (record.returnDate && Math.random() < 0.1) {
      if (record.condition === 'Good') {
        const damageType = Math.random() < 0.5 ? 'damage_good_to_fair' : 'damage_good_to_poor';
        const rate = damageType === 'damage_good_to_fair' ? 0.10 : 0.40;
        fees.push(`(${record.loanId}, ${record.bookId}, ${record.serial}, '${damageType}', ${Math.floor(record.purchasePrice * rate)}, '${feeDate}')`);
      } else if (record.condition === 'Fair' && Math.random() < 0.3) {
        fees.push(`(${record.loanId}, ${record.bookId}, ${record.serial}, 'damage_fair_to_poor', ${Math.floor(record.purchasePrice * 0.30)}, '${feeDate}')`);
      }
    }
    
    // Lost fee (5% chance, only if not returned)
    if (!record.returnDate && Math.random() < 0.05) {
      fees.push(`(${record.loanId}, ${record.bookId}, ${record.serial}, 'lost', ${record.purchasePrice}, '${feeDate}')`);
    }
  });
  
  if (fees.length === 0) {
    return `-- ============================================
-- ADD_FEE - 額外費用（無資料）
-- ============================================`;
  }
  
  return `-- ============================================
-- ADD_FEE - 額外費用
-- ============================================
INSERT INTO ADD_FEE (loan_id, book_id, copies_serial, type, amount, date) VALUES
${fees.join(',\n')};`;
}

// Main function
function main() {
  console.log('開始生成假資料...');
  
  // Generate data in correct order
  const membershipLevels = generateMembershipLevels();
  const conditionDiscounts = generateConditionDiscounts();
  const feeTypes = generateFeeTypes();
  const admins = generateAdmins();
  const categories = generateCategories();
  const books = generateBooks();
  
  // IDs (assuming they start from 1 and increment)
  const adminIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const levelIds = [1, 2, 3]; // 銅, 銀, 金
  const categoryIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const bookIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const bookPrices = [350, 280, 450, 380, 320, 420, 380, 450, 300, 320, 280, 250, 550, 200, 220];
  
  const members = generateMembers(adminIds, levelIds);
  const memberIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  
  const bookCategories = generateBookCategories(bookIds, categoryIds);
  const bookCopiesResult = generateBookCopies(bookIds, bookPrices);
  const bookCopies = bookCopiesResult.sql;
  const bookCopyMap = bookCopiesResult.copyMap;
  
  // Member level map (assuming discount rates)
  const memberLevelMap = new Map<number, { discountRate: number; holdDays: number }>();
  memberIds.forEach(memberId => {
    const levelId = randomChoice(levelIds);
    const discountRate = levelId === 1 ? 1.0 : levelId === 2 ? 0.92 : 0.79;
    const holdDays = levelId === 1 ? 7 : levelId === 2 ? 14 : 30;
    memberLevelMap.set(memberId, { discountRate, holdDays });
  });
  
  const bookLoans = generateBookLoans(adminIds, memberIds);
  const loanRecordsResult = generateLoanRecords(bookLoans.loanIds, bookCopyMap, memberLevelMap);
  const loanRecords = loanRecordsResult.sql;
  const loanRecordData = loanRecordsResult.loanRecordData;
  
  const reservations = generateReservations(memberIds);
  const reservationRecords = generateReservationRecords(reservations.reservationIds, bookIds);
  
  // Generate ADD_FEE
  const addFees = generateAddFees(loanRecordData);
  
  // Combine all SQL
  const sqlContent = `-- ============================================
-- 獨立租借書店系統 - 自動生成的假資料
-- PostgreSQL (Supabase)
-- ============================================
-- 此檔案由 generate-seed-data.ts 自動生成
-- 執行前請確保已執行：
--   1. 001_initial_schema.sql
--   2. seed.sql (基礎資料)
-- ============================================

BEGIN;

${membershipLevels}

${conditionDiscounts}

${feeTypes}

${admins}

${categories}

${books}

${members}

${bookCategories}

${bookCopies}

${bookLoans.sql}

${loanRecords}

${reservations.sql}

${reservationRecords}

${addFees}

COMMIT;

-- ============================================
-- 資料統計
-- ============================================
-- 執行完成後，可以使用以下查詢檢查資料：
-- SELECT 'ADMIN' as table_name, COUNT(*) as count FROM ADMIN
-- UNION ALL
-- SELECT 'MEMBER', COUNT(*) FROM MEMBER
-- UNION ALL
-- SELECT 'BOOK', COUNT(*) FROM BOOK
-- UNION ALL
-- SELECT 'BOOK_COPIES', COUNT(*) FROM BOOK_COPIES
-- UNION ALL
-- SELECT 'BOOK_LOAN', COUNT(*) FROM BOOK_LOAN
-- UNION ALL
-- SELECT 'LOAN_RECORD', COUNT(*) FROM LOAN_RECORD
-- UNION ALL
-- SELECT 'RESERVATION', COUNT(*) FROM RESERVATION
-- UNION ALL
-- SELECT 'ADD_FEE', COUNT(*) FROM ADD_FEE;
`;

  // Write to file
  const projectRoot = process.cwd();
  const outputPath = path.join(projectRoot, 'database', 'relational', 'seed_generated.sql');
  fs.writeFileSync(outputPath, sqlContent, 'utf-8');
  
  console.log(`假資料已生成至: ${outputPath}`);
  console.log('生成完成！');
}

main();

