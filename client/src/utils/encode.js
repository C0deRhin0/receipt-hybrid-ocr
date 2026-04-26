// Extract base64 data from a data URL (e.g., "data:image/jpeg;base64,XXXX...")
export const encodeBase64 = (dataUrl) => {
  if (!dataUrl) return '';
  
  // Remove the data URL prefix if present
  const base64Index = dataUrl.indexOf(',');
  if (base64Index !== -1) {
    return dataUrl.substring(base64Index + 1);
  }
  
  return dataUrl;
};

// Convert base64 string back to data URL
export const decodeBase64 = (base64, mimeType = 'image/jpeg') => {
  return `data:${mimeType};base64,${base64}`;
};

// Convert File to base64 data URL
export const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});