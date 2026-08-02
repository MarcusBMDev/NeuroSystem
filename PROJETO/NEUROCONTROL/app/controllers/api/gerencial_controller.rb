module Api
  class GerencialController < ApplicationController
    before_action -> { authorize!('ver_painel_geral') }, except: [:fechamento]
    before_action -> { authorize!('auditar_protocolos') }, only: [:fechamento]

    # GET /api/gerencial/kpis?mes_vigente=2026-07
    def kpis
      mes_vigente = params[:mes_vigente]
      return render json: { error: 'O parâmetro mes_vigente é obrigatório.' }, status: :bad_request if mes_vigente.blank?

      guias = NeurocontrolGuia.joins(:paciente).where(mes_vigente: mes_vigente).select('neurocontrol_guias.*, pacientes.convenio_id')

      receita_estimada = 0.0
      receita_validada = 0.0
      receita_em_risco = 0.0
      total_guias_abertas = 0
      total_sessoes_realizadas = 0
      pendencias_ci = 0

      guias.each do |g|
        valor_sessao = obter_valor_sessao(g.paciente_id, g.attributes['convenio_id'], g.terapia)
        valor_total_guia = g.quantidade_autorizada * valor_sessao

        receita_estimada += valor_total_guia

        realizadas_count = NeurocontrolAssinaturaSessao.where(guia_id: g.id, status_assinatura: 'assinada').count
        total_sessoes_realizadas += realizadas_count

        receita_validada += valor_total_guia if %w[p_faturar finalizado].include?(g.status)
        receita_em_risco += valor_total_guia if g.status == 'inconsistente' || g.assinatura_pendente_flag == true
        total_guias_abertas += 1 if %w[aguardando_agendamento p_assinar].include?(g.status)
        pendencias_ci += 1 if g.status == 'inconsistente'
      end

      dias_medio_raw = NeurocontrolGuia.where(mes_vigente: mes_vigente)
                                       .where.not(data_entrada_ci: nil)
                                       .pluck("AVG(TIMESTAMPDIFF(HOUR, data_liberacao, data_entrada_ci)) / 24.0").first

      dias_medio = dias_medio_raw.present? ? dias_medio_raw.to_f.round(1) : 0.0

      render json: {
        receita_estimada: receita_estimada,
        receita_validada: receita_validada,
        receita_em_risco: receita_em_risco,
        guias_em_aberto: total_guias_abertas,
        sessoes_realizadas: total_sessoes_realizadas,
        pendencias_ci: pendencias_ci,
        tempo_medio_auditoria: "#{dias_medio} dias"
      }
    end

    # GET /api/gerencial/producao-convenio?mes_vigente=2026-07
    def producao_convenio
      mes_vigente = params[:mes_vigente]
      return render json: { error: 'Parâmetro mes_vigente obrigatório.' }, status: :bad_request if mes_vigente.blank?

      guias = NeurocontrolGuia.joins(paciente: :convenio)
                              .where(mes_vigente: mes_vigente)
                              .select('neurocontrol_guias.*, convenios.nome as convenio_nome, convenios.id as convenio_id')

      convenio_map = {}

      guias.each do |g|
        conv_nome = g.attributes['convenio_nome']
        valor_sessao = obter_valor_sessao(g.paciente_id, g.attributes['convenio_id'], g.terapia)
        valor_faturamento = g.quantidade_autorizada * valor_sessao

        convenio_map[conv_nome] ||= { nome: conv_nome, autorizado: 0.0, faturado: 0.0, guias_total: 0 }
        convenio_map[conv_nome][:autorizado] += valor_faturamento
        convenio_map[conv_nome][:guias_total] += 1
        convenio_map[conv_nome][:faturado] += valor_faturamento if %w[p_faturar finalizado].include?(g.status)
      end

      lista_convenios = convenio_map.values.map do |c|
        pct = c[:autorizado] > 0 ? ((c[:faturado] / c[:autorizado]) * 100).round : 0
        {
          nome: c[:nome],
          valor: c[:autorizado],
          faturado: c[:faturado],
          guias: c[:guias_total],
          porcentagem: pct
        }
      end.sort_by { |c| -c[:valor] }

      render json: lista_convenios
    end

    # GET /api/gerencial/excecoes
    def excecoes
      excecoes = NeurocontrolGuia.joins(paciente: :convenio)
                                 .where(assinatura_pendente_flag: true)
                                 .select('neurocontrol_guias.*, pacientes.nome as paciente_nome, convenios.nome as convenio_nome')
                                 .order(updated_at: :desc)
      render json: excecoes
    end

    # GET /api/gerencial/historico-paciente?paciente_id=123
    def historico_paciente
      paciente_id = params[:paciente_id]
      return render json: { error: 'paciente_id obrigatório.' }, status: :bad_request if paciente_id.blank?

      historico = NeurocontrolGuia.joins(paciente: :convenio)
                                  .where(paciente_id: paciente_id)
                                  .select('neurocontrol_guias.*, convenios.nome as convenio_nome')
                                  .order(mes_vigente: :desc, id: :desc)

      render json: historico
    end

    # GET /api/gerencial/fechamento?mes_vigente=2026-07
    def fechamento
      mes_vigente = params[:mes_vigente]
      return render json: { error: 'O parâmetro mes_vigente é obrigatório.' }, status: :bad_request if mes_vigente.blank?

      guias = NeurocontrolGuia.joins(paciente: :convenio)
                              .where(mes_vigente: mes_vigente, status: 'p_assinar')
                              .select(
                                'neurocontrol_guias.*, pacientes.nome as paciente_nome, convenios.nome as convenio_nome, ' \
                                '(SELECT COUNT(*) FROM neurocontrol_assinaturas_sessoes WHERE guia_id = neurocontrol_guias.id AND status_assinatura = \'assinada\') as sessoes_assinadas'
                              )
                              .order('pacientes.nome ASC')

      render json: guias
    end

    # GET /api/gerencial/visao-consolidada?mes_vigente=2026-07
    def visao_consolidada
      mes_vigente = params[:mes_vigente].presence || Time.current.strftime('%Y-%m')
      dias_semana = %w[domingo segunda-feira terça-feira quarta-feira quinta-feira sexta-feira sábado]
      dia_semana_hoje = dias_semana[Time.current.wday]

      guias_mes = NeurocontrolGuia.where(mes_vigente: mes_vigente).count
      guias_ociosas = NeurocontrolGuia.where("status IN ('aguardando_agendamento', 'liberado_para_grade') AND TIMESTAMPDIFF(DAY, created_at, NOW()) >= 3").count
      aguardando_agenda = NeurocontrolGuia.where(status: %w[aguardando_agendamento liberado_para_grade]).count
      protocolos_em_transito = NeurocontrolProtocolo.where(status: 'pendente').count
      agendamentos_hoje = Agendamento.joins(:paciente).where(dia_semana: dia_semana_hoje, status: 'confirmado').where(pacientes: { deleted_at: nil }).count
      assinadas_hoje = NeurocontrolAssinaturaSessao.where(data_sessao: Date.today, status_assinatura: 'assinada').count
      alertas_recepcao = NeurocontrolAlerta.where(resolvido: [0, false]).count
      protocolos_para_auditar = NeurocontrolProtocolo.where(status: 'pendente').count
      guias_inconsistentes = NeurocontrolGuia.where(status: 'inconsistente').count
      overrides_sem_assinatura = NeurocontrolGuia.where(assinatura_pendente_flag: true).count
      guias_p_faturar = NeurocontrolGuia.where(status: 'p_faturar', mes_vigente: mes_vigente).count

      render json: {
        mes_vigente: mes_vigente,
        solicitacao: { total_guias_mes: guias_mes, guias_ociosas_sla: guias_ociosas },
        agendamento: { guias_aguardando_agenda: aguardando_agenda, protocolos_em_transito: protocolos_em_transito },
        recepcao: { agendamentos_hoje: agendamentos_hoje, sessoes_assinadas_hoje: assinadas_hoje, alertas_pendentes: alertas_recepcao },
        controle_interno: { protocolos_pendentes: protocolos_para_auditar, guias_devolvidas_inconsistentes: guias_inconsistentes, overrides_sem_assinatura: overrides_sem_assinatura },
        faturamento: { guias_prontas_faturamento: guias_p_faturar }
      }
    end

    # GET /api/gerencial/exportar-faturamento?mes_vigente=2026-07
    def exportar_faturamento
      mes_vigente = params[:mes_vigente].presence || Time.current.strftime('%Y-%m')

      scope = NeurocontrolGuia.joins(paciente: :convenio)
                              .where(mes_vigente: mes_vigente)
                              .select('neurocontrol_guias.*, pacientes.nome as paciente_nome, convenios.nome as convenio_nome, convenios.id as convenio_id')
                              .order('convenios.nome ASC, pacientes.nome ASC')

      if params[:convenio_id].present? && params[:convenio_id] != 'todos'
        scope = scope.where('convenios.id = ?', params[:convenio_id])
      end

      itens = scope.map do |g|
        valor_sessao = obter_valor_sessao(g.paciente_id, g.attributes['convenio_id'], g.terapia)
        valor_total = g.quantidade_autorizada.to_i * valor_sessao

        sched = Agendamento.joins(:profissional)
                           .where(paciente_id: g.paciente_id, status: 'confirmado')
                           .select('agendamentos.dia_semana, profissionais.nome as profissional_nome')
                           .first

        {
          id: g.id,
          plano: g.attributes['convenio_nome'],
          paciente: g.attributes['paciente_nome'],
          terapia: g.terapia,
          profissional: sched&.attributes&.fetch('profissional_nome', 'Não definido') || 'Não definido',
          dia_semana: sched&.attributes&.fetch('dia_semana', '-') || '-',
          guia_numero: g.guia_numero,
          qtd_faturada: g.quantidade_autorizada,
          valor_sessao: valor_sessao,
          valor_total: valor_total,
          status: %w[p_faturar finalizado].include?(g.status) ? 'FINALIZADO' : 'AGUARDANDO GUIA',
          debito: g.assinatura_pendente_flag ? 'Assinatura Pendente' : '-'
        }
      end

      render json: {
        mes_vigente: mes_vigente,
        total_registros: itens.size,
        total_valor: itens.sum { |i| i[:valor_total] },
        itens: itens
      }
    end

    # GET /api/gerencial/pendencias-recepcao
    def pendencias_recepcao
      guias = NeurocontrolGuia.joins(:paciente)
                              .where(assinatura_pendente_flag: true)
                              .select('neurocontrol_guias.*, pacientes.nome as paciente_nome')
                              .order(updated_at: :desc)

      render json: guias.map { |g|
        g.attributes.merge(
          paciente_nome: g.attributes['paciente_nome'],
          guia_numero: g.guia_numero,
          mes_vigente: g.mes_vigente
        )
      }
    end

    private

    def obter_valor_sessao(paciente_id, convenio_id, terapia)
      neg = NeurocontrolNegociacao.where(paciente_id: paciente_id).order(id: :desc).first
      return neg.valor_diferenciado.to_f if neg.present?

      termo = case terapia
              when 'Psico' then '%psic%'
              when 'Fono' then '%fono%'
              when 'TO' then '%ocupacional%'
              when 'Fisio' then '%fisi%'
              else '%'
              end

      val = NeurocontrolTabelaValor.where(convenio_id: convenio_id).where('especialidade LIKE ?', termo).first
      return val.valor_sessao.to_f if val.present?

      120.00
    end
  end
end
