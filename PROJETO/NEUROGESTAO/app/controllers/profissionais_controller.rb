class ProfissionaisController < ApplicationController
  def index
    render json: Profissional.order(:nome).all
  end

  def create
    profissional = Profissional.new(params.require(:profissional).permit(:nome, :especialidade, :unidade, :sala))
    if profissional.save
      render json: profissional, status: :created
    else
      render json: { errors: profissional.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def update
    @profissional = Profissional.find(params[:id])
    if @profissional.update(params.require(:profissional).permit(:nome, :especialidade, :unidade, :sala))
      render json: @profissional
    else
      render json: { errors: @profissional.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    Profissional.find(params[:id]).destroy
    render json: { mensagem: "Removido com sucesso" }
  end
end