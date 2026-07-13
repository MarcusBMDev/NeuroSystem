const express = require('express');
const router = express.Router();

// Importação dos Controladores
const authController = require('../controllers/authController');
const calcController = require('../controllers/calcController');
const guiaController = require('../controllers/guiaController');
const protocoloController = require('../controllers/protocoloController');
const receptionController = require('../controllers/receptionController');
const financeiroController = require('../controllers/financeiroController');
const managerController = require('../controllers/managerController');

// --- 1. ROTAS DE AUTENTICAÇÃO ---
router.post('/auth/login', authController.login);

// --- 2. ROTAS DE CÁLCULO DE GRADE ---
router.get('/calc/previsao', calcController.calcularPrevisao);

// --- 3. ROTAS DE GUIAS ---
router.get('/guias', guiaController.listarGuias);
router.post('/guias', guiaController.criarGuia);
router.get('/guias/pacientes', guiaController.buscarPacientes);
router.put('/guias/:id/status', guiaController.atualizarStatus);

// --- 4. ROTAS DE PROTOCOLOS ---
router.post('/protocolos/gerar', protocoloController.gerarProtocolo);
router.get('/protocolos', protocoloController.listarProtocolos);
router.get('/protocolos/:id', protocoloController.detalharProtocolo);
router.post('/protocolos/auditar', protocoloController.auditarProtocolo);

// --- 5. ROTAS DE RECEPÇÃO ---
router.get('/recepcao/hoje', receptionController.obterGradeHoje);
router.post('/recepcao/assinar-sessao', receptionController.assinarSessao);
router.post('/recepcao/sinalizar-problema', receptionController.sinalizarProblema);
router.get('/recepcao/alertas', receptionController.listarAlertasAtivos);
router.post('/recepcao/alertas/resolver', receptionController.resolverAlerta);

// --- 6. ROTAS FINANCEIRAS ---
router.get('/financeiro/tabela', financeiroController.listarValoresTabela);
router.post('/financeiro/tabela', financeiroController.salvarValorTabela);
router.get('/financeiro/negociacoes', financeiroController.listarNegociacoes);
router.post('/financeiro/negociacoes', financeiroController.salvarNegociacao);

// --- 7. ROTAS GERENCIAIS / FATURAMENTO ---
router.get('/gerencial/kpis', managerController.obterKPIs);
router.get('/gerencial/producao-convenio', managerController.obterProducaoPorConvenio);
router.get('/gerencial/excecoes', managerController.listarExcecoes);
router.get('/gerencial/historico-paciente', managerController.obterHistoricoPaciente);

module.exports = router;
