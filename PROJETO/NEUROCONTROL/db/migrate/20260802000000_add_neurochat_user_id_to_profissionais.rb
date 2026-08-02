class AddNeurochatUserIdToProfissionais < ActiveRecord::Migration[7.0]
  def change
    add_column :profissionais, :neurochat_user_id, :bigint, default: nil
    add_index :profissionais, :neurochat_user_id
  end
end
