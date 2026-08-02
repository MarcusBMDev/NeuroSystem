class SlaAuditorJob < ApplicationJob
  queue_as :default

  def perform
    Rails.logger.info '🔄 [SLA Job] Executando auditoria de SLAs do NeuroControl...'

    # 1. Trava de Ociosidade: Guias liberadas há mais de 3 dias sem inserção na grade
    guias_ociosas = NeurocontrolGuia.joins("JOIN pacientes ON pacientes.id = neurocontrol_guias.paciente_id")
                                    .where("neurocontrol_guias.status IN ('aguardando_agendamento', 'liberado_para_grade')")
                                    .where("neurocontrol_guias.data_liberacao IS NOT NULL")
                                    .where("TIMESTAMPDIFF(DAY, neurocontrol_guias.data_liberacao, NOW()) >= 3")
                                    .select("neurocontrol_guias.id, pacientes.nome as paciente_nome, TIMESTAMPDIFF(DAY, neurocontrol_guias.data_liberacao, NOW()) as dias_ocioso")

    guias_ociosas.each do |item|
      NeurochatService.notificar_ociosidade_agendamento(item.paciente_nome, item.attributes['dias_ocioso'])
    end

    # 2. Trava de Retenção de Guias Assinadas: Presenças hoje sem protocolo
    presencas_sem_protocolo = NeurocontrolAssinaturaSessao
                              .joins("JOIN neurocontrol_guias ON neurocontrol_guias.id = neurocontrol_assinaturas_sessoes.guia_id")
                              .joins("JOIN pacientes ON pacientes.id = neurocontrol_guias.paciente_id")
                              .where("neurocontrol_assinaturas_sessoes.data_sessao = CURDATE()")
                              .where("neurocontrol_assinaturas_sessoes.status_assinatura = 'assinada'")
                              .where("neurocontrol_guias.status = 'aguardando_agendamento'")
                              .select("DISTINCT pacientes.nome as paciente_nome, neurocontrol_guias.guia_numero")

    presencas_sem_protocolo.each do |item|
      NeurochatService.notificar('controle_interno',
        "📌 *Alerta Protocolo Pendente:* Paciente *#{item.paciente_nome}* assinou guia *#{item.attributes['guia_numero']}* hoje, mas nenhum protocolo digital foi emitido pelo Agendamento."
      )
    end

    Rails.logger.info "✅ [SLA Job] Auditoria concluída. #{guias_ociosas.size} guias ociosas notificadas."
  end
end
