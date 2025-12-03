// ============================================
// MongoDB 連接診斷腳本
// ============================================
// 此腳本幫助診斷 MongoDB 連接問題

require('dotenv').config();

const mongoUri = process.env.MONGODB_URI;

console.log('='.repeat(50));
console.log('MongoDB 連接診斷');
console.log('='.repeat(50));
console.log();

// 檢查環境變數
if (!mongoUri) {
  console.error('❌ 錯誤：MONGODB_URI 未設定');
  console.error('請在 .env 檔案中設定 MONGODB_URI');
  process.exit(1);
}

console.log('✅ MONGODB_URI 已設定');
console.log();

// 檢查連接字串格式
console.log('📋 連接字串格式檢查：');
console.log('-'.repeat(50));

// 檢查開頭
if (mongoUri.startsWith('mongodb+srv://')) {
  console.log('✅ 開頭格式正確 (mongodb+srv://)');
} else if (mongoUri.startsWith('mongodb://')) {
  console.log('⚠️  使用標準連接 (mongodb://)，建議使用 mongodb+srv://');
} else {
  console.log('❌ 連接字串格式不正確');
  console.log('   應該以 mongodb+srv:// 或 mongodb:// 開頭');
}

// 檢查是否包含用戶名和密碼
const uriMatch = mongoUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@/);
if (uriMatch) {
  const username = uriMatch[1];
  const password = uriMatch[2];
  console.log(`✅ 包含用戶名: ${username}`);
  console.log(`✅ 包含密碼: ${'*'.repeat(password.length)}`);
  
  // 檢查密碼是否包含特殊字元
  const specialChars = /[@#%:?&=\/]/;
  if (specialChars.test(password)) {
    console.log('⚠️  密碼包含特殊字元，可能需要 URL 編碼');
    console.log('   特殊字元：@ # % : ? & = /');
  }
} else {
  console.log('❌ 連接字串中缺少用戶名或密碼');
  console.log('   格式應該是：mongodb+srv://username:password@host');
}

// 檢查是否包含資料庫名稱
if (mongoUri.includes('/') && !mongoUri.endsWith('/')) {
  const dbMatch = mongoUri.match(/\/([^?]+)/);
  if (dbMatch) {
    const dbName = dbMatch[1];
    console.log(`✅ 包含資料庫名稱: ${dbName}`);
  }
} else {
  console.log('⚠️  連接字串中可能缺少資料庫名稱');
  console.log('   建議格式：mongodb+srv://...@host/database_name?params');
}

// 檢查是否包含參數
if (mongoUri.includes('?')) {
  const params = mongoUri.split('?')[1];
  console.log(`✅ 包含參數: ${params}`);
  
  if (params.includes('retryWrites=true')) {
    console.log('   ✓ retryWrites=true');
  } else {
    console.log('   ⚠️  缺少 retryWrites=true');
  }
  
  if (params.includes('w=majority')) {
    console.log('   ✓ w=majority');
  } else {
    console.log('   ⚠️  缺少 w=majority');
  }
} else {
  console.log('⚠️  連接字串中缺少參數');
  console.log('   建議添加：?retryWrites=true&w=majority');
}

console.log('-'.repeat(50));
console.log();

// 嘗試解析連接字串
console.log('🔍 連接字串解析：');
try {
  const url = new URL(mongoUri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'http://'));
  console.log(`   主機: ${url.hostname}`);
  console.log(`   路徑: ${url.pathname}`);
  console.log(`   參數: ${url.search}`);
} catch (e) {
  console.log('   ⚠️  無法解析連接字串');
}

console.log();
console.log('='.repeat(50));
console.log('💡 建議：');
console.log('='.repeat(50));
console.log('1. 從 MongoDB Atlas Dashboard 重新複製連接字串');
console.log('2. 確認 Network Access 允許您的 IP');
console.log('3. 確認資料庫用戶存在且有權限');
console.log('4. 如果密碼包含特殊字元，進行 URL 編碼');
console.log();
console.log('詳細說明請參考：docs/CONNECTION_GUIDE.md');
console.log();

