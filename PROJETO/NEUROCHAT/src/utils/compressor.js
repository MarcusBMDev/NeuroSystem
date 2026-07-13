const Jimp = require('jimp');
const fs = require('fs');
const path = require('path');

/**
 * Compacta uma imagem em lote no próprio local de armazenamento (in-place)
 * preservando o mesmo nome de arquivo e extensão para não quebrar links.
 * 
 * @param {string} filePath - Caminho absoluto da imagem
 * @returns {Promise<boolean>}
 */
async function compressImageInPlace(filePath) {
    try {
        const ext = path.extname(filePath).toLowerCase();
        if (!['.jpg', '.jpeg', '.png', '.bmp'].includes(ext)) {
            return false; // Não é imagem suportada para compactação
        }

        // Carrega a imagem com Jimp
        const image = await Jimp.read(filePath);

        // Se for muito larga (ex: fotos de câmera de 4K), redimensiona proporcionalmente para 1600px
        if (image.getWidth() > 1600) {
            image.resize(1600, Jimp.AUTO);
        }

        // Define qualidade de compressão (75% é o padrão ouro de web: economiza 80% do tamanho com perda imperceptível)
        image.quality(75);

        // Sobrescreve o arquivo no mesmo caminho
        await image.writeAsync(filePath);
        return true;
    } catch (error) {
        console.error('Erro na compactação em tempo real:', error);
        return false;
    }
}

module.exports = { compressImageInPlace };
