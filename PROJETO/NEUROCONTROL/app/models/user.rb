class User < NeurochatRecord
  self.table_name = 'users'
  belongs_to :setor, class_name: 'Setor', foreign_key: 'setor_id', optional: true

  def readonly?
    true
  end

  def autentica_senha?(senha_digitada)
    return false if self.password.blank?
    self.password == senha_digitada
  end
end
