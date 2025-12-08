-- ============================================
-- 修復 MEMBER 表的序列
-- ============================================
-- 此腳本用於修復 member_id 序列，確保序列值與實際的最大 member_id 同步
-- 當手動插入或刪除記錄導致序列不同步時使用

-- 重置 member_id 序列為當前最大 member_id + 1
SELECT setval(
    'member_member_id_seq',
    COALESCE((SELECT MAX(member_id) FROM MEMBER), 0) + 1,
    false
);

-- 驗證序列當前值
SELECT currval('member_member_id_seq') AS current_sequence_value,
       (SELECT MAX(member_id) FROM MEMBER) AS max_member_id;

