const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// 1x1 transparent PNG fallback
const base64Png = 'iVBORw0KGgoAAAANSU5EUgAAAEAAAABACAYAAACqaXHeAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAABMSURBVHgB7cEBDQAAAMKg909tDjegAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADwGy0AAAW16C+8AAAAASUVORK5CYII=';

fs.writeFileSync(path.join(iconsDir, 'icon-192.png'), Buffer.from(base64Png, 'base64'));
fs.writeFileSync(path.join(iconsDir, 'icon-512.png'), Buffer.from(base64Png, 'base64'));
fs.writeFileSync(path.join(iconsDir, 'apple-touch-icon.png'), Buffer.from(base64Png, 'base64'));
console.log('PWA icons created successfully!');
