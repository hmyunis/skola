import 'dotenv/config';
import { join } from 'path';
import { DataSource } from 'typeorm';
import { enforceMysqlUtcSession } from './mysql-utc-session';

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'skola_db',
  entities: [join(__dirname, '..', 'modules', '**', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
  synchronize: false,
  timezone: 'Z',
});

const originalInitialize = AppDataSource.initialize.bind(AppDataSource);
AppDataSource.initialize = async () => {
  const dataSource = await originalInitialize();
  await enforceMysqlUtcSession(dataSource, {
    log: (message) => console.log(`[DB UTC] ${message}`),
    warn: (message) => console.warn(`[DB UTC] ${message}`),
    error: (message) => console.error(`[DB UTC] ${message}`),
  });
  return dataSource;
};

export default AppDataSource;
