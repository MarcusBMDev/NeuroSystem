class Api::TransferenciasController < ApplicationController
  before_action :validar_acesso_gestao!, except: [:create]
  before_action :validar_acesso_exclusivo_agendamento!, except: [:create]
  before_action :validar_usuario_logado!, only: [:create]
  before_action :validar_autorizador!, only: [:aprovar, :rejeitar]
  # GET /transferencias
  def index
    status_filter = params[:status].presence || 'pendente'
    
    transferencias = Transferencia.includes(:paciente, :de_profissional, :para_profissional)
    
    if status_filter == 'historico'
      transferencias = transferencias.where.not(status: 'pendente')
    else
      transferencias = transferencias.where(status: status_filter)
    end

    if params[:dia].present? || params[:mes].present?
      year = Date.today.year
      month = params[:mes].present? ? params[:mes].to_i : Date.today.month
      day = params[:dia].present? ? params[:dia].to_i : 1
      
      begin
        if params[:dia].present?
          date = Date.new(year, month, day)
          transferencias = transferencias.where(created_at: date.beginning_of_day..date.end_of_day)
        else
          start_date = Date.new(year, month, 1)
          end_date = start_date.end_of_month
          transferencias = transferencias.where(created_at: start_date.beginning_of_day..end_date.end_of_day)
        end
      rescue ArgumentError
      end
    end
    
    transferencias = transferencias.order(created_at: :desc)
    
    render json: transferencias.as_json(
      include: {
        paciente: { only: [:id, :nome] },
        de_profissional: { only: [:id, :nome] },
        para_profissional: { only: [:id, :nome] }
      }
    )
  end

  # POST /transferencias
  def create
    t = Transferencia.new(transferencia_params)
    t.status = 'pendente'
    
    if t.save
      AuditoriaService.log(request, 'SOLICITAR_TRANSFERENCIA', t, "Tipo: #{t.tipo}, Paciente: #{t.paciente&.nome}")
      render json: { mensagem: "Solicitação de transferência enviada para análise da gestão." }, status: :created
    else
      render json: { errors: t.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /transferencias/:id/aprovar
  def aprovar
    t = Transferencia.find(params[:id])
    
    if t.status != 'pendente'
      return render json: { errors: ["Esta solicitação já foi processada."] }, status: :unprocessable_entity
    end

    begin
      Agendamento.transaction do
        case t.tipo
        when 'transferencia'
          processar_aprovacao_transferencia(t)
        when 'remocao'
          processar_aprovacao_remocao(t)
        when 'reducao'
          processar_aprovacao_reducao(t)
        end
        t.update!(status: 'aprovado')
      end

      # Notificação NeuroChat (para todos os tipos aplicáveis)
      notificar_gestao_aprovacao(t)

      # --- NOVA NOTIFICAÇÃO PARA GRUPOS OPERACIONAIS (6 e 7) ---
      begin
        setor = request.headers['X-User-Role'] || 'Gestão'
        case t.tipo
        when 'transferencia'
          NeurochatService.notificar_transferencia_paciente(t.paciente, t.de_profissional, t.para_profissional, t.motivo, setor, t.novo_dia_semana, t.novo_horario, params[:user_id])
        end
      rescue => e
        Rails.logger.error "Falha ao emitir notificação operacional: #{e.message}"
      end

      AuditoriaService.log(request, 'APROVAR_TRANSFERENCIA', t, "Tipo: #{t.tipo}, Executor: #{request.headers['X-User-Name']}")
      render json: { mensagem: "Solicitação aprovada e executada com sucesso!" }
    rescue => e
      render json: { errors: [e.message] }, status: :unprocessable_entity
    end
  end

  # POST /transferencias/:id/rejeitar
  def rejeitar
    t = Transferencia.find(params[:id])
    if t.update(status: 'rejeitado')
      AuditoriaService.log(request, 'REJEITAR_TRANSFERENCIA', t, "Rejeitado por #{request.headers['X-User-Name']}")
      render json: { mensagem: "Solicitação rejeitada com sucesso." }
    else
      render json: { errors: ["Falha ao rejeitar solicitação."] }, status: :unprocessable_entity
    end
  end

  private

  def validar_autorizador!
    user_name = request.headers['X-User-Name']&.to_s&.downcase&.strip
    unless ['ester', 'camila'].include?(user_name)
      render json: { errors: ["Acesso Negado. Apenas Ester e Camila podem autorizar solicitações."] }, status: :forbidden
    end
  end

  def processar_aprovacao_transferencia(t)
    if t.agendamento_origem_id.present? && t.novo_horario.present? && t.novo_dia_semana.present?
      # Caso 1: Transferência para horário específico escolhido no modal
      ag = Agendamento.find(t.agendamento_origem_id)
      
      # Verifica conflitos (ignora se o pedido de transferência for marcado como encaixe)
      if !t.encaixe && Agendamento.where.not(id: ag.id).exists?(profissional_id: t.para_profissional_id, dia_semana: t.novo_dia_semana, horario: t.novo_horario)
        raise "Horário #{t.novo_dia_semana} às #{t.novo_horario} já está ocupado no profissional de destino."
      end
      
      detalhes_log = {
        profissional_id: t.para_profissional_id,
        profissional_nome: t.para_profissional&.nome,
        dia_semana: t.novo_dia_semana,
        horario: t.novo_horario,
        paciente_id: ag.paciente_id,
        paciente_nome: ag.paciente&.nome,
        status: ag.status,
        motivo: t.motivo,
        origem_profissional_id: t.de_profissional_id,
        operador: request.headers['X-User-Name'] || t.solicitante
      }
      AuditoriaService.log(request, 'TRANSFERENCIA_DIRETA', ag, detalhes_log)

      ag.update!(
        profissional_id: t.para_profissional_id,
        dia_semana: t.novo_dia_semana,
        horario: t.novo_horario,
        encaixe: t.encaixe,
        data_encaixe: t.encaixe ? Date.today : nil
      )
    else
      # Caso 2: Fallback para comportamento antigo (transfere todos os horários para EXATAMENTE os mesmos slots)
      agendamentos = Agendamento.where(profissional_id: t.de_profissional_id, paciente_id: t.paciente_id)
      raise "Nenhum agendamento encontrado para transferência." if agendamentos.empty?

      agendamentos.each do |ag|
        if Agendamento.where.not(id: ag.id).exists?(profissional_id: t.para_profissional_id, dia_semana: ag.dia_semana, horario: ag.horario)
          raise "Horário #{ag.dia_semana} às #{ag.horario} ocupado no profissional de destino."
        end
        
        detalhes_log = {
          profissional_id: t.para_profissional_id,
          profissional_nome: t.para_profissional&.nome,
          dia_semana: ag.dia_semana,
          horario: ag.horario,
          paciente_id: ag.paciente_id,
          paciente_nome: ag.paciente&.nome,
          status: ag.status,
          motivo: t.motivo,
          origem_profissional_id: t.de_profissional_id,
          operador: request.headers['X-User-Name'] || t.solicitante
        }
        AuditoriaService.log(request, 'TRANSFERENCIA_DIRETA', ag, detalhes_log)

        ag.update!(profissional_id: t.para_profissional_id)
      end
    end
  end

  def processar_aprovacao_remocao(t)
    ids = JSON.parse(t.agendamento_ids || "[]")
    agendamentos = Agendamento.includes(:profissional).where(id: ids)
    
    if agendamentos.empty?
      Rails.logger.warn "Aviso: Agendamentos para remoção (IDs: #{ids}) já não existem no banco."
      return
    end

    setor = t.solicitante.presence || 'Gestão'

    # Log das remoções individuais para auditoria estruturada
    agendamentos.each do |ag|
      detalhes_log = {
        profissional_id: ag.profissional_id,
        profissional_nome: ag.profissional&.nome,
        dia_semana: ag.dia_semana,
        horario: ag.horario,
        paciente_id: ag.paciente_id,
        paciente_nome: ag.paciente&.nome,
        status: ag.status,
        motivo: t.motivo.presence || 'Remoção aprovada pela gestão',
        operador: request.headers['X-User-Name'] || t.solicitante
      }
      AuditoriaService.log(request, 'EXCLUIR_AGENDAMENTO', ag, detalhes_log)
    end

    # Notifica o Grupo 14 com TODOS os agendamentos de uma só vez antes de destruir
    begin
      NeurochatService.notificar_remocao_grade(
        t.paciente,
        agendamentos,
        t.motivo.presence || 'Remoção aprovada pela gestão',
        setor,
        request.headers['X-User-Name'].presence
      )
    rescue => e
      Rails.logger.error "Erro ao notificar remoção agrupada: #{e.message}"
    end

    agendamentos.destroy_all
  end

  def processar_aprovacao_reducao(t)
    ids = JSON.parse(t.agendamento_ids || "[]")
    agendamentos = Agendamento.includes(:profissional).where(id: ids)
    
    if agendamentos.empty?
      Rails.logger.warn "Aviso: Agendamentos para redução (IDs: #{ids}) já não existem no banco."
      return
    end
    
    # Quantidade de sessões removidas
    removidas = agendamentos.count
    
    setor = t.solicitante.presence || 'Gestão'
    
    # Log das reduções individuais para auditoria estruturada
    agendamentos.each do |ag|
      detalhes_log = {
        profissional_id: ag.profissional_id,
        profissional_nome: ag.profissional&.nome,
        dia_semana: ag.dia_semana,
        horario: ag.horario,
        paciente_id: ag.paciente_id,
        paciente_nome: ag.paciente&.nome,
        status: ag.status,
        motivo: t.motivo.presence || 'Redução aprovada pela gestão',
        operador: request.headers['X-User-Name'] || t.solicitante
      }
      AuditoriaService.log(request, 'EXCLUIR_AGENDAMENTO', ag, detalhes_log)
    end

    # Notifica o Grupo 14 com TODOS os agendamentos de uma só vez antes de destruir
    begin
      NeurochatService.notificar_reducao_grade(
        t.paciente,
        agendamentos,
        t.motivo.presence || 'Redução aprovada pela gestão',
        setor,
        request.headers['X-User-Name'].presence
      )
    rescue => e
      Rails.logger.error "Erro ao notificar redução agrupada: #{e.message}"
    end
    
    agendamentos.destroy_all
    
    # Atualiza a frequência do paciente
    p = t.paciente
    nova_freq = [ (p.weekly_frequency || 1) - removidas, 1 ].max
    p.update!(weekly_frequency: nova_freq)
  end

  def notificar_gestao_aprovacao(t)
    # Atualmente a notificação é disparada para o grupo de gestão no NeuroChat
    begin
      paciente = t.paciente
      tipo_msg = case t.tipo
                when 'transferencia' then "Uma TRANSFERÊNCIA"
                when 'remocao'       then "Uma REMOÇÃO"
                when 'reducao'       then "Uma REDUÇÃO"
                end

      profissional_nome = t.para_profissional&.nome || t.de_profissional&.nome || "Equipe"
      # Log de auditoria ou integração futura
      Rails.logger.info "Aprovação: #{tipo_msg} de #{paciente.nome} (#{profissional_nome})"
    rescue StandardError => e
      Rails.logger.error "Erro na notificação: #{e.message}"
    end
  end

  def transferencia_params
    params.require(:transferencia).permit(
      :paciente_id, :de_profissional_id, :para_profissional_id, 
      :motivo, :tipo, :solicitante, :agendamento_ids,
      :agendamento_origem_id, :novo_dia_semana, :novo_horario, :encaixe
    )
  end

  def validar_acesso_exclusivo_agendamento!
    access_level = request.headers['X-User-Access-Level']&.to_s&.downcase&.strip
    if access_level == 'neurochat'
      user_id = request.headers['X-User-Id']
      is_super = false
      if user_id.present?
        is_super_val = NeurochatRecord.connection.select_value(
          ActiveRecord::Base.send(:sanitize_sql_array, ["SELECT is_super_admin FROM users WHERE id = ?", user_id])
        )
        is_super = [1, true, '1', 'true'].include?(is_super_val)
      end

      unless is_super
        render json: { error: "Acesso Negado. Esta funcionalidade é exclusiva para o agendamento local." }, status: :forbidden
      end
    end
  end
end