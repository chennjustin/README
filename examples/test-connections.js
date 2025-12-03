// ============================================
// 資料庫連接測試腳本
// ============================================
// 此腳本會測試所有資料庫連接

require('dotenv').config();

const { testConnection: testSupabase } = require('./connect-supabase');
const { testConnection: testPostgres } = require('./connect-postgres');
const { testConnection: testMongodb } = require('./connect-mongodb');

async function runAllTests() {
  console.log('='.repeat(50));
  console.log('資料庫連接測試');
  console.log('='.repeat(50));
  console.log();

  const results = {
    supabase: false,
    postgres: false,
    mongodb: false,
  };

  const configured = {
    supabase: false,
    postgres: false,
    mongodb: false,
  };

  // 測試 Supabase
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    console.log('📦 測試 Supabase 連接...\n');
    configured.supabase = true;
    results.supabase = await testSupabase();
    console.log('\n' + '-'.repeat(50) + '\n');
  } else {
    console.log('⏭️  跳過 Supabase 測試（缺少配置）\n');
  }

  // 測試 PostgreSQL
  if (process.env.DATABASE_URL || process.env.DATABASE_POOL_URL) {
    console.log('📦 測試 PostgreSQL 連接...\n');
    configured.postgres = true;
    results.postgres = await testPostgres();
    console.log('\n' + '-'.repeat(50) + '\n');
  } else {
    console.log('⏭️  跳過 PostgreSQL 測試（缺少配置）\n');
  }

  // 測試 MongoDB
  if (process.env.MONGODB_URI) {
    console.log('📦 測試 MongoDB 連接...\n');
    configured.mongodb = true;
    results.mongodb = await testMongodb();
    console.log('\n' + '-'.repeat(50) + '\n');
  } else {
    console.log('⏭️  跳過 MongoDB 測試（缺少配置）\n');
  }

  // 總結
  console.log('='.repeat(50));
  console.log('測試結果總結');
  console.log('='.repeat(50));
  console.log();
  console.log(`Supabase:  ${results.supabase ? '✅ 成功' : '❌ 失敗或未配置'}`);
  console.log(`PostgreSQL: ${results.postgres ? '✅ 成功' : '❌ 失敗或未配置'}`);
  console.log(`MongoDB:    ${results.mongodb ? '✅ 成功' : '❌ 失敗或未配置'}`);
  console.log();

  const allPassed = Object.values(results).every(r => r === true);
  const anyConfigured = Object.values(configured).some(r => r === true);

  if (allPassed && anyConfigured) {
    console.log('✅ 所有配置的資料庫連接測試通過！');
    process.exit(0);
  } else if (!anyConfigured) {
    console.log('⚠️  沒有配置任何資料庫連接');
    console.log('請參考 .env.example 設定環境變數');
    process.exit(1);
  } else {
    console.log('❌ 部分資料庫連接測試失敗');
    console.log('請檢查 .env 檔案中的配置');
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('❌ 測試執行失敗：', error);
  process.exit(1);
});

