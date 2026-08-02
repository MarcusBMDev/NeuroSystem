class Profissional < ApplicationRecord
  self.table_name = 'profissionais'

  def neurochat_user
    return nil if neurochat_user_id.blank?
    User.find_by(id: neurochat_user_id)
  end
end
