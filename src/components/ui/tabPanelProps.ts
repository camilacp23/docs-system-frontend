// tabPanelProps: the props that connect a tab panel to its tab in Tabs (role, id, aria-labelledby, focusable).
// tabPanelProps(idPrefix, key) -> spread on the panel element: <div {...tabPanelProps('collection', 'fields')}>
export function tabPanelProps(idPrefix: string, key: string) {
  return {
    role: 'tabpanel' as const,
    id: `${idPrefix}-panel-${key}`,
    'aria-labelledby': `${idPrefix}-tab-${key}`,
    tabIndex: 0,
  };
}
