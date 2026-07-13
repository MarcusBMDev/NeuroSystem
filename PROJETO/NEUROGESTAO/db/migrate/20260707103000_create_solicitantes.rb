class CreateSolicitantes < ActiveRecord::Migration[7.0]
  def change
    create_table :solicitantes do |t|
      t.string :nome

      t.timestamps
    end

    reversible do |dir|
      dir.up do
        ['Ester', 'Camila', 'Vitória', 'Nathali', 'Responsável/Paciente', 'Sâmia', 'Bruno', 'Júnior'].each do |nome|
          execute("INSERT INTO solicitantes (nome, created_at, updated_at) VALUES ('#{nome}', NOW(), NOW())")
        end
      end
    end
  end
end
