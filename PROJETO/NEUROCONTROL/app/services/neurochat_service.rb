require 'net/http'
require 'uri'
require 'json'

class NeurochatService
  def self.notificar(grupo, mensagem, grupo_id_custom = nil)
    target_grupo = grupo_id_custom.presence || grupo
    env_var_name = "NEUROCHAT_WEBHOOK_#{target_grupo.to_s.upcase}"
    webhook_url = ENV[env_var_name] || ENV['NEUROCHAT_WEBHOOK_URL']

    Rails.logger.info "[NEUROCHAT - GRUPO ID: #{target_grupo.to_s.upcase}] [#{Time.current}]:\n#{mensagem}"

    return unless webhook_url.present?

    uri = URI.parse(webhook_url)
    http = Net::HTTP.new(uri.host, uri.port)
    http.use_ssl = (uri.scheme == 'https')

    request = Net::HTTP::Post.new(uri.path, { 'Content-Type' => 'application/json' })
    request.body = {
      grupo_id: target_grupo,
      mensagem: mensagem,
      sistema: 'NEUROCONTROL',
      timestamp: Time.current.iso8601
    }.to_json

    http.request(request)
  rescue StandardError => e
    Rails.logger.error "❌ Erro ao disparar Webhook do NeuroChat para grupo #{target_grupo}: #{e.message}"
  end

  def self.notificar_retorno_agendamento_concluido(paciente_nome, guia_numero, grade_resumo, qtd_sessoes, grupo_id_target = nil)
    msg = "✅ *RETORNO DE AGENDAMENTO CONCLUÍDO*\n- *Paciente:* #{paciente_nome}\n- *Guia:* #{guia_numero}\n- *Grade Alocada:* #{grade_resumo.presence || 'Horários confirmados no NeuroGestão'}\n- *Previsão Calculada:* #{qtd_sessoes} sessões exigidas no mês\n- *Status:* Liberado para 1º atendimento presencial e coleta de assinaturas na Recepção."

    notificar('solicitacao', msg, grupo_id_target)
    notificar('recepcao', msg)
  end

  def self.notificar_guia_devolvida(guia_numero, paciente_nome, motivo)
    msg = "⚠️ *Alerta: Guia Devolvida por Inconsistência*\n- *Guia:* #{guia_numero}\n- *Paciente:* #{paciente_nome}\n- *Motivo:* #{motivo}\n- *Ação Exigida:* Chamar paciente ou regularizar via protocolo."
    notificar('agendamento', msg)
  end

  def self.notificar_ociosidade_agendamento(paciente_nome, dias_parado)
    msg = "⏳ *Alerta de Ociosidade (Coordenação Ester)*\nO paciente *#{paciente_nome}* está com guia liberada há *#{dias_parado} dias* sem inserção na grade. Verificar com a equipe de agendamento."
    notificar('agendamento', msg)
  end

  def self.notificar_paciente_chegou(profissional_neurochat_id, paciente_nome, horario)
    return if profissional_neurochat_id.blank?

    msg = "🔔 *PACIENTE CHEGOU NA RECEPÇÃO*\n" \
          "- *Paciente:* #{paciente_nome}\n" \
          "- *Horário:* #{horario.presence || 'Atendimento de hoje'}\n" \
          "- *Status:* Guia assinada e paciente aguardando na sala de espera."

    env_var_user = "NEUROCHAT_WEBHOOK_USER_#{profissional_neurochat_id}"
    user_webhook_url = ENV[env_var_user] || ENV['NEUROCHAT_WEBHOOK_DM_URL']

    if user_webhook_url.present?
      notificar("user_#{profissional_neurochat_id}", msg, "USER_#{profissional_neurochat_id}")
    else
      notificar('recepcao', msg)
    end
  end
end
