const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadFolder = path.resolve(__dirname, '..', '..', 'storage', 'uploads');

if (!fs.existsSync(uploadFolder)){
    fs.mkdirSync(uploadFolder, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadFolder);
    },
    filename: (req, file, cb) => {
        // Remove acentos e espaços do nome original para evitar erro no link
        const cleanName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
        const uniqueName = `${Date.now()}-${cleanName}`;
        cb(null, uniqueName);
    }
});

const fileFilter = (req, file, cb) => {
    // AGORA SÓ ACEITA PDF
    if (file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Apenas arquivos PDF são permitidos!'));
    }
};

module.exports = multer({ 
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 100 * 1024 * 1024 } // Aumentei para 100MB (já que podem ser vários)
});