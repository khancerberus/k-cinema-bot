import { Column, DataType, Model, Table } from 'sequelize-typescript';
import type { MediaType } from '@/channel/channel.settings';

export interface SessionCategory {
  key: string;
  label: string;
}

// Ventana de votación: mientras está abierta se puede puntuar (y apelar) el contenido activo.
// Guarda una copia de las categorías del canal al abrirse: cambiarlas después no afecta a esta votación.
@Table({
  timestamps: false,
  indexes: [{ name: 'rating_sessions_channel_id', fields: ['channelId'] }],
})
export class RatingSession extends Model {
  @Column({
    type: DataType.STRING(30),
    allowNull: false,
  })
  declare channelId: string;

  @Column({
    type: DataType.STRING(20),
    allowNull: false,
  })
  declare mediaType: MediaType;

  // TMDB ID (películas) o IGDB ID (juegos)
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  declare itemId: number;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
  })
  declare categories: SessionCategory[];

  @Column({
    type: DataType.DATE,
    allowNull: false,
  })
  declare openedAt: Date;

  // null: sin límite de tiempo (películas que ya estaban activas antes de existir las ventanas)
  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare closesAt: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  declare closedAt: Date | null;
}
