module Api
  class AlteracoesController < ApplicationController
    before_action -> { authorize!(['cadastrar_guias', 'ver_painel_geral']) }, only: [:solicitar]
    before_action -> { authorize!(['ver_painel_geral', 'cadastrar_guias', 'auditar_protocolos']) }, only: [:index]
    before_action -> { authorize!(['ver_painel_geral', 'auditar_protocolos', 'cadastrar_guias']) }, only: [:aprovar]
    before_action -> { authorize!(['ver_painel_geral', 'auditar_protocolos']) }, only: [:rejeitar]

    # POST /api/alteracoes/solicitar
    def solicitar
      alt = NeurocontrolSolicitacaoAlteracao.new(
        paciente_id: params[:paciente_id],
        tipo: params[:tipo],
        especialidade: params[:especialidade],
        motivo: params[:motivo],
        solicitado_por: params[:solicitado_por]
      )
      if alt.save
        render json: { success: true, message: 'Solicitação enviada para a coordenação!' }
      else
        render json: { error: alt.errors.full_messages.join(', ') }, status: :bad_request
      end
    end

    # GET /api/alteracoes
    def index
      alteracoes = NeurocontrolSolicitacaoAlteracao.joins(:paciente)
                                                   .select("neurocontrol_solicitacoes_alteracao.*, pacientes.nome as paciente_nome")
                                                   .order(created_at: :desc)
      render json: alteracoes
    end

    # POST /api/alteracoes/:id/aprovar
    def aprovar
      alt = NeurocontrolSolicitacaoAlteracao.find_by(id: params[:id])
      if alt&.update(status: 'aprovado', ciencia_coordenador_flag: true, coordenador_nome: params[:coordenador_nome], data_ciencia: Time.current)
        render json: { success: true, message: 'Aprovado com declaração de ciência!' }
      else
        render json: { error: 'Erro ao aprovar.' }, status: :bad_request
      end
    end

    # POST /api/alteracoes/:id/rejeitar
    def rejeitar
      alt = NeurocontrolSolicitacaoAlteracao.find_by(id: params[:id])
      if alt&.update(status: 'rejeitado')
        render json: { success: true, message: 'Solicitação rejeitada.' }
      else
        render json: { error: 'Erro ao rejeitar.' }, status: :bad_request
      end
    end
  end
end
