/**
 * 格式化日期顯示
 * 將 ISO 格式（如 2025-10-20T16:00:00.000Z）轉換為 YYYY-MM-DD
 */
export function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr; // 如果無法解析，返回原字符串
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } catch {
    return dateStr;
  }
}

