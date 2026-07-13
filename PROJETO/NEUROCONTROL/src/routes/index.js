const express = require('express');
const router = express.Router();

// Importação do Middleware de Acesso
const verificarPermissao = require('../middlewares/authMiddleware');

// Importação dos Controladores
const authController = require('../controllers/authController');
const calcController = require('../controllers/calcController');
const guiaController = require('../controllers/guiaController');
const protocoloController = require('../controllers/protocoloController');
const receptionController = require('../controllers/receptionController');
const financeiroController = require('../controllers/financeiroController');
const managerController = require('../controllers/managerController');
const profissionalController = require('../controllers/profissionalController');

// --- 1. ROTAS DE AUTENTICAÇÃO (LIVRES) ---
router.post('/auth/login', authController.login);

// --- 2. ROTAS DE CÁLCULO DE GRADE ---
router.get('/calc/previsao', verificarPermissao('cadastrar_guias'), calcController.calcularPrevisao);

// --- 3. ROTAS DE GUIAS ---
router.get('/guias', verificarPermissao('ver_painel_geral'), guiaController.listarGuias);
router.post('/guias', verificarPermissao('cadastrar_guias'), guiaController.criarGuia);
router.get('/guias/pacientes', verificarPermissao('cadastrar_guias'), guiaController.buscarPacientes);
router.put('/guias/:id/status', verificarPermissao('auditar_protocolos'), guiaController.atualizarStatus);

// --- 4. ROTAS DE PROTOCOLOS ---
router.post('/protocolos/gerar', verificarPermissao('gerar_protocolos'), protocoloController.gerarProtocolo);
router.get('/protocolos', verificarPermissao('auditar_protocolos'), protocoloController.listarProtocolos);
router.get('/protocolos/:id', verificarPermissao('auditar_protocolos'), protocoloController.detalharProtocolo);
router.post('/protocolos/auditar', verificarPermissao('auditar_protocolos'), protocoloController.auditarProtocolo);

// --- 5. ROTAS DE RECEPÇÃO ---
router.get('/recepcao/hoje', verificarPermissao('visualizar_risco'), receptionController.obterGradeHoje);
router.post('/recepcao/assinar-sessao', verificarPermissao('assinar_sessoes'), receptionController.assinarSessao);
router.post('/recepcao/sinalizar-problema', verificarPermissao('sinalizar_problemas'), receptionController.sinalizarProblema);
router.get('/recepcao/alertas', verificarPermissao('auditar_protocolos'), receptionController.listarAlertasAtivos);
router.post('/recepcao/alertas/resolver', verificarPermissao('auditar_protocolos'), receptionController.resolverAlerta);

// --- 6. ROTAS FINANCEIRAS ---
router.get('/financeiro/tabela', verificarPermissao('gerenciar_valores'), financeiroController.listarValoresTabela);
router.post('/financeiro/tabela', verificarPermissao('gerenciar_valores'), financeiroController.salvarValorTabela);
router.get('/financeiro/negociacoes', verificarPermissao('gerenciar_valores'), financeiroController.listarNegociacoes);
router.post('/financeiro/negociacoes', verificarPermissao('gerenciar_valores'), financeiroController.salvarNegociacao);

// --- 7. ROTAS GERENCIAIS / FATURAMENTO ---
router.get('/gerencial/kpis', verificarPermissao('ver_painel_geral'), managerController.obterKPIs);
router.get('/gerencial/producao-convenio', verificarPermissao('ver_painel_geral'), managerController.obterProducaoPorConvenio);
router.get('/gerencial/excecoes', verificarPermissao('ver_painel_geral'), managerController.listarExcecoes);
router.get('/gerencial/historico-paciente', verificarPermissao('ver_painel_geral'), managerController.obterHistoricoPaciente);

// --- 8. ROTAS DE PROFISSIONAIS ---
router.get('/profissionais', verificarPermissao('ver_profissionais'), profissionalController.listarProfissionais);

module.exports = router;
