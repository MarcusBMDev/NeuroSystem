module Api
  class ProtocolosController < ApplicationController
    before_action -> { authorize!('gerar_protocolos') }, only: [:gerar]
    before_action -> { authorize!('auditar_protocolos') }, only: [:index, :show, :auditar]

    # POST /api/protocolos/gerar
    def gerar
      emissor_nome = params[:emissor_nome]
      guia_ids = params[:guia_ids]

      if emissor_nome.blank? || guia_ids.blank? || !guia_ids.is_a?(Array) || guia_ids.empty?
        render json: { error: 'Campos emissor_nome e guia_ids são obrigatórios.' }, status: :bad_request
        return
      end

      total_protocolos = NeurocontrolProtocolo.count + 1
      protocolo_numero = "##{total_protocolos.to_s.rjust(4, '0')}"

      ActiveRecord::Base.transaction do
        protocolo = NeurocontrolProtocolo.create!(
          protocolo_numero: protocolo_numero,
          emissor_nome: emissor_nome,
          data_emissao: Time.current,
          status: 'pendente'
        )

        guia_ids.each do |guia_id|
          NeurocontrolProtocoloItem.create!(
            protocolo_id: protocolo.id,
            guia_id: guia_id,
            status_item: 'pendente'
          )
          NeurocontrolGuia.where(id: guia_id).update_all(status: 'p_assinar')
        end

        render json: {
          success: true,
          protocolo_id: protocolo.id,
          protocolo_numero: protocolo_numero
        }
      end
    rescue StandardError => e
      render json: { error: "Erro interno ao gerar protocolo: #{e.message}" }, status: :internal_server_error
    end

    # GET /api/protocolos
    def index
      render json: NeurocontrolProtocolo.order(id: :desc)
    end

    # GET /api/protocolos/:id
    def show
      protocolo = NeurocontrolProtocolo.find_by(id: params[:id])
      return render json: { error: 'Protocolo não encontrado.' }, status: :not_found unless protocolo

      itens = NeurocontrolProtocoloItem.joins(guia: :paciente)
                                       .where(protocolo_id: protocolo.id)
                                       .select('neurocontrol_protocolo_itens.*, neurocontrol_guias.guia_numero, neurocontrol_guias.terapia, neurocontrol_guias.quantidade_autorizada, pacientes.nome as paciente_nome')

      render json: {
        protocolo: protocolo,
        itens: itens
      }
    end

    # POST /api/protocolos/auditar
    def auditar
      protocolo_id = params[:protocolo_id]
      itens_auditados = params[:itens_auditados]

      if protocolo_id.blank? || itens_auditados.blank? || !itens_auditados.is_a?(Array)
        render json: { error: 'Campos obrigatórios ausentes.' }, status: :bad_request
        return
      end

      algum_erro = false

      ActiveRecord::Base.transaction do
        itens_auditados.each do |item|
          status_guia = item[:status] == 'aceito' ? 'p_assinar' : 'inconsistente'
          algum_erro = true if item[:status] == 'inconsistente'

          pi = NeurocontrolProtocoloItem.find_by(protocolo_id: protocolo_id, guia_id: item[:guia_id])
          pi&.update!(status_item: item[:status], observacao: item[:observacao].presence)

          guia = NeurocontrolGuia.find_by(id: item[:guia_id])
          next unless guia

          paciente = Paciente.find_by(id: guia.paciente_id)

          if item[:status] == 'inconsistente'
            guia.update!(status: status_guia, observacao_inconsistencia: item[:observacao])
            if paciente
              NeurochatService.notificar_guia_devolvida(guia.guia_numero, paciente.nome, item[:observacao])
            end
          else
            guia.update!(status: status_guia, observacao_inconsistencia: nil, data_entrada_ci: Time.current)
          end
        end

        status_geral = algum_erro ? 'inconsistente' : 'recebido'
        NeurocontrolProtocolo.where(id: protocolo_id).update_all(status: status_geral)

        render json: {
          success: true,
          status_geral: status_geral
        }
      end
    rescue StandardError => e
      render json: { error: "Erro interno ao auditar protocolo: #{e.message}" }, status: :internal_server_error
    end
  end
end
