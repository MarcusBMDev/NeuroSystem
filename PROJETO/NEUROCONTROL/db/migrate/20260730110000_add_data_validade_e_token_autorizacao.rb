class AddDataValidadeETokenAutorizacao < ActiveRecord::Migration[7.0]
  def change
    add_column :neurocontrol_guias, :data_validade, :date
    add_column :neurocontrol_assinaturas_sessoes, :token_autorizacao, :string, limit: 50
  end
end
