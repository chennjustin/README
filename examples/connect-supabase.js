// ============================================
// Supabase 連接範例
// ============================================
// 此檔案示範如何使用 Supabase Client 連接資料庫

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 從環境變數取得連接資訊
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // 或使用 SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 錯誤：缺少 Supabase 連接資訊');
  console.error('請在 .env 檔案中設定 SUPABASE_URL 和 SUPABASE_ANON_KEY');
  process.exit(1);
}

// 建立 Supabase 客戶端
// 添加 schema 選項以確保正確載入表
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: {
    schema: 'public'
  },
  auth: {
    persistSession: false
  }
});

// ============================================
// 測試連接
// ============================================
async function testConnection() {
  try {
    console.log('🔌 正在測試 Supabase 連接...\n');

    // 測試查詢：取得會員等級資料
    // 嘗試使用小寫表名（PostgreSQL 預設會轉為小寫）
    let { data, error } = await supabase
      .from('membership_level')
      .select('*')
      .limit(5);
    
    // 如果小寫失敗，嘗試大寫
    if (error && error.message.includes('schema cache')) {
      console.log('⚠️  小寫表名失敗，嘗試大寫表名...\n');
      const result = await supabase
        .from('MEMBERSHIP_LEVEL')
        .select('*')
        .limit(5);
      if (result.error) throw result.error;
      data = result.data;
      error = null;
    }

    if (error) {
      // 如果是 schema cache 錯誤，提供更詳細的錯誤訊息
      if (error.message.includes('schema cache')) {
        console.error('\n💡 提示：這可能是 schema cache 問題。');
        console.error('   請嘗試：');
        console.error('   1. 等待幾秒後重試');
        console.error('   2. 或在 Supabase Dashboard 中重新整理頁面');
        console.error('   3. 或使用 PostgreSQL 直接連接（DATABASE_URL）\n');
      }
      throw error;
    }

    console.log('✅ Supabase 連接成功！');
    console.log(`📊 找到 ${data.length} 筆會員等級資料：\n`);
    
    data.forEach(level => {
      console.log(`  - ${level.level_name} (ID: ${level.level_id})`);
      console.log(`    折扣率: ${level.discount_rate}, 可借書數: ${level.max_book_allowed}`);
    });

    return true;
  } catch (error) {
    console.error('❌ Supabase 連接失敗：');
    console.error(error.message);
    return false;
  }
}

// ============================================
// 範例查詢
// ============================================

// 查詢所有書籍
async function getAllBooks() {
  const { data, error } = await supabase
    .from('book')
    .select('*');
  
  if (error) throw error;
  return data;
}

// 查詢會員資訊
async function getMember(memberId) {
  const { data, error } = await supabase
    .from('member')
    .select(`
      *,
      membership_level (*)
    `)
    .eq('member_id', memberId)
    .single();
  
  if (error) throw error;
  return data;
}

// 新增書籍
async function insertBook(bookData) {
  const { data, error } = await supabase
    .from('book')
    .insert(bookData)
    .select();
  
  if (error) throw error;
  return data;
}

// ============================================
// 執行測試
// ============================================
if (require.main === module) {
  testConnection()
    .then(success => {
      if (success) {
        console.log('\n✅ 連接測試完成！');
        console.log('\n💡 提示：您可以在應用程式中使用 supabase 客戶端來查詢資料。');
      }
      process.exit(success ? 0 : 1);
    });
}

module.exports = {
  supabase,
  testConnection,
  getAllBooks,
  getMember,
  insertBook,
};

