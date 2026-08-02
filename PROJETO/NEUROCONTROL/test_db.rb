require 'mysql2'

[
  { ssl_mode: :disabled },
  { ssl_mode: 'disabled' },
  { sslmode: :disabled },
  { sslmode: 'disabled' },
  { ssl_mode: 1 },
  { sslmode: 1 },
  { sslca: nil, ssl_mode: :disabled },
  { sslca: "", sslcert: "", sslkey: "" }
].each_with_index do |opts, idx|
  begin
    client = Mysql2::Client.new(host: '127.0.0.1', username: 'root', **opts)
    puts "SUCCESS [#{idx}] with #{opts.inspect}: Connected! DBs: #{client.query('SHOW DATABASES').to_a.size}"
  rescue => e
    puts "FAILED [#{idx}] with #{opts.inspect}: #{e.message}"
  end
end
