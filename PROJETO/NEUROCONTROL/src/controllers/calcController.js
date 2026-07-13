const db = require('../config/database');

// Tradutor de dias da semana JS para português do Rails
const WEEKDAYS_MAP = {
    0: 'domingo',
    1: 'segunda-feira',
    2: 'terça-feira',
    3: 'quarta-feira',
    4: 'quinta-feira',
    5: 'sexta-feira',
    6: 'sábado'
};

/**
 * Conta as ocorrências de um determinado dia da semana em um mês/ano específico.
 * @param {number} year 
 * @param {number} month (0 = Janeiro, 11 = Dezembro)
 * @param {string} targetWeekday - ex: 'terça-feira'
 */
function countWeekdayInMonth(year, month, targetWeekday) {
    const lastDay = new Date(year, month + 1, 0).getDate();
    let count = 0;
    for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const weekdayName = WEEKDAYS_MAP[dayOfWeek];
        if (weekdayName === targetWeekday.toLowerCase().trim()) {
            count++;
        }
    }
    return count;
}

const calcController = {
    /**
     * Calcula a expectativa de sessões para um paciente no mês corrente/selecionado
     * GET /api/calc/previsao?paciente_id=123&mes_vigente=2026-07
     */
    calcularPrevisao: async (req, res) => {
        try {
            const { paciente_id, mes_vigente } = req.query;

            if (!paciente_id || !mes_vigente) {
                return res.status(400).json({ error: 'Parâmetros paciente_id e mes_vigente são obrigatórios.' });
            }

            // Validar formato de mes_vigente (YYYY-MM)
            const parts = mes_vigente.split('-');
            if (parts.length !== 2) {
                return res.status(400).json({ error: 'Formato de mes_vigente inválido. Use YYYY-MM.' });
            }
            const year = parseInt(parts[0]);
            const month = parseInt(parts[1]) - 1; // 0-indexed em JS

            // Buscar a grade semanal de agendamentos confirmados do paciente no NEUROGESTÃO
            // fazendo um JOIN com profissionais para capturar a especialidade (terapia)
            const [schedules] = await db.query(`
                SELECT a.dia_semana, a.horario, p.especialidade, p.nome as profissional_nome
                FROM agendamentos a
                JOIN profissionais p ON a.profissional_id = p.id
                WHERE a.paciente_id = ? AND a.status = 'confirmado'
            `, [paciente_id]);

            if (schedules.length === 0) {
                return res.json({
                    paciente_id,
                    mes_vigente,
                    schedules: [],
                    previsao_por_terapia: {},
                    previsao_total: 0
                });
            }

            let previsao_por_terapia = {};
            let previsao_total = 0;

            schedules.forEach(sched => {
                const qtdSessoes = countWeekdayInMonth(year, month, sched.dia_semana);
                
                // Mapear especialidades/terapias para formato resumido (Badges do mockup)
                let terapia = 'Outra';
                const esp = sched.especialidade.toLowerCase();
                if (esp.includes('fono')) terapia = 'Fono';
                else if (esp.includes('psic')) terapia = 'Psico';
                else if (esp.includes('terapia ocupacional') || esp.includes('t.o') || esp === 'to') terapia = 'TO';
                else if (esp.includes('fisi')) terapia = 'Fisio';
                else terapia = sched.especialidade; // mantem o nome se não mapear

                if (!previsao_por_terapia[terapia]) {
                    previsao_por_terapia[terapia] = 0;
                }
                previsao_por_terapia[terapia] += qtdSessoes;
                previsao_total += qtdSessoes;
            });

            return res.json({
                paciente_id,
                mes_vigente,
                schedules,
                previsao_por_terapia,
                previsao_total
            });
        } catch (error) {
            console.error('Erro ao calcular previsão:', error);
            return res.status(500).json({ error: 'Erro interno ao calcular previsão.' });
        }
    }
};

module.exports = calcController;
