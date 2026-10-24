import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/sequelize';
import { DataTypes, QueryTypes, Transaction } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { Channel } from '@/channel/channel.model';
import { defaultChannelSettings } from '@/channel/channel.settings';

// Migración de la base de datos al arrancar.
// IMPORTANTE: la base tiene datos de producción. Aquí solo se AÑADE (columnas, índices, filas);
// nunca se usa DROP, removeColumn, removeConstraint, DELETE, TRUNCATE ni sync({ force / alter }).
// Cada paso comprueba el estado actual, así que es seguro ejecutarlo en cada arranque.
@Injectable()
export class DatabaseSetupService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseSetupService.name);

  constructor(@InjectConnection() private readonly sequelize: Sequelize) {}

  async onModuleInit() {
    const legacyChannel = process.env.LEGACY_CHANNEL?.trim().toLowerCase();
    const legacyChannelId = process.env.LEGACY_CHANNEL_ID?.trim();

    await this.sequelize.transaction(async (transaction) => {
      const tables = await this.sequelize
        .getQueryInterface()
        .showAllTables({ transaction });

      if (tables.includes('Stars')) {
        await this.migrateStars(transaction, legacyChannelId);
      }
      if (tables.includes('CurrentMovies')) {
        await this.migrateCurrentMovies(
          transaction,
          legacyChannel,
          legacyChannelId,
        );
      }
    });

    // Crea las tablas que falten (p. ej. Channels). Sin force ni alter: no toca las existentes
    await this.sequelize.sync();

    if (legacyChannel && legacyChannelId) {
      const [, created] = await Channel.findOrCreate({
        where: { channelId: legacyChannelId },
        defaults: {
          channelId: legacyChannelId,
          channelUsername: legacyChannel,
          displayName: legacyChannel,
          settings: defaultChannelSettings(),
        },
      });
      if (created) {
        this.logger.log(`Canal histórico "${legacyChannel}" registrado`);
      }
    }

    this.logger.log('Base de datos lista');
  }

  private async migrateStars(
    transaction: Transaction,
    legacyChannelId: string | undefined,
  ) {
    const queryInterface = this.sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable('Stars');
    const channelIdNullable = !columns.channelId || columns.channelId.allowNull;

    if (!columns.channelId) {
      await queryInterface.addColumn(
        'Stars',
        'channelId',
        { type: DataTypes.STRING(30), allowNull: true },
        { transaction },
      );
      this.logger.log('Stars: columna channelId añadida');
    }

    if (!columns.mediaType) {
      await queryInterface.addColumn(
        'Stars',
        'mediaType',
        { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'movie' },
        { transaction },
      );
      this.logger.log('Stars: columna mediaType añadida');
    }

    const missing = await this.countWhere(
      'SELECT COUNT(*)::int AS count FROM "Stars" WHERE "channelId" IS NULL',
      transaction,
    );

    if (missing > 0) {
      if (!legacyChannelId) {
        throw new Error(
          `Hay ${missing} estrellas sin canal y falta LEGACY_CHANNEL_ID. Defínelo en el .env con el ID de Twitch del canal original.`,
        );
      }

      await this.sequelize.query(
        'UPDATE "Stars" SET "channelId" = :channelId WHERE "channelId" IS NULL',
        { replacements: { channelId: legacyChannelId }, transaction },
      );
      this.logger.log(
        `Stars: ${missing} filas asignadas al canal ${legacyChannelId}`,
      );
    }

    // Una vez que todas las filas tienen canal, la columna pasa a ser obligatoria
    if (channelIdNullable) {
      await queryInterface.changeColumn(
        'Stars',
        'channelId',
        { type: DataTypes.STRING(30), allowNull: false },
        { transaction },
      );
    }

    await this.addIndexIfMissing(
      'Stars',
      'stars_channel_id_tmdb_id',
      ['channelId', 'tmdbId'],
      false,
      transaction,
    );
  }

  private async migrateCurrentMovies(
    transaction: Transaction,
    legacyChannel: string | undefined,
    legacyChannelId: string | undefined,
  ) {
    const queryInterface = this.sequelize.getQueryInterface();
    const columns = await queryInterface.describeTable('CurrentMovies');

    if (!columns.channelId) {
      await queryInterface.addColumn(
        'CurrentMovies',
        'channelId',
        { type: DataTypes.STRING(30), allowNull: true },
        { transaction },
      );
      this.logger.log('CurrentMovies: columna channelId añadida');
    }

    if (!columns.mediaType) {
      await queryInterface.addColumn(
        'CurrentMovies',
        'mediaType',
        { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'movie' },
        { transaction },
      );
      this.logger.log('CurrentMovies: columna mediaType añadida');
    }

    // Solo se rellena la fila del canal histórico; cualquier otra queda intacta
    if (legacyChannel && legacyChannelId) {
      await this.sequelize.query(
        'UPDATE "CurrentMovies" SET "channelId" = :channelId WHERE "channelId" IS NULL AND "channelUsername" = :channelUsername',
        {
          replacements: {
            channelId: legacyChannelId,
            channelUsername: legacyChannel,
          },
          transaction,
        },
      );
    }

    await this.addIndexIfMissing(
      'CurrentMovies',
      'current_movies_channel_id',
      ['channelId'],
      true,
      transaction,
    );
  }

  private async countWhere(sql: string, transaction: Transaction) {
    const [row] = await this.sequelize.query<{ count: number }>(sql, {
      type: QueryTypes.SELECT,
      transaction,
    });
    return row?.count ?? 0;
  }

  private async addIndexIfMissing(
    table: string,
    name: string,
    fields: string[],
    unique: boolean,
    transaction: Transaction,
  ) {
    const queryInterface = this.sequelize.getQueryInterface();
    const indexes = (await queryInterface.showIndex(table, {
      transaction,
    })) as Array<{ name: string }>;

    if (indexes.some((index) => index.name === name)) return;

    await queryInterface.addIndex(table, fields, { name, unique, transaction });
    this.logger.log(`${table}: índice ${name} creado`);
  }
}
