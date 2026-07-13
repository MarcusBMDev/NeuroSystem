# app/models/paciente.rb
class Paciente < ApplicationRecord
  include AgeCalculable
  self.table_name = 'pacientes'

  belongs_to :convenio, optional: true
  has_many :agendamentos, dependent: :nullify

  validates :nome, presence: true, uniqueness: { case_sensitive: false }
  validates :age,
            numericality: { only_integer: true, greater_than_or_equal_to: 0 },
            allow_nil: true
  validates :weekly_frequency,
            numericality: { only_integer: true, greater_than_or_equal_to: 0, less_than_or_equal_to: 100 },
            allow_nil: true

  scope :ativos,   -> { where(deleted_at: nil) }
  scope :inativos, -> { where.not(deleted_at: nil) }

  validate :birth_date_cannot_be_in_the_future
  before_validation :strip_nome
  before_save       :set_default_status
  before_save       :clear_agendamentos_if_inactivated


  # Inativa o paciente sem apagá-lo do banco (Soft Delete)
  def soft_delete
    update(deleted_at: Time.current, status: 'inativo')
  end

  # Desfaz o Soft Delete, reativando o paciente
  def reativar
    update(deleted_at: nil, status: 'ativo')
  end

  def ativo?
    deleted_at.nil?
  end

  private

  def birth_date_cannot_be_in_the_future
    if birth_date.present? && birth_date > Time.zone.today
      errors.add(:birth_date, "não pode ser no futuro")
    end
  end


  def set_default_status
    self.status ||= 'ativo'
  end

  def strip_nome
    self.nome = nome.strip if nome.present?
  end

  def clear_agendamentos_if_inactivated
    if status_changed? && status == 'inativo'
      agendamentos.destroy_all
    end
  end
end
