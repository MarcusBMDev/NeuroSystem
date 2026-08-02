class AddVipToPacientes < ActiveRecord::Migration[8.1]
  def change
    add_column :pacientes, :vip, :boolean, default: false
  end
end
