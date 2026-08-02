require_relative "boot"

require "rails"
require "active_model/railtie"
require "active_job/railtie"
require "active_record/railtie"
require "action_controller/railtie"
require "action_mailer/railtie"
require "action_view/railtie"

Bundler.require(*Rails.groups)

module NeurocontrolApi
  class Application < Rails::Application
    config.load_defaults 7.0
    config.api_only = true
    config.time_zone = "America/Sao_Paulo"
    config.i18n.default_locale = :"pt-BR"

    # Servir arquivos estáticos do frontend (pasta public/)
    config.public_file_server.enabled = true

    # Habilita CORS para o frontend
    config.middleware.insert_before 0, Rack::Cors do
      allow do
        origins '*'
        resource '*', headers: :any, methods: [:get, :post, :put, :delete, :options]
      end
    end
  end
end
