const RhModel = require('../models/RhModel');
const NotificacaoUtils = require('../utils/notificacoes');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const path = require('path');

const TARGET_RH_IDS = [79, 95];

const SolicitacaoController = {
    
    enviarNotificacoesRh: (usuarioId, titulo, resumo) => {
        const msgContent = `🧠 *NOVA SOLICITAÇÃO RH*\n📌 *Tipo:* ${titulo}\n👤 *Por:* ${resumo}`;
        NotificacaoUtils.enviarMensagem(usuarioId, TARGET_RH_IDS, msgContent);
        const msgUser = `✅ *SOLICITAÇÃO RECEBIDA*\nOlá! Sua solicitação de *${titulo}* foi enviada com sucesso para análise do RH.`;
        NotificacaoUtils.enviarMensagem(79, usuarioId, msgUser);
    },

    enviarNotificacaoAbaGroup: (usuarioId, titulo, resumo) => {
        const msgAba = `🧩 *NOTIFICAÇÃO COORDENAÇÃO ABA*\n📌 *Evento:* ${titulo}\n📋 *Detalhes:* ${resumo}`;
        NotificacaoUtils.enviarMensagemGrupo(usuarioId, 3, msgAba);
    },

    // 🌟 FUNÇÃO MÁGICA DE PREENCHIMENTO
    preencherPdfGenerico: async (templateName, outputName, dadosParaPreencher) => {
        try {
            const templatePath = path.join(__dirname, '../../public/uploads', templateName);
            const pdfBytes = await fs.readFile(templatePath);
            const pdfDoc = await PDFDocument.load(pdfBytes);
            const form = pdfDoc.getForm();

            const estiloFonte = await pdfDoc.embedFont(StandardFonts.Helvetica);

            for (const [nomeCampo, valor] of Object.entries(dadosParaPreencher)) {
                try {
                    const campo = form.getTextField(nomeCampo);
                    if (campo) {
                        campo.setText(valor || '');
                        
                        // Se for a justificativa, não forçamos tamanho fixo para permitir o "Auto" do PDFelement
                        if (nomeCampo !== 'justificativa') {
                            campo.setFontSize(11);
                        }
                        
                        campo.defaultUpdateAppearances(estiloFonte);
                    }
                } catch (e) {
                    console.warn(`[Aviso] Campo '${nomeCampo}' não encontrado no ${templateName}.`);
                }
            }

            form.flatten();

            const pdfFinalBytes = await pdfDoc.save();
            const caminhoDestino = path.join(__dirname, '../../public/uploads', outputName);
            await fs.writeFile(caminhoDestino, pdfFinalBytes);

            return `/uploads/${outputName}`; 

        } catch (error) {
            console.error(`Erro ao gerar PDF genérico (${templateName}):`, error);
            return null;
        }
    },

    // ⚠️ MANTIDO PARA COMPATIBILIDADE
    gerarDocumentoSolicitacao: async (tipo, usuarioNome, dados) => {
        try {
            const bases = {
                'dayoff': 'politica_dayoff.pdf',
                'formacao': 'politica_formacao.pdf',
                'saude': 'politica_saude.pdf'
            };
            const arquivoBase = bases[tipo];
            if (!arquivoBase) return null;

            const caminhoBase = path.join(__dirname, '../../public/uploads', arquivoBase);
            const dataBase = await fs.readFile(caminhoBase);

            const pdfDoc = await PDFDocument.load(dataBase);
            const pages = pdfDoc.getPages();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            
            let targetPage = (tipo === 'dayoff' && pages.length >= 3) ? pages[2] : pages[pages.length - 1];

            if (tipo === 'dayoff') {
                targetPage.drawText(usuarioNome, { x: 95, y: 700, size: 10, font: font });
                targetPage.drawText(dados['Cargo'] || '', { x: 235, y: 700, size: 10, font: font });
                targetPage.drawText(dados['CPF'] || '', { x: 375, y: 700, size: 10, font: font });
                targetPage.drawText(dados['Data do Evento'] || '', { x: 440, y: 676, size: 10, font: font });
                targetPage.drawText(new Date().toLocaleDateString('pt-BR'), { x: 135, y: 338, size: 11, font: font });
                targetPage.drawText(usuarioNome, { x: 250, y: 287, size: 10, font: font });
            } else {
                targetPage.drawText(usuarioNome, { x: 95, y: 700, size: 10, font: font });
                targetPage.drawText(new Date().toLocaleDateString('pt-BR'), { x: 135, y: 338, size: 11, font: font });
            }

            const pdfBytes = await pdfDoc.save();
            const nomeArquivo = `solicitacao_${tipo}_${Date.now()}.pdf`;
            const caminhoFinal = path.join(__dirname, '../../public/uploads', nomeArquivo);
            await fs.writeFile(caminhoFinal, pdfBytes);
            return '/uploads/' + nomeArquivo;

        } catch (error) {
            console.error("Erro ao gerar PDF antigo:", error);
            return null;
        }
    },

    // 1. DAY OFF
    salvarDayOff: async (req, res) => {
        try {
            const [ano, mes, dia] = req.body.data_aniversario.split('-');
            const dataAniversarioFormatada = `${dia}/${mes}/${ano}`;
            const dataHojeFormatada = new Date().toLocaleDateString('pt-BR');

            const formatarCPF = (cpfBruto) => {
                const cpfLimpo = cpfBruto.replace(/\D/g, '');
                if (cpfLimpo.length === 11) return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                return cpfBruto;
            };
            const cpfPronto = formatarCPF(req.body.cpf);
            const nomeDigitado = req.body.nome_completo ? req.body.nome_completo.trim() : req.session.user.username;

            const dadosParaPdf = {
                'nome': nomeDigitado,
                'cargo': req.body.cargo,
                'cpf': cpfPronto,
                'data_aniversario': dataAniversarioFormatada,
                'data_assinatura': dataHojeFormatada
            };

            const nomeFicheiroGerado = `dayoff_${req.session.user.id}_${Date.now()}.pdf`;
            const caminhoAnexoGerado = await SolicitacaoController.preencherPdfGenerico('template_dayoff.pdf', nomeFicheiroGerado, dadosParaPdf);

            const detalhes = `SOLICITAÇÃO DE DAY OFF (ANIVERSÁRIO)\n------------------------------------\nColaborador: ${nomeDigitado}\nCargo: ${req.body.cargo}\nCPF: ${cpfPronto}\nData do Aniversário: ${dataAniversarioFormatada}\nData do Pedido: ${dataHojeFormatada}`;

            const dadosDB = {
                usuario_id: req.session.user.id,
                tipo: 'dayoff',
                data_evento: req.body.data_aniversario,
                descricao: detalhes,
                caminho_anexo: caminhoAnexoGerado 
            };

            RhModel.criarSolicitacao(dadosDB, (err) => {
                if (err) return res.redirect('/?erro=Erro ao salvar.');
                SolicitacaoController.enviarNotificacoesRh(req.session.user.id, "DAY OFF", nomeDigitado);
                res.redirect('/?msg=Day Off solicitado com sucesso!');
            });
        } catch (error) {
            res.redirect('/?erro=Erro interno.');
        }
    },

    // 2. FORMAÇÃO
    salvarFormacao: async (req, res) => {
        try {
            const nomeDigitado = req.body.nome_completo ? req.body.nome_completo.trim() : req.session.user.username;
            const dataHojeFormatada = new Date().toLocaleDateString('pt-BR');
            const formatarData = (dataEua) => { if (!dataEua) return ''; const [ano, mes, dia] = dataEua.split('-'); return `${dia}/${mes}/${ano}`; };
            
            const formatarCPF = (cpfBruto) => {
                const cpfLimpo = (cpfBruto || '').replace(/\D/g, '');
                if (cpfLimpo.length === 11) return cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                return cpfBruto;
            };

            const dadosParaPdf = {
                'nome': nomeDigitado,
                'cargo': req.body.cargo || '',
                'cpf': formatarCPF(req.body.cpf),
                'curso': req.body.nome_curso || '',
                'instituicao': req.body.instituicao || '',
                'data_inicio': formatarData(req.body.data_inicio),
                'data_fim': formatarData(req.body.data_fim),
                'carga_horaria': req.body.carga_horaria || '',
                'local': req.body.local_formacao || '', 
                'justificativa': req.body.justificativa || '',
                'data_assinatura': dataHojeFormatada,
                'nome_assinatura': nomeDigitado
            };

            const nomeFicheiroGerado = `formacao_${req.session.user.id}_${Date.now()}.pdf`;
            const caminhoAnexoGerado = await SolicitacaoController.preencherPdfGenerico('template_formacao.pdf', nomeFicheiroGerado, dadosParaPdf);

            const detalhes = `SOLICITAÇÃO DE FORMAÇÃO / CURSO\n-------------------------------\nColaborador: ${nomeDigitado}\nCurso: ${req.body.nome_curso}\nLocal: ${req.body.local_formacao || 'Online'}`;

            const dadosDB = {
                usuario_id: req.session.user.id,
                tipo: 'formacao',
                data_evento: req.body.data_inicio,
                descricao: detalhes,
                caminho_anexo: caminhoAnexoGerado
            };

            RhModel.criarSolicitacao(dadosDB, (err) => {
                if (err) return res.redirect('/?erro=Erro.');
                SolicitacaoController.enviarNotificacoesRh(req.session.user.id, "FORMAÇÃO", req.body.nome_curso);
                res.redirect('/?msg=Formação solicitada com sucesso!');
            });
        } catch (error) {
            console.error("Erro Formação:", error);
            res.redirect('/?erro=Erro interno.');
        }
    },

    // 3. SAÚDE
    salvarBeneficio: async (req, res) => {
        try {
            const nomeDigitado = req.body.nome_colaborador ? req.body.nome_colaborador.trim() : req.session.user.username;
            const dataHojeFormatada = new Date().toLocaleDateString('pt-BR');
            const formatarData = (dataEua) => { if (!dataEua) return ''; const [ano, mes, dia] = dataEua.split('-'); return `${dia}/${mes}/${ano}`; };

            let servicoEscolhido = req.body.servico;
            if (servicoEscolhido === 'Outro' && req.body.servico_outro) servicoEscolhido = req.body.servico_outro;

            const dadosParaPdf = {
                'nome_colaborador': nomeDigitado,
                'cargo': req.body.cargo_colaborador || '',
                'telefone': req.body.telefone_colaborador || '',
                'nome_beneficiario': req.body.nome_beneficiario || '',
                'parentesco': req.body.parentesco || '',
                'nascimento_beneficiario': formatarData(req.body.nascimento_beneficiario),
                'servico': servicoEscolhido,
                'nome_assinatura': nomeDigitado,
                'data_assinatura': dataHojeFormatada
            };

            const nomeFicheiroGerado = `saude_${req.session.user.id}_${Date.now()}.pdf`;
            const caminhoAnexoGerado = await SolicitacaoController.preencherPdfGenerico('template_saude.pdf', nomeFicheiroGerado, dadosParaPdf);

            const detalhes = `SOLICITAÇÃO DE INCENTIVO À SAÚDE\n--------------------------------\nColaborador: ${nomeDigitado}\nBeneficiário: ${req.body.nome_beneficiario} (${req.body.parentesco})\nServiço: ${servicoEscolhido}`;

            const dadosDB = {
                usuario_id: req.session.user.id,
                tipo: 'saude',
                data_evento: null,
                descricao: detalhes,
                caminho_anexo: caminhoAnexoGerado
            };

            RhModel.criarSolicitacao(dadosDB, (err) => {
                if (err) return res.redirect('/?erro=Erro.');
                SolicitacaoController.enviarNotificacoesRh(req.session.user.id, "SAÚDE", req.body.nome_beneficiario);
                res.redirect('/?msg=Benefício solicitado com sucesso!');
            });
        } catch (error) {
            res.redirect('/?erro=Erro interno.');
        }
    },

    // 4. DESLIGAMENTO AT (Original)
    salvarDesligamentoAT: (req, res) => {
        let motivosStr = Array.isArray(req.body.motivos) ? req.body.motivos.join(', ') : (req.body.motivos || 'N/A');
        const detalhes = `Desligamento AT: ${req.body.nome_at}\n` +
                         `Paciente: ${req.body.nome_paciente}\n` +
                         `Solicitante: ${req.body.nome_solicitante} (${req.body.setor_cargo})\n` +
                         `Data da Solicitação: ${req.body.data_solicitacao}\n` +
                         `Motivos: ${motivosStr}\n` +
                         `Desligamento Imediato: ${req.body.desligamento_imediato}\n` +
                         `Apontamentos: ${req.body.apontamentos}`;
        const dados = { usuario_id: req.session.user.id, tipo: 'desligamento_at', data_evento: req.body.data_solicitacao, descricao: detalhes };
        RhModel.criarSolicitacao(dados, (err) => {
            SolicitacaoController.enviarNotificacoesRh(req.session.user.id, "ABA: DESLIGAMENTO", req.body.nome_at);
            res.redirect('/?msg=Solicitação de desligamento enviada!');
        });
    },

    // 5. CONTRATAÇÃO AT (Original)
    salvarContratacaoAT: (req, res) => {
        let tipoAtendimento = Array.isArray(req.body.tipo_atendimento) ? req.body.tipo_atendimento.join(', ') : (req.body.tipo_atendimento || '');
        let competencias = Array.isArray(req.body.competencias) ? req.body.competencias.join(', ') : (req.body.competencias || '');
        
        const detalhes = `Contratação AT\n` +
                         `Paciente: ${req.body.nome_paciente}\n` +
                         `Solicitante: ${req.body.nome_solicitante} (${req.body.setor_cargo}) - ${req.body.email}\n` +
                         `Localização: ${req.body.localizacao_paciente}\n` +
                         `Data Anamnese: ${req.body.data_anamnese}\n` +
                         `Atendimento: ${tipoAtendimento} | Horário: ${req.body.horario_atendimento}\n` +
                         `Supervisão: ${req.body.horario_supervisao}\n` +
                         `Motivo: ${req.body.motivo_solicitacao} | Seleção: ${req.body.tipo_selecao}\n` +
                         `Perfil Desejado: Sexo ${req.body.sexo_desejado}, Idade ${req.body.idade_desejada}\n` +
                         `Formação: ${req.body.formacao_desejada}\n` +
                         `Competências: ${competencias}\n` +
                         `Perfil DISC: ${req.body.disc}\n` +
                         `Apontamentos: ${req.body.apontamentos}`;

        const dados = { usuario_id: req.session.user.id, tipo: 'contratacao_at', data_evento: req.body.data_solicitacao, descricao: detalhes };
        RhModel.criarSolicitacao(dados, (err) => {
            SolicitacaoController.enviarNotificacoesRh(req.session.user.id, "ABA: CONTRATAÇÃO", req.body.nome_paciente);
            res.redirect('/?msg=Solicitação de contratação enviada!');
        });
    },

    // 6. ATESTADO MÉDICO (Original)
    salvarAtestado: (req, res) => {
        if (!req.file) return res.redirect('/?erro=Anexe o arquivo do atestado.');
        const detalhes = `Atestado Médico\nInício: ${req.body.data_inicio}\nQuantidade de Dias: ${req.body.dias}`;
        const dados = { 
            usuario_id: req.session.user.id, 
            tipo: 'atestado',
            data_evento: req.body.data_inicio, 
            descricao: detalhes, 
            caminho_anexo: '/uploads/' + req.file.filename 
        };
        RhModel.criarSolicitacao(dados, (err) => {
            SolicitacaoController.enviarNotificacoesRh(req.session.user.id, "ATESTADO MÉDICO", req.session.user.username);
            res.redirect('/?msg=Atestado enviado com sucesso!');
        });
    },

    // 7. SUPORTE INTERNO / HELP DESK
    salvarSuporte: (req, res) => {
        const { tipo, sala, unidade, urgente, descricao, email_afetado, impressora_modelo, assunto } = req.body;
        const usuarioId = req.session.user.id;
        const usuarioNome = req.session.user.username;

        let detalhes = `TIPO DE SUPORTE: `;
        let tipoSuporteNome = '';
        if (tipo === 'suporte_computador') {
            detalhes += `Computador\n`;
            tipoSuporteNome = 'Computador';
        } else if (tipo === 'suporte_email') {
            detalhes += `E-mail (${email_afetado})\n`;
            tipoSuporteNome = 'E-mail';
        } else if (tipo === 'suporte_impressora') {
            detalhes += `Impressora (${impressora_modelo || 'Não informado'})\n`;
            tipoSuporteNome = 'Impressora';
        } else if (tipo === 'suporte_diversos') {
            detalhes += `Diversos (${assunto})\n`;
            tipoSuporteNome = 'Problemas Diversos';
        }

        detalhes += `LOCAL/SALA: ${sala}\n` +
                    `UNIDADE: Unidade ${unidade}\n` +
                    `URGENTE: ${urgente}\n` +
                    `DESCRIÇÃO: ${descricao}`;

        const dados = {
            usuario_id: usuarioId,
            tipo: tipo,
            data_evento: null,
            descricao: detalhes
        };

        RhModel.criarSolicitacao(dados, (err) => {
            if (err) return res.redirect('/?erro=Erro ao enviar chamado de suporte.');
            
            // Alert user of RH (and Admins) via Neurochat
            const statusUrgente = urgente === 'Sim' ? '🚨 *URGENTE*' : '⏳ Normal';

            const msgContent = `🛠️ *NOVA SOLICITAÇÃO DE SUPORTE*\n` +
                               `👤 *Solicitante:* ${usuarioNome}\n` +
                               `📌 *Tipo:* Suporte de ${tipoSuporteNome}\n` +
                               `📍 *Local:* ${sala} - Unidade ${unidade}\n` +
                               `⚠️ *Urgência:* ${statusUrgente}\n` +
                               `📝 *Descrição:* ${descricao}`;

            // Busca os administradores/RH dinamicamente da tabela rh_admins
            const sqlAdmins = "SELECT user_id FROM rh_admins";
            RhModel.query(sqlAdmins, [], (errAdmins, resultsAdmins) => {
                let adminIds = [79, 95]; // Fallback caso ocorra erro
                if (!errAdmins && resultsAdmins && resultsAdmins.length > 0) {
                    adminIds = resultsAdmins.map(r => r.user_id);
                }
                
                // Envia alerta para os admins/RH
                NotificacaoUtils.enviarMensagem(usuarioId, adminIds, msgContent);
            });

            res.redirect('/?msg=Solicitação de suporte enviada com sucesso!');
        });
    }
};

module.exports = SolicitacaoController;