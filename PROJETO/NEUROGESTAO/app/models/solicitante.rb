# app/models/solicitante.rb
class Solicitante < ApplicationRecord
  self.table_name = "solicitantes"

  validates :nome, presence: true, uniqueness: { case_sensitive: false }
end
