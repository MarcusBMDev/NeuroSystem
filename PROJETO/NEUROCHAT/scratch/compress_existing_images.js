const fs = require('fs');
const path = require('path');
const { compressImageInPlace } = require('../src/utils/compressor');

const uploadDir = path.join(__dirname, '../public/uploads');

async function run() {
    console.log('=== INICIANDO COMPACTAÇÃO RETROATIVA DE UPLOADS ===');
    console.log('Diretório alvo:', uploadDir);

    if (!fs.existsSync(uploadDir)) {
        console.error('Erro: O diretório uploads não existe localmente.');
        return;
    }

    const files = fs.readdirSync(uploadDir);
    console.log(`Total de arquivos encontrados: ${files.length}\n`);

    let totalSavedBytes = 0;
    let processedCount = 0;

    for (const file of files) {
        const filePath = path.join(uploadDir, file);
        const stats = fs.statSync(filePath);

        if (stats.isFile()) {
            const originalSize = stats.size;
            const ext = path.extname(file).toLowerCase();

            // Identifica se é uma imagem suportada
            if (['.jpg', '.jpeg', '.png', '.bmp'].includes(ext)) {
                console.log(`[Processando] ${file} (${(originalSize / 1024 / 1024).toFixed(2)} MB)`);
                const success = await compressImageInPlace(filePath);

                if (success) {
                    const newStats = fs.statSync(filePath);
                    const newSize = newStats.size;
                    const saved = originalSize - newSize;
                    totalSavedBytes += saved;
                    processedCount++;
                    
                    const ratio = ((saved / originalSize) * 100).toFixed(1);
                    console.log(`  -> Sucesso! Reduzido de ${(originalSize / 1024 / 1024).toFixed(2)} MB para ${(newSize / 1024 / 1024).toFixed(2)} MB (${ratio}% economizado)`);
                } else {
                    console.log(`  -> Ignorado ou erro.`);
                }
            }
        }
    }

    console.log('\n=== COMPACTAÇÃO FINALIZADA ===');
    console.log(`Total de imagens otimizadas: ${processedCount}`);
    console.log(`Espaço total economizado: ${(totalSavedBytes / 1024 / 1024).toFixed(2)} MB`);
}

run();
