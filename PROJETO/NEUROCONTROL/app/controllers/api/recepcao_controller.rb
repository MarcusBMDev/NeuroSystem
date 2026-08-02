module Api
  class RecepcaoController < ApplicationController
    before_action -> { authorize!('visualizar_risco') }, only: [:hoje]
    before_action -> { authorize!('assinar_sessoes') }, only: [:assinar_sessao]
    before_action -> { authorize!('sinalizar_problemas') }, only: [:sinalizar_problema]
    before_action -> { authorize!('auditar_protocolos') }, only: [:alertas, :resolver_alerta]

    WEEKDAYS_PT = %w[domingo segunda-feira terça-feira quarta-feira quinta-feira sexta-feira sábado].freeze

    # GET /api/recepcao/hoje
    def hoje
      dia_semana_hoje = WEEKDAYS_PT[Time.current.wday]
      unidade = params[:unidade]
      mes_atual = Time.current.strftime('%Y-%m')

      agendamentos = Agendamento.joins(:paciente, :profissional)
                                .where(dia_semana: dia_semana_hoje, status: 'confirmado')
                                .where(pacientes: { deleted_at: nil })

      if unidade.present? && unidade != 'todas'
        uni_str = "Unidade #{unidade}"
        agendamentos = agendamentos.where(
          'profissionais.unidade = ? OR profissionais.unidade = ? OR profissionais.unidade LIKE ? OR profissionais.especialidade LIKE ?',
          unidade, uni_str, "%#{uni_str}%", "%#{uni_str}%"
        )
      end

      agendamentos = agendamentos.order('agendamentos.horario ASC')
                                 .select(
                                   'agendamentos.id as agendamento_id, agendamentos.horario, agendamentos.dia_semana, ' \
                                   'pacientes.id as paciente_id, pacientes.nome as paciente_nome, ' \
                                   'profissionais.nome as profissional_nome, profissionais.especialidade, ' \
                                   'profissionais.unidade as profissional_unidade, profissionais.sala as profissional_sala'
                                 )

      grade_com_risco = agendamentos.map do |item|
        esp = item.attributes['especialidade'].to_s.downcase
        terapia = if esp.include?('fono') then 'Fono'
                  elsif esp.include?('psic') then 'Psico'
                  elsif esp.include?('terapia ocupacional') || esp.include?('t.o') || esp == 'to' then 'TO'
                  elsif esp.include?('fisi') then 'Fisio'
                  else 'Outra'
                  end

        guia = NeurocontrolGuia.find_by(paciente_id: item.attributes['paciente_id'], mes_vigente: mes_atual, terapia: terapia)

        status_assinatura_hoje = nil
        if guia
          assinatura = NeurocontrolAssinaturaSessao.find_by(guia_id: guia.id, data_sessao: Date.today)
          status_assinatura_hoje = assinatura&.status_assinatura
        end

        sem_guia_validada = guia.nil? || guia.status == 'inconsistente' || guia.status == 'aguardando_agendamento'

        {
          agendamento_id: item.attributes['agendamento_id'],
          horario: item.attributes['horario'],
          dia_semana: item.attributes['dia_semana'],
          paciente_id: item.attributes['paciente_id'],
          paciente_nome: item.attributes['paciente_nome'],
          profissional_nome: item.attributes['profissional_nome'],
          especialidade: item.attributes['especialidade'],
          profissional_unidade: item.attributes['profissional_unidade'],
          profissional_sala: item.attributes['profissional_sala'],
          guia_id: guia&.id,
          guia_numero: guia&.guia_numero,
          guia_status: guia&.status,
          quantidade_autorizada: guia&.quantidade_autorizada,
          previsao_calculada: guia&.previsao_calculada,
          status_assinatura_hoje: status_assinatura_hoje,
          risco_linha_vermelha: sem_guia_validada
        }
      end

      render json: grade_com_risco
    end

    # POST /api/recepcao/assinar-sessao
    def assinar_sessao
      guia_id = params[:guia_id]
      data_sessao = params[:data_sessao]

      if guia_id.blank? || data_sessao.blank?
        render json: { error: 'Campos guia_id e data_sessao são obrigatórios.' }, status: :bad_request
        return
      end

      guia = NeurocontrolGuia.find_by(id: guia_id)
      convenio_nome = guia&.paciente&.convenio&.nome.to_s.downcase

      if convenio_nome.include?('bradesco') || convenio_nome.include?('servir')
        if params[:token_autorizacao].blank?
          render json: { error: 'Erro: Para pacientes Bradesco e Servir, o Token de Autorização é obrigatório no ato da assinatura.' }, status: :bad_request
          return
        end
      end

      assinatura = NeurocontrolAssinaturaSessao.find_or_initialize_by(guia_id: guia_id, data_sessao: data_sessao)
      assinatura.status_assinatura = 'assinada'
      assinatura.data_assinatura = Time.current
      assinatura.created_by_user_id = params[:user_id]
      assinatura.token_autorizacao = params[:token_autorizacao] if params[:token_autorizacao].present?

      if assinatura.save
        begin
          if guia && guia.paciente_id
            dia_semana_hoje = WEEKDAYS_PT[Time.current.wday]
            agendamento = Agendamento.joins(:profissional)
                                     .where(paciente_id: guia.paciente_id, dia_semana: dia_semana_hoje, status: 'confirmado')
                                     .select('agendamentos.*, profissionais.id as prof_id, profissionais.neurochat_user_id')
                                     .first

            if agendamento && agendamento.attributes['neurochat_user_id'].present?
              paciente = Paciente.find_by(id: guia.paciente_id)
              NeurochatService.notificar_paciente_chegou(
                agendamento.attributes['neurochat_user_id'],
                paciente&.nome || 'Paciente',
                agendamento.horario
              )
            end
          end
        rescue StandardError => e
          Rails.logger.error "❌ Erro ao notificar profissional no NeuroChat: #{e.message}"
        end

        render json: { success: true, message: 'Assinatura registrada com sucesso!' }
      else
        render json: { error: 'Erro interno ao registrar assinatura.' }, status: :bad_request
      end
    end

    # POST /api/recepcao/sinalizar-problema
    def sinalizar_problema
      paciente_id = params[:paciente_id]
      mensagem = params[:mensagem]

      if paciente_id.blank? || mensagem.blank?
        render json: { error: 'Campos paciente_id e mensagem são obrigatórios.' }, status: :bad_request
        return
      end

      alerta = NeurocontrolAlerta.create(paciente_id: paciente_id, mensagem: mensagem, resolvido: 0)

      if alerta.persisted?
        render json: { success: true, message: 'Alerta enviado para o Controle Interno com sucesso!' }
      else
        render json: { error: 'Erro ao sinalizar problema.' }, status: :bad_request
      end
    end

    # GET /api/recepcao/alertas
    def alertas
      alertas = NeurocontrolAlerta.joins(:paciente)
                                  .where(resolvido: [0, false])
                                  .select('neurocontrol_alertas.*, pacientes.nome as paciente_nome')
                                  .order(id: :desc)
      render json: alertas
    end

    # POST /api/recepcao/alertas/resolver
    def resolver_alerta
      alerta_id = params[:alerta_id]
      alerta = NeurocontrolAlerta.find_by(id: alerta_id)

      if alerta&.update(resolvido: 1)
        render json: { success: true }
      else
        render json: { error: 'Erro ao resolver alerta.' }, status: :bad_request
      end
    end
  end
end
