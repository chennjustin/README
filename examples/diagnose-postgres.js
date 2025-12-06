// ============================================
// PostgreSQL 連接診斷腳本
// ============================================
// 此腳本幫助診斷 DATABASE_URL 連接問題

require('dotenv').config();

const DATABASE_URL = process.env.DATABASE_URL || process.env.DATABASE_POOL_URL;

console.log('='.repeat(60));
console.log('PostgreSQL 連接診斷');
console.log('='.repeat(60));
console.log();

if (!DATABASE_URL) {
  console.log('❌ 錯誤：未設定 DATABASE_URL 或 DATABASE_POOL_URL');
  console.log();
  console.log('📝 如何取得 DATABASE_URL：');
  console.log('1. 登入 Supabase Dashboard');
  console.log('2. 前往 Settings → Database');
  console.log('3. 在 Connection string 區塊，選擇 URI 格式');
  console.log('4. 複製連接字串，將 [YOUR-PASSWORD] 替換為您的資料庫密碼');
  console.log('5. 將連接字串設定到 .env 檔案的 DATABASE_URL 變數');
  console.log();
  process.exit(1);
}

// 解析連接字串
console.log('📋 連接字串資訊：');
console.log();

try {
  const url = new URL(DATABASE_URL);
  
  console.log(`✅ 連接字串格式正確`);
  console.log(`   協議: ${url.protocol}`);
  console.log(`   用戶名: ${url.username}`);
  console.log(`   主機: ${url.hostname}`);
  console.log(`   端口: ${url.port || '5432 (預設)'}`);
  console.log(`   資料庫: ${url.pathname.slice(1) || 'postgres (預設)'}`);
  console.log(`   密碼: ${url.password ? '已設定 (' + url.password.length + ' 字元)' : '❌ 未設定'}`);
  console.log();
  
  // 檢查是否為連接池 URL
  if (url.hostname.includes('pooler') || url.port === '6543') {
    console.log('ℹ️  這是連接池 URL（pooler，port 6543）');
    console.log('   連接池 URL 需要額外參數才能正常工作');
    console.log();
    
    // 檢查是否有必要的參數
    const hasPgbouncer = url.searchParams.has('pgbouncer');
    const hasConnectionLimit = url.searchParams.has('connection_limit');
    const hasPoolTimeout = url.searchParams.has('pool_timeout');
    
    if (!hasPgbouncer || !hasConnectionLimit || !hasPoolTimeout) {
      console.log('⚠️  警告：連接池 URL 缺少必要參數');
      console.log('   建議在連接字串末尾加上：');
      console.log('   ?pgbouncer=true&connection_limit=1&pool_timeout=20');
      console.log();
      console.log('   完整格式範例：');
      console.log('   postgresql://postgres.xxxxx:PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&pool_timeout=20');
      console.log();
    } else {
      console.log('✅ 連接池參數已設定：');
      console.log(`   pgbouncer: ${url.searchParams.get('pgbouncer')}`);
      console.log(`   connection_limit: ${url.searchParams.get('connection_limit')}`);
      console.log(`   pool_timeout: ${url.searchParams.get('pool_timeout')}`);
      console.log();
    }
  } else {
    console.log('ℹ️  這是直接連接 URL（port 5432）');
    console.log('   如果直接連接失敗，可以嘗試使用連接池 URL（port 6543）');
    console.log();
  }
  
  // 檢查密碼
  if (!url.password || url.password.length < 8) {
    console.log('⚠️  警告：密碼可能不正確或太短');
    console.log('   請確認密碼是否正確設定');
    console.log();
  }
  
} catch (error) {
  console.log('❌ 連接字串格式錯誤：', error.message);
  console.log();
  console.log('📝 正確格式範例：');
  console.log('   postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres');
  console.log();
  process.exit(1);
}

// 測試連接
console.log('🔌 測試連接...');
console.log();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 5000, // 5 秒超時
});

pool.query('SELECT version()')
  .then(result => {
    console.log('✅ 連接成功！');
    console.log();
    console.log('📊 PostgreSQL 版本資訊：');
    console.log('   ' + result.rows[0].version);
    console.log();
    
    // 測試查詢表
    return pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
  })
  .then(result => {
    console.log(`📋 找到 ${result.rows.length} 個資料表：`);
    result.rows.forEach((row, index) => {
      console.log(`   ${index + 1}. ${row.table_name}`);
    });
    console.log();
    
    // 測試查詢 MEMBERSHIP_LEVEL
    return pool.query('SELECT COUNT(*) as count FROM MEMBERSHIP_LEVEL');
  })
  .then(result => {
    console.log(`✅ 資料表查詢成功！`);
    console.log(`   MEMBERSHIP_LEVEL 表中有 ${result.rows[0].count} 筆資料`);
    console.log();
    console.log('🎉 DATABASE_URL 完全可用！');
    console.log();
    pool.end();
    process.exit(0);
  })
  .catch(error => {
    console.log('❌ 連接失敗：');
    console.log();
    
    if (error.message.includes('password authentication failed')) {
      console.log('🔑 密碼驗證失敗');
      console.log();
      console.log('📝 解決方法：');
      console.log('1. 確認 .env 檔案中的 DATABASE_URL 密碼是否正確');
      console.log('2. 如果忘記密碼，可以重置：');
      console.log('   - 前往 Supabase Dashboard → Settings → Database');
      console.log('   - 點擊 "Reset database password"');
      console.log('   - 設定新密碼後，更新 .env 檔案中的 DATABASE_URL');
      console.log();
      console.log('3. 確認連接字串格式：');
      console.log('   postgresql://postgres:YOUR_PASSWORD@HOST:PORT/postgres');
      console.log('   注意：密碼中的特殊字元需要 URL 編碼');
      console.log();
    } else if (error.message.includes('timeout')) {
      console.log('⏱️  連接超時');
      console.log();
      console.log('📝 可能原因：');
      console.log('1. 網路連線問題');
      console.log('2. Supabase 專案暫停（免費方案會自動暫停）');
      console.log('3. 防火牆阻擋連接');
      console.log();
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
      console.log('🌐 無法解析主機名稱');
      console.log();
      console.log('📝 請檢查：');
      console.log('1. 連接字串中的主機名稱是否正確');
      console.log('2. 網路連線是否正常');
      console.log();
    } else {
      console.log('錯誤訊息：', error.message);
      console.log();
    }
    
    pool.end();
    process.exit(1);
  });

