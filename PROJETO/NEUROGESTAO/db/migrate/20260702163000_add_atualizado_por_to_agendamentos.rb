class AddAtualizadoPorToAgendamentos < ActiveRecord::Migration[8.1]
  def change
    add_column :agendamentos, :atualizado_por, :string
  end
end
