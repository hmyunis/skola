import { DataSource } from 'typeorm';

const MYSQL_SET_UTC_SESSION_SQL = "SET time_zone = '+00:00'";
const MYSQL_VERIFY_SESSION_TIMEZONE_SQL =
  'SELECT @@session.time_zone AS sessionTimeZone';

type LoggerFn = (message: string) => void;

interface UtcSessionLogger {
  log?: LoggerFn;
  warn?: LoggerFn;
  error?: LoggerFn;
}

function noOp(_message: string) {
  // Intentionally empty.
}

function queryConnection(
  connection: {
    query: (sql: string, callback: (error: unknown) => void) => void;
  },
  sql: string,
) {
  return new Promise<void>((resolve, reject) => {
    connection.query(sql, (error: unknown) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

export async function enforceMysqlUtcSession(
  dataSource: DataSource,
  logger: UtcSessionLogger = {},
) {
  const log = logger.log ?? noOp;
  const warn = logger.warn ?? noOp;
  const error = logger.error ?? noOp;

  const pool = (dataSource.driver as any)?.pool as
    | {
        on?: (
          event: string,
          listener: (connection: {
            query: (sql: string, callback: (err: unknown) => void) => void;
          }) => void,
        ) => void;
        _allConnections?: Array<{
          query: (sql: string, callback: (err: unknown) => void) => void;
        }>;
      }
    | undefined;

  const applyUtcToConnection = async (connection: {
    query: (sql: string, callback: (err: unknown) => void) => void;
  }) => {
    try {
      await queryConnection(connection, MYSQL_SET_UTC_SESSION_SQL);
    } catch (err: any) {
      error(
        `Failed to set MySQL session time_zone on pooled connection: ${
          err?.message || String(err)
        }`,
      );
    }
  };

  if (!pool) {
    warn(
      'MySQL pool handle not found; skipping per-connection UTC session hook.',
    );
  } else {
    if (typeof pool.on === 'function') {
      pool.on('connection', (connection) => {
        void applyUtcToConnection(connection);
      });
    }

    const existingConnections = Array.isArray(pool._allConnections)
      ? pool._allConnections
      : [];
    await Promise.all(
      existingConnections.map((connection) => applyUtcToConnection(connection)),
    );
  }

  try {
    await dataSource.query(MYSQL_SET_UTC_SESSION_SQL);
    const rows = await dataSource.query(MYSQL_VERIFY_SESSION_TIMEZONE_SQL);
    const sessionTimeZone = rows?.[0]?.sessionTimeZone;
    if (sessionTimeZone === '+00:00' || sessionTimeZone === 'UTC') {
      log(`MySQL session timezone verified as ${sessionTimeZone}.`);
    } else {
      warn(
        `MySQL session timezone check returned '${String(
          sessionTimeZone,
        )}'. Expected '+00:00' or 'UTC'.`,
      );
    }
  } catch (err: any) {
    error(
      `Failed to verify MySQL session timezone after UTC setup: ${
        err?.message || String(err)
      }`,
    );
  }
}
