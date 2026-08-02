const Jimp = require('jimp');
const path = require('path');
const fs = require('fs');

const avatarPath = path.join(__dirname, '../public/avatar.png');

async function run() {
    console.log("Iniciando compactação de avatar.png...");
    try {
        const originalSize = fs.statSync(avatarPath).size;
        console.log(`Tamanho original: ${(originalSize / 1024).toFixed(2)} KB`);
        
        // Carrega o avatar, redimensiona para 128x128 e define qualidade de compactação
        const image = await Jimp.read(avatarPath);
        await image.resize(128, 128).quality(70).writeAsync(avatarPath);
        
        const newSize = fs.statSync(avatarPath).size;
        console.log(`Novo tamanho: ${(newSize / 1024).toFixed(2)} KB`);
        console.log(`Economia de: ${(((originalSize - newSize) / originalSize) * 100).toFixed(2)}%`);
    } catch (e) {
        console.error("Erro ao compactar avatar:", e);
    }
}

run();
