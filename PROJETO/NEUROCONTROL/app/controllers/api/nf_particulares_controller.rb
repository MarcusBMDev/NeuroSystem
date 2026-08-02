module Api
  class NfParticularesController < ApplicationController
    before_action -> { authorize!(['faturar_guias', 'cadastrar_guias', 'ver_painel_geral']) }, only: [:index, :create]
    before_action -> { authorize!(['faturar_guias', 'ver_painel_geral']) }, only: [:atualizar_nf, :destroy]

    def index
      target_mes = params[:mes_competencia].presence || Time.current.strftime('%Y-%m')

      scope = NeurocontrolNfParticular.order(created_at: :desc, id: :desc)
      scope = scope.where(mes_competencia: target_mes) unless target_mes == 'todas'

      if params[:q].present?
        q = "%#{params[:q].strip}%"
        scope = scope.where('paciente_nome LIKE ? OR responsavel_nome LIKE ? OR responsavel_cpf LIKE ? OR nf_numero LIKE ?', q, q, q, q)
      end

      registros = scope.all
      total_faturado = registros.sum(&:valor_final).to_f
      qtd_emitidas = registros.count { |r| r.status_emissao == 'emitida' }
      qtd_pendentes = registros.count { |r| r.status_emissao == 'pendente' }

      render json: {
        registros: registros,
        totais: {
          total_faturado: total_faturado,
          qtd_emitidas: qtd_emitidas,
          qtd_pendentes: qtd_pendentes,
          total_registros: registros.size
        }
      }
    end

    def create
      record = NeurocontrolNfParticular.new(
        paciente_nome: params[:paciente_nome].to_s.strip,
        terapia_procedimento: params[:terapia_procedimento],
        responsavel_nome: params[:responsavel_nome] || 'Responsável',
        responsavel_cpf: params[:responsavel_cpf],
        responsavel_dados: params[:responsavel_dados],
        quantidade_realizada: params[:quantidade_realizada] || '1',
        valor_final: params[:valor_final].to_f,
        observacoes: params[:observacoes],
        mes_competencia: params[:mes_competencia],
        criado_por: params[:criado_por] || 'Operacional'
      )

      if record.save
        render json: { success: true, message: '✅ Paciente particular cadastrado para controle de NF!', id: record.id }
      else
        render json: { error: record.errors.full_messages.join(', ') }, status: :bad_request
      end
    end

    def atualizar_nf
      record = NeurocontrolNfParticular.find_by(id: params[:id])
      return render json: { error: 'Registro não encontrado.' }, status: :not_found unless record

      nf_num = params[:nf_numero].presence
      status = params[:status_emissao].presence || (nf_num.present? ? 'emitida' : 'pendente')

      if record.update(nf_numero: nf_num, status_emissao: status)
        render json: { success: true, message: '✅ Nota Fiscal atualizada com sucesso!' }
      else
        render json: { error: 'Erro ao atualizar Nota Fiscal.' }, status: :bad_request
      end
    end

    def destroy
      record = NeurocontrolNfParticular.find_by(id: params[:id])
      if record&.destroy
        render json: { success: true }
      else
        render json: { error: 'Erro ao excluir registro.' }, status: :bad_request
      end
    end
  end
end
