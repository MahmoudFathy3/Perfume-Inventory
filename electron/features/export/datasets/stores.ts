/**
 * اسم المخزن في التصدير: المخزون الفعلي بيرجع 'personal' (بيتترجم من قيم التصدير بلغة التطبيق)،
 * والشراكة باسمها أو أسماء شركائها، والمخزن الخارجي باسمه
 */
export const storeName = (idColumn: string) => `(SELECT CASE w.kind WHEN 'personal' THEN 'personal'
    ELSE COALESCE(NULLIF(w.name, ''), (SELECT group_concat(wp.name, ' & ') FROM workspace_partners wp WHERE wp.workspace_id = w.id)) END
  FROM workspaces w WHERE w.id = ${idColumn})`
