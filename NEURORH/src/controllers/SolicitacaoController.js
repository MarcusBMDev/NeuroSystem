const RhModel = require('../models/RhModel');
const NotificacaoUtils = require('../utils/notificacoes');

const TARGET_RH_IDS = [79]; // Apenas o RH (ID 79) recebe notificações de novas solicitações

const SolicitacaoController = {
    
    // Helper central para enviar mensagens ao RH
    enviarNotificacoesRh: (usuarioId, titulo, resumo) => {
        const msgContent = `🧠 *NOVA SOLICITAÇÃO RH*\n` +
                           `📌 *Tipo:* ${titulo}\n` +
                           `👤 *Por:* ${resumo}`;
        
        NotificacaoUtils.enviarMensagem(usuarioId, TARGET_RH_IDS, msgContent);
    },

    // 1. PROCESSA DAY OFF
    salvarDayOff: (req, res) => {
        try {
            const detalhes = `
SOLICITAÇÃO DE DAY OFF (ANIVERSÁRIO)
------------------------------------
Colaborador: ${req.session.user.username}
Cargo: ${req.body.cargo}
CPF: ${req.body.cpf}

Data do Aniversário (Day Off): ${req.body.data_aniversario}

Termo de Aceite: O colaborador declarou estar ciente e de acordo com a política (60 dias antecedência).
            `;

            const dados = {
                usuario_id: req.session.user.id,
                tipo: 'dayoff',
                data_evento: req.body.data_aniversario,
                descricao: detalhes
            };

            RhModel.criarSolicitacao(dados, (err) => {
                if (err) {
                    console.error("Erro ao salvar Day Off:", err);
                    return res.redirect('/?erro=Erro ao salvar no banco de dados.');
                }
                
                SolicitacaoController.enviarNotificacoesRh(
                    req.session.user.id, 
                    "DAY OFF (Aniversário)", 
                    `${req.session.user.username} | Data: ${req.body.data_aniversario}`
                );

                res.redirect('/?msg=Day Off solicitado com sucesso! Aguarde aprovação.');
            });
        } catch (error) {
            console.error("Erro no Controller DayOff:", error);
            res.redirect('/?erro=Erro interno no servidor.');
        }
    },

    // 2. PROCESSA FORMAÇÃO (CURSOS)
    salvarFormacao: (req, res) => {
        try {
            const detalhes = `
SOLICITAÇÃO DE FORMAÇÃO / CURSO
-------------------------------
Colaborador: ${req.session.user.username}

DADOS DO EVENTO:
Curso: ${req.body.nome_curso}
Instituição: ${req.body.instituicao}
Local: ${req.body.local_formacao || 'Não informado'}
Carga Horária: ${req.body.carga_horaria}

PERÍODO:
Início: ${req.body.data_inicio}
Fim: ${req.body.data_fim}

JUSTIFICATIVA DE RELEVÂNCIA:
"${req.body.justificativa}"

Termo de Aceite: O colaborador declarou ciência das regras de formação.
            `;

            const dados = {
                usuario_id: req.session.user.id,
                tipo: 'formacao',
                data_evento: req.body.data_inicio,
                descricao: detalhes
            };

            RhModel.criarSolicitacao(dados, (err) => {
                if (err) {
                    console.error("Erro ao salvar Formação:", err);
                    return res.redirect('/?erro=Erro ao salvar solicitação.');
                }
                
                SolicitacaoController.enviarNotificacoesRh(
                    req.session.user.id, 
                    "CURSO / FORMAÇÃO", 
                    `${req.session.user.username} | Curso: ${req.body.nome_curso}`
                );

                res.redirect('/?msg=Solicitação de curso enviada para análise do RH!');
            });
        } catch (error) {
            console.error("Erro no Controller Formação:", error);
            res.redirect('/?erro=Erro interno.');
        }
    },

    // 3. PROCESSA SAÚDE (DESCONTOS)
    salvarBeneficio: (req, res) => {
        try {
            let servicoEscolhido = req.body.servico;
            if (servicoEscolhido === 'Outro' && req.body.servico_outro) {
                servicoEscolhido = `Outro: ${req.body.servico_outro}`;
            }

            const detalhes = `
SOLICITAÇÃO DE INCENTIVO À SAÚDE (DESCONTO)
-------------------------------------------
1. DADOS DO COLABORADOR
Nome (Sistema): ${req.session.user.username}
Nome (Formulário): ${req.body.nome_colaborador}
Cargo: ${req.body.cargo_colaborador}
Telefone: ${req.body.telefone_colaborador}

2. DADOS DO BENEFICIÁRIO (PACIENTE)
Nome Completo: ${req.body.nome_beneficiario}
Grau de Parentesco: ${req.body.parentesco}
Data Nascimento: ${req.body.nascimento_beneficiario}

3. SERVIÇO SOLICITADO
Especialidade: ${servicoEscolhido}

Termo de Aceite: O colaborador concorda com as regras de coparticipação e faltas.
            `;

            const dados = {
                usuario_id: req.session.user.id,
                tipo: 'saude',
                data_evento: null,
                descricao: detalhes
            };

            RhModel.criarSolicitacao(dados, (err) => {
                if (err) {
                    console.error("Erro ao salvar Saúde:", err);
                    return res.redirect('/?erro=Erro ao enviar solicitação de saúde.');
                }
                
                SolicitacaoController.enviarNotificacoesRh(
                    req.session.user.id, 
                    "INCENTIVO À SAÚDE", 
                    `${req.session.user.username} | Beneficiário: ${req.body.nome_beneficiario} (${req.body.parentesco})`
                );

                res.redirect('/?msg=Solicitação de saúde enviada ao RH!');
            });
        } catch (error) {
            console.error("Erro no Controller Saúde:", error);
            res.redirect('/?erro=Erro interno.');
        }
    },

    // 4. SOLICITAÇÃO ABA: DESLIGAMENTO DE AT
    salvarDesligamentoAT: (req, res) => {
        try {
            const motivos = Array.isArray(req.body.motivos) ? req.body.motivos.join(', ') : (req.body.motivos || 'Não informado');

            const detalhes = `
SOLICITAÇÃO DE DESLIGAMENTO DE AT (ABA)
---------------------------------------

DADOS DO SOLICITANTE:
Nome: ${req.body.nome_solicitante}
Setor/Cargo: ${req.body.setor_cargo}
Data da Solicitação: ${req.body.data_solicitacao}

DADOS DA VAGA/AT:
Nome do AT: ${req.body.nome_at}
Paciente Acompanhado: ${req.body.nome_paciente}

MOTIVO(S) DO DESLIGAMENTO:
${motivos}

DESLIGAMENTO IMEDIATO?
${req.body.desligamento_imediato}

APONTAMENTOS / OBSERVAÇÕES:
${req.body.apontamentos}
            `;

            const dados = {
                usuario_id: req.session.user.id,
                tipo: 'desligamento_at',
                data_evento: req.body.data_solicitacao,
                descricao: detalhes
            };

            RhModel.criarSolicitacao(dados, (err) => {
                if (err) {
                    console.error("Erro ao salvar Desligamento AT:", err);
                    return res.redirect('/?erro=Erro ao salvar solicitação.');
                }

                SolicitacaoController.enviarNotificacoesRh(
                    req.session.user.id, 
                    "ABA: DESLIGAMENTO DE AT", 
                    `Solicitante: ${req.body.nome_solicitante} | AT: ${req.body.nome_at}`
                );

                res.redirect('/?msg=Solicitação de desligamento enviada ao RH!');
            });
        } catch (error) {
            console.error("Erro no Controller Desligamento:", error);
            res.redirect('/?erro=Erro interno.');
        }
    },

    // 5. SOLICITAÇÃO ABA: CONTRATAÇÃO DE AT
    salvarContratacaoAT: (req, res) => {
        try {
            let competencias = req.body.competencias;
            if (Array.isArray(competencias)) {
                competencias = competencias.join(', ');
            } else if (!competencias) {
                competencias = "Nenhuma selecionada";
            }

            let tipoAtendimento = req.body.tipo_atendimento;
            if (Array.isArray(tipoAtendimento)) {
                tipoAtendimento = tipoAtendimento.join(', ');
            } else if (!tipoAtendimento) {
                tipoAtendimento = "Não informado";
            }

            const detalhes = `
SOLICITAÇÃO DE CONTRATAÇÃO DE AT (ABA)
--------------------------------------
1. DADOS DO SOLICITANTE
Nome: ${req.body.nome_solicitante}
E-mail: ${req.body.email}
Setor/Cargo: ${req.body.setor_cargo}
Data de Solicitação: ${req.body.data_solicitacao}

2. DADOS DO PACIENTE
Nome do Paciente: ${req.body.nome_paciente}
Data de Anamnese: ${req.body.data_anamnese}
Localização: ${req.body.localizacao_paciente}
Tipo de Atendimento: ${tipoAtendimento}

3. DETALHES DA VAGA
Horário de Atendimento: ${req.body.horario_atendimento}
Supervisão: ${req.body.horario_supervisao}
Motivo: ${req.body.motivo_solicitacao}
Tipo de Seleção: ${req.body.tipo_selecao}

4. PERFIL DO CANDIDATO
Sexo Desejado: ${req.body.sexo_desejado}
Idade Desejada: ${req.body.idade_desejada}
Formação: ${req.body.formacao_desejada}
Competências: ${competencias}
Perfil DISC: ${req.body.disc}

5. APONTAMENTOS / OBSERVAÇÕES
${req.body.apontamentos}
            `;

            const dados = {
                usuario_id: req.session.user.id,
                tipo: 'contratacao_at', 
                data_evento: req.body.data_solicitacao,
                descricao: detalhes
            };

            RhModel.criarSolicitacao(dados, (err) => {
                if (err) {
                    console.error("Erro ao salvar Contratação AT:", err);
                    return res.redirect('/?erro=Erro ao salvar solicitação.');
                }

                SolicitacaoController.enviarNotificacoesRh(
                    req.session.user.id, 
                    "ABA: CONTRATAÇÃO DE AT", 
                    `Paciente: ${req.body.nome_paciente} | Solicitante: ${req.body.nome_solicitante}`
                );

                res.redirect('/?msg=Solicitação de vaga enviada ao RH com sucesso!');
            });
        } catch (error) {
            console.error("Erro no Controller Contratação:", error);
            res.redirect('/?erro=Erro interno.');
        }
    }
};

module.exports = SolicitacaoController;