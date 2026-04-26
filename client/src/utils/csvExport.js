export function exportToCsv(filename, data) {
  if (!data) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fullFilename = `${filename}_${timestamp}.csv`;

  const rows = [];

  // Separate array items from scalar items
  let items = [];
  let otherFields = {};

  if (Array.isArray(data)) {
    items = data;
  } else if (typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        if (items.length === 0 || key.toLowerCase() === 'items') {
          items = value;
        }
      } else {
        otherFields[key] = value;
      }
    }
  }

  // Export scalar fields first
  if (Object.keys(otherFields).length > 0) {
    rows.push(['Field', 'Value']);
    for (const [key, value] of Object.entries(otherFields)) {
      rows.push([key, typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value || '')]);
    }
    rows.push([]); // empty row separator
  }

  // Export items array
  if (items.length > 0) {
    let itemKeys = [];
    const allKeys = new Set();
    items.forEach(item => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(k => allKeys.add(k));
      }
    });
    itemKeys = Array.from(allKeys);

    if (itemKeys.length > 0) {
      rows.push(itemKeys);
      items.forEach(item => {
        const row = itemKeys.map(k => item[k] !== undefined && item[k] !== null ? String(item[k]) : '');
        rows.push(row);
      });
    }
  }

  if (rows.length === 0) return;

  const csvContent = rows.map(row => 
    row.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')
  ).join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fullFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}