// src/config/upload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Garante que a pasta existe (caminho relativo à raiz do projeto)
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.]/g, '_'))
});

const upload = multer({ storage: storage });

module.exports = upload;