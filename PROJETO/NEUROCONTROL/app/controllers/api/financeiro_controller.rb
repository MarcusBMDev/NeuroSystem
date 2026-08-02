module Api
  class FinanceiroController < ApplicationController
    before_action -> { authorize!('gerenciar_valores') }

    # GET /api/financeiro/convenios
    def listar_convenios
      render json: Convenio.order(nome: :asc)
    end

    # POST /api/financeiro/convenios
    def criar_convenio
      nome = params[:nome].to_s.strip

      if nome.blank?
        render json: { error: 'O nome do convênio é obrigatório.' }, status: :bad_request
        return
      end

      convenio = Convenio.new(nome: nome)
      if convenio.save
        render json: { success: true, id: convenio.id, message: 'Convênio cadastrado com sucesso!' }
      else
        render json: { error: 'Erro ao cadastrar convênio.' }, status: :bad_request
      end
    end

    # PUT /api/financeiro/convenios/:id
    def atualizar_convenio
      nome = params[:nome].to_s.strip
      if nome.blank?
        render json: { error: 'O nome do convênio é obrigatório.' }, status: :bad_request
        return
      end

      convenio = Convenio.find_by(id: params[:id])
      if convenio&.update(nome: nome)
        render json: { success: true, message: 'Convênio atualizado com sucesso!' }
      else
        render json: { error: 'Erro ao atualizar convênio.' }, status: :bad_request
      end
    end

    # DELETE /api/financeiro/convenios/:id
    def excluir_convenio
      convenio = Convenio.find_by(id: params[:id])
      if convenio&.destroy
        render json: { success: true, message: 'Convênio removido com sucesso.' }
      else
        render json: { error: 'Não foi possível excluir o convênio. Verifique se existem pacientes vinculados.' }, status: :bad_request
      end
    rescue ActiveRecord::InvalidForeignKey, ActiveRecord::DeleteRestrictionError
      render json: { error: 'Não foi possível excluir o convênio. Verifique se existem pacientes vinculados.' }, status: :bad_request
    end

    # GET /api/financeiro/tabela
    def listar_tabela
      valores = NeurocontrolTabelaValor.joins(:convenio)
                                       .select('neurocontrol_tabela_valores.*, convenios.nome as convenio_nome')
                                       .order('convenios.nome ASC, neurocontrol_tabela_valores.especialidade ASC')
      render json: valores
    end

    # POST /api/financeiro/tabela
    def salvar_tabela
      convenio_id = params[:convenio_id]
      especialidade = params[:especialidade]
      codigo_tuss = params[:codigo_tuss]
      valor_sessao = params[:valor_sessao]

      if convenio_id.blank? || especialidade.blank? || codigo_tuss.blank? || valor_sessao.blank?
        render json: { error: 'Campos obrigatórios ausentes.' }, status: :bad_request
        return
      end

      valor = NeurocontrolTabelaValor.find_or_initialize_by(convenio_id: convenio_id, especialidade: especialidade)
      valor.codigo_tuss = codigo_tuss
      valor.valor_sessao = valor_sessao

      if valor.save
        render json: { success: true, message: 'Valor da tabela salvo com sucesso!' }
      else
        render json: { error: 'Erro ao salvar valor na tabela.' }, status: :bad_request
      end
    end

    # GET /api/financeiro/negociacoes
    def listar_negociacoes
      negociacoes = NeurocontrolNegociacao.joins(:paciente)
                                           .left_joins(:profissional)
                                           .select('neurocontrol_negociacoes.*, pacientes.nome as paciente_nome, profissionais.nome as profissional_nome')
                                           .order('pacientes.nome ASC')
      render json: negociacoes
    end

    # POST /api/financeiro/negociacoes
    def salvar_negociacao
      paciente_id = params[:paciente_id]
      valor_diferenciado = params[:valor_diferenciado]
      tipo_negocio = params[:tipo_negocio]

      if paciente_id.blank? || valor_diferenciado.blank? || tipo_negocio.blank?
        render json: { error: 'Campos obrigatórios ausentes.' }, status: :bad_request
        return
      end

      negociacao = NeurocontrolNegociacao.new(
        paciente_id: paciente_id,
        profissional_id: params[:profissional_id].presence,
        valor_diferenciado: valor_diferenciado,
        tipo_negocio: tipo_negocio,
        observacoes: params[:observacoes]
      )

      if negociacao.save
        render json: { success: true, message: 'Negociação registrada com sucesso!' }
      else
        render json: { error: 'Erro ao salvar negociação.' }, status: :bad_request
      end
    end
  end
end
